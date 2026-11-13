//! Kana handwriting matcher, compiled to `wasm32-unknown-unknown`.
//!
//! Strokes are passed in as already-resampled polylines (`SAMPLES` points per
//! stroke, interleaved `x, y` f32 in a 0..1 box). Templates come from KanjiVG
//! (see `scripts/build-strokes.mjs`).
//!
//! Scoring is stroke-order aware: stroke *i* of the drawing is compared with
//! stroke *i* of the template using dynamic time warping (DTW), so drawing a
//! stroke backwards or out of order costs points. That's on purpose — the app
//! is teaching correct stroke order, not just shape recognition.
//!
//! The ABI is plain C (no wasm-bindgen) so the module has no JS glue and is a
//! few KB. A TypeScript port with identical maths lives in
//! `src/lib/handwriting/match.ts` as a fallback.

use std::cell::RefCell;

pub const SAMPLES: usize = 24;
const STROKE_FLOATS: usize = SAMPLES * 2;
/// Penalty added per missing or extra stroke.
pub const COUNT_PENALTY: f32 = 0.2;
/// Penalty for a stroke drawn in the wrong direction. DTW alone is fairly
/// forgiving of reversal on short, straight strokes, so we check endpoints.
pub const DIRECTION_PENALTY: f32 = 0.25;

pub type Stroke = [f32; STROKE_FLOATS];

thread_local! {
    static TEMPLATES: RefCell<Vec<Vec<Stroke>>> = const { RefCell::new(Vec::new()) };
}

// ---------------------------------------------------------------- maths ----

/// Scale strokes uniformly so their joint bounding box fits a unit square,
/// centred at (0.5, 0.5). Keeps aspect ratio, so ー and | stay different.
pub fn normalize(strokes: &mut [Stroke]) {
    let (mut minx, mut miny, mut maxx, mut maxy) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
    for s in strokes.iter() {
        for p in s.chunks_exact(2) {
            minx = minx.min(p[0]);
            maxx = maxx.max(p[0]);
            miny = miny.min(p[1]);
            maxy = maxy.max(p[1]);
        }
    }
    let size = (maxx - minx).max(maxy - miny).max(1e-3);
    let (cx, cy) = ((minx + maxx) / 2.0, (miny + maxy) / 2.0);
    for s in strokes.iter_mut() {
        for p in s.chunks_exact_mut(2) {
            p[0] = (p[0] - cx) / size + 0.5;
            p[1] = (p[1] - cy) / size + 0.5;
        }
    }
}

/// DTW distance between two strokes, averaged over the warping path length.
pub fn dtw(a: &Stroke, b: &Stroke) -> f32 {
    const N: usize = SAMPLES;
    let mut prev = [f32::INFINITY; N + 1];
    let mut cur = [f32::INFINITY; N + 1];
    prev[0] = 0.0;
    for i in 1..=N {
        cur[0] = f32::INFINITY;
        let (ax, ay) = (a[(i - 1) * 2], a[(i - 1) * 2 + 1]);
        for j in 1..=N {
            let dx = ax - b[(j - 1) * 2];
            let dy = ay - b[(j - 1) * 2 + 1];
            let cost = (dx * dx + dy * dy).sqrt();
            cur[j] = cost + prev[j].min(cur[j - 1]).min(prev[j - 1]);
        }
        std::mem::swap(&mut prev, &mut cur);
    }
    prev[N] / (2 * N) as f32
}

fn dist(s: &Stroke, i: usize, t: &Stroke, j: usize) -> f32 {
    let (dx, dy) = (s[i * 2] - t[j * 2], s[i * 2 + 1] - t[j * 2 + 1]);
    (dx * dx + dy * dy).sqrt()
}

/// True if `a` runs end-to-start relative to `b` (clearly, not by a hair).
pub fn reversed(a: &Stroke, b: &Stroke) -> bool {
    let l = SAMPLES - 1;
    let same = dist(a, 0, b, 0) + dist(a, l, b, l);
    let flip = dist(a, 0, b, l) + dist(a, l, b, 0);
    flip + 0.05 < same
}

/// Distance between one drawn stroke and one template stroke.
pub fn stroke_distance(a: &Stroke, b: &Stroke) -> f32 {
    dtw(a, b) + if reversed(a, b) { DIRECTION_PENALTY } else { 0.0 }
}

/// Compare a drawing with a template. Writes per-stroke distances into `per`
/// (one per template stroke, `-1` where the drawing has no such stroke) and
/// returns the overall score — lower is better.
pub fn compare_strokes(user: &[Stroke], tpl: &[Stroke], per: Option<&mut [f32]>) -> f32 {
    let n = user.len().min(tpl.len());
    let mut sum = 0.0;
    let mut per = per;
    for i in 0..tpl.len() {
        let d = if i < n { stroke_distance(&user[i], &tpl[i]) } else { -1.0 };
        if d >= 0.0 {
            sum += d;
        }
        if let Some(out) = per.as_deref_mut() {
            if i < out.len() {
                out[i] = d;
            }
        }
    }
    let mean = if n > 0 { sum / n as f32 } else { 1.0 };
    mean + COUNT_PENALTY * (user.len() as f32 - tpl.len() as f32).abs()
}

fn read_strokes(ptr: *const f32, count: usize) -> Vec<Stroke> {
    let flat = unsafe { std::slice::from_raw_parts(ptr, count * STROKE_FLOATS) };
    flat.chunks_exact(STROKE_FLOATS)
        .map(|c| {
            let mut s = [0.0; STROKE_FLOATS];
            s.copy_from_slice(c);
            s
        })
        .collect()
}

// ------------------------------------------------------------------ ABI ----

#[unsafe(no_mangle)]
pub extern "C" fn samples() -> u32 {
    SAMPLES as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(bytes: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(bytes);
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `ptr` must come from `alloc(bytes)`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, bytes: usize) {
    drop(unsafe { Vec::from_raw_parts(ptr, 0, bytes) });
}

/// Load templates from `[strokeCount, ...strokeCount*SAMPLES*2 floats]*`.
/// Templates are normalised once here. Returns the number loaded.
#[unsafe(no_mangle)]
pub extern "C" fn set_templates(ptr: *const f32, len: usize) -> u32 {
    let buf = unsafe { std::slice::from_raw_parts(ptr, len) };
    let mut list = Vec::new();
    let mut i = 0;
    while i < len {
        let count = buf[i] as usize;
        i += 1;
        let mut strokes = read_strokes(buf[i..].as_ptr(), count);
        i += count * STROKE_FLOATS;
        normalize(&mut strokes);
        list.push(strokes);
    }
    let n = list.len() as u32;
    TEMPLATES.with(|t| *t.borrow_mut() = list);
    n
}

/// Score a drawing against every template (shape recognition, position and
/// size independent). Writes one score per template into `out`.
#[unsafe(no_mangle)]
pub extern "C" fn score_all(ptr: *const f32, strokes: u32, out: *mut f32) -> u32 {
    let mut user = read_strokes(ptr, strokes as usize);
    normalize(&mut user);
    TEMPLATES.with(|t| {
        let t = t.borrow();
        let out = unsafe { std::slice::from_raw_parts_mut(out, t.len()) };
        for (k, tpl) in t.iter().enumerate() {
            out[k] = compare_strokes(&user, tpl, None);
        }
        t.len() as u32
    })
}

/// Grade a drawing against one template. With `absolute = 1` the drawing is
/// compared in place (tracing over a guide); otherwise both are normalised.
/// Writes per-stroke distances into `per` and returns the overall score.
#[unsafe(no_mangle)]
pub extern "C" fn compare(
    index: u32,
    ptr: *const f32,
    strokes: u32,
    absolute: u32,
    raw_tpl_ptr: *const f32,
    per: *mut f32,
) -> f32 {
    let mut user = read_strokes(ptr, strokes as usize);
    TEMPLATES.with(|t| {
        let t = t.borrow();
        let Some(tpl_norm) = t.get(index as usize) else {
            return f32::INFINITY;
        };
        let per = unsafe { std::slice::from_raw_parts_mut(per, tpl_norm.len()) };
        if absolute == 1 && !raw_tpl_ptr.is_null() {
            // Tracing: the caller passes the un-normalised template too.
            let raw = read_strokes(raw_tpl_ptr, tpl_norm.len());
            compare_strokes(&user, &raw, Some(per))
        } else {
            normalize(&mut user);
            compare_strokes(&user, tpl_norm, Some(per))
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(x0: f32, y0: f32, x1: f32, y1: f32) -> Stroke {
        let mut s = [0.0; STROKE_FLOATS];
        for k in 0..SAMPLES {
            let t = k as f32 / (SAMPLES - 1) as f32;
            s[k * 2] = x0 + (x1 - x0) * t;
            s[k * 2 + 1] = y0 + (y1 - y0) * t;
        }
        s
    }

    #[test]
    fn identical_is_zero() {
        let a = line(0.0, 0.0, 1.0, 1.0);
        assert!(dtw(&a, &a) < 1e-6);
    }

    #[test]
    fn reversed_stroke_costs_more() {
        let a = line(0.1, 0.5, 0.9, 0.5);
        let b = line(0.9, 0.5, 0.1, 0.5);
        let c = line(0.12, 0.52, 0.88, 0.5);
        assert!(dtw(&a, &b) > 5.0 * dtw(&a, &c));
    }

    #[test]
    fn short_reversed_stroke_is_flagged() {
        let a = line(0.4, 0.5, 0.6, 0.5);
        let b = line(0.6, 0.5, 0.4, 0.5);
        assert!(reversed(&a, &b));
        assert!(!reversed(&a, &a));
        assert!(stroke_distance(&a, &b) >= DIRECTION_PENALTY);
    }

    #[test]
    fn stroke_count_penalised() {
        let t = vec![line(0.1, 0.5, 0.9, 0.5), line(0.5, 0.1, 0.5, 0.9)];
        let u = vec![line(0.1, 0.5, 0.9, 0.5)];
        assert!(compare_strokes(&u, &t, None) >= COUNT_PENALTY);
    }
}
