/**
 * Kanji lessons. Most early kanji began as drawings of real things (日 was a
 * sun, 山 three peaks), so every kanji here comes with an origin picture: an
 * SVG drawn in the KanjiVG 109×109 box so the real strokes sit on top of the
 * thing they came from. Compounds (休 = 亻 person + 木 tree) reuse the
 * pictures of their parts, placed where those parts sit in the character.
 *
 * Stroke data lives in kanji-strokes.json (scripts/build-strokes.mjs).
 */

export type Origin = 'picture' | 'sign' | 'combo';

export interface Kanji {
	char: string;
	/** Short English keyword: the quiz answer. */
	meaning: string;
	/** On'yomi (Chinese-derived readings), in katakana. */
	on: string[];
	/** Kun'yomi (native readings), in hiragana; okurigana after a dot: あか.るい */
	kun: string[];
	origin: Origin;
	/** How the shape came about, told as a memory hook. */
	story: string;
	/** For combos: the kanji it's built from, in writing order. */
	parts?: string[];
	example: { word: string; reading: string; gloss: string };
	/** SVG fragment (no <svg> wrapper), 109×109 box, drawn under the strokes. */
	picture: string;
}

export interface KanjiLesson {
	id: string;
	title: string;
	note: string;
	hue: number;
	chars: Kanji[];
}

// ------------------------------------------------------------ drawing kit --

const C = {
	sun: '#ffc94d',
	red: '#ff6b5a',
	blue: '#4aa3ff',
	green: '#5fbf5a',
	wood: '#b07a46',
	bark: '#7a4b2a',
	stone: '#9aa0a6',
	pink: '#ff8fb1',
	skin: '#f2a66b',
	purple: '#b38cff'
};

const drop = (x: number, y: number, s = 1, o = 0.55) =>
	`<path d="M${x} ${y - 7 * s} C${x + 5 * s} ${y - 1 * s} ${x + 5 * s} ${y + 5 * s} ${x} ${y + 5 * s} C${x - 5 * s} ${y + 5 * s} ${x - 5 * s} ${y - 1 * s} ${x} ${y - 7 * s}z" fill="${C.blue}" opacity="${o}"/>`;

const sprout = (x: number, y: number) =>
	`<path d="M${x} ${y} v-7 M${x} ${y - 4} q-4 -1 -5 -5 q4 0 5 5 M${x} ${y - 6} q4 -1 5 -5 q-4 0 -5 5" stroke="${C.green}" stroke-width="1.3" fill="${C.green}" fill-opacity=".5" opacity=".75" stroke-linecap="round"/>`;

const head = (x: number, y: number, r = 7, fill = C.skin) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity=".5"/>`;

const ground = (y: number, fill = C.green, o = 0.28) => `<path d="M2 ${y} q53 -5 105 0 V107 H2z" fill="${fill}" opacity="${o}"/>`;

/** Place a 109-box picture into the rectangle x,y,w,h (used for compounds). */
const place = (pic: string, x: number, y: number, w: number, h: number) =>
	`<g transform="translate(${x} ${y}) scale(${w / 109} ${h / 109})">${pic}</g>`;

// ----------------------------------------------------------- the pictures --

const P: Record<string, string> = {
	日: `
		<circle cx="55" cy="56" r="34" fill="${C.sun}" opacity=".35"/>
		<g stroke="${C.sun}" stroke-width="3" stroke-linecap="round" opacity=".7">
			<path d="M55 8 v8 M55 96 v8 M7 56 h8 M95 56 h8 M21 22 l6 6 M83 84 l6 6 M89 22 l-6 6 M21 90 l6 -6"/>
		</g>
		<circle cx="56" cy="54" r="4" fill="${C.red}" opacity=".55"/>`,
	月: `
		<path d="M34 8 C86 14 98 64 70 92 C58 104 38 106 22 100 C56 88 66 66 62 44 C58 26 48 14 34 8z" fill="${C.sun}" opacity=".4"/>
		<circle cx="88" cy="16" r="2" fill="${C.sun}"/><circle cx="96" cy="40" r="1.5" fill="${C.sun}"/><circle cx="12" cy="30" r="1.8" fill="${C.sun}"/>`,
	山: `
		<path d="M4 92 L22 50 L36 70 L54 10 L72 66 L88 44 L105 92z" fill="${C.green}" opacity=".3"/>
		<path d="M54 10 L42 40 q6 -6 12 0 q6 -6 12 0z" fill="#dce8f6" opacity=".9"/>
		<circle cx="92" cy="16" r="7" fill="${C.sun}" opacity=".5"/>`,
	川: `
		<path d="M18 4 C6 40 22 70 4 106 H106 C94 70 102 40 96 4z" fill="${C.blue}" opacity=".18"/>
		<path d="M40 16 q-5 10 0 20 t0 20 t0 20 M71 16 q-5 10 0 20 t0 20 t0 20 t0 20" stroke="${C.blue}" stroke-width="1.6" fill="none" stroke-dasharray="3 4" opacity=".6"/>
		<path d="M64 58 q8 -7 15 0 q-7 7 -15 0z M64 58 l-5 -4 v8z" fill="${C.pink}" opacity=".7"/>`,
	木: `
		<circle cx="54" cy="30" r="26" fill="${C.green}" opacity=".3"/>
		<circle cx="34" cy="38" r="14" fill="${C.green}" opacity=".22"/><circle cx="76" cy="36" r="15" fill="${C.green}" opacity=".22"/>
		<rect x="48" y="30" width="12" height="74" rx="4" fill="${C.wood}" opacity=".3"/>
		<path d="M2 68 q53 -4 105 0" stroke="${C.wood}" stroke-width="1.5" fill="none" opacity=".45"/>
		<path d="M53 72 q-14 10 -34 14 M55 72 q14 10 36 12 M54 80 q-4 12 -14 20 M54 80 q6 12 14 18" stroke="${C.bark}" stroke-width="1.6" fill="none" opacity=".45" stroke-linecap="round"/>`,
	火: `
		<path d="M54 6 C70 30 98 50 90 80 C86 98 68 106 54 106 C38 106 16 98 16 76 C16 56 32 46 38 28 C44 44 48 48 52 52 C48 36 48 20 54 6z" fill="${C.red}" opacity=".26"/>
		<path d="M54 52 C66 64 78 72 74 88 C70 100 40 100 36 88 C32 74 46 66 54 52z" fill="${C.sun}" opacity=".45"/>
		<circle cx="22" cy="30" r="3" fill="${C.sun}" opacity=".9"/><circle cx="86" cy="22" r="3" fill="${C.sun}" opacity=".9"/>
		<circle cx="14" cy="46" r="1.8" fill="${C.red}" opacity=".7"/><circle cx="92" cy="40" r="1.8" fill="${C.red}" opacity=".7"/>`,
	水: `
		<path d="M53 6 C72 38 88 56 88 76 a34 30 0 0 1 -68 0 C20 56 36 38 53 6z" fill="${C.blue}" opacity=".18"/>
		${drop(16, 36, 1.1)}${drop(92, 22, 1.1)}${drop(98, 62, 0.8, 0.4)}${drop(10, 86, 0.8, 0.4)}
		<path d="M30 98 q8 -6 16 0 M62 98 q8 -6 16 0" stroke="${C.blue}" stroke-width="1.5" fill="none" opacity=".6"/>`,
	雨: `
		<path d="M10 34 a12 12 0 0 1 12 -16 a16 16 0 0 1 28 -9 a15 15 0 0 1 27 3 a13 13 0 0 1 20 22z" fill="${C.stone}" opacity=".32"/>
		${drop(36, 58, 0.9)}${drop(36, 75, 0.9)}${drop(73, 53, 0.9)}${drop(73, 71, 0.9)}
		${drop(54, 98, 0.7, 0.35)}${drop(92, 94, 0.7, 0.35)}${drop(12, 96, 0.7, 0.35)}`,
	田: `
		<rect x="12" y="22" width="80" height="70" rx="6" fill="${C.green}" opacity=".16"/>
		<path d="M12 92 h80" stroke="${C.wood}" stroke-width="3" opacity=".3"/>
		${sprout(34, 46)}${sprout(42, 46)}${sprout(66, 46)}${sprout(74, 46)}${sprout(34, 76)}${sprout(42, 76)}${sprout(66, 76)}${sprout(74, 76)}
		<path d="M4 100 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0" stroke="${C.blue}" stroke-width="1.4" fill="none" opacity=".45"/>`,
	土: `
		${ground(86, C.wood, 0.3)}
		<path d="M30 87 Q32 46 54 34 Q76 46 78 87z" fill="${C.wood}" opacity=".26"/>
		<circle cx="44" cy="70" r="2" fill="${C.bark}" opacity=".5"/><circle cx="64" cy="62" r="1.6" fill="${C.bark}" opacity=".5"/><circle cx="58" cy="78" r="1.8" fill="${C.bark}" opacity=".5"/>
		${sprout(54, 20)}`,
	石: `
		<path d="M4 12 H104 V30 H46 Q36 54 10 84 H4z" fill="${C.stone}" opacity=".26"/>
		<path d="M28 92 Q24 62 44 52 Q70 44 86 62 Q96 86 82 94z" fill="${C.stone}" opacity=".42"/>
		<path d="M48 64 q8 -4 14 2" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>`,
	口: `
		<path d="M12 58 Q52 14 94 58 Q52 102 12 58z" fill="${C.red}" opacity=".24"/>
		<ellipse cx="54" cy="70" rx="16" ry="8" fill="${C.pink}" opacity=".55"/>
		<path d="M30 46 h48" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>`,
	目: `
		<path d="M55 6 Q100 56 55 106 Q10 56 55 6z" fill="${C.blue}" opacity=".13"/>
		<circle cx="55" cy="54" r="15" fill="${C.blue}" opacity=".35"/>
		<circle cx="55" cy="54" r="6.5" fill="#1d1d1f" opacity=".45"/><circle cx="59" cy="50" r="2.4" fill="#fff" opacity=".9"/>
		<path d="M88 30 l10 -6 M92 46 l11 -2 M90 64 l11 3" stroke="#1d1d1f" stroke-width="1.4" stroke-linecap="round" opacity=".35"/>`,
	耳: `
		<path d="M30 8 C86 0 104 44 84 66 C74 78 78 96 60 102 C44 106 36 94 42 84 C48 72 26 62 26 38 C26 22 24 12 30 8z" fill="${C.pink}" opacity=".25"/>
		<path d="M44 26 C70 20 82 40 70 56 C64 64 60 70 58 80" stroke="${C.pink}" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`,
	手: `
		<ellipse cx="52" cy="66" rx="30" ry="26" fill="${C.skin}" opacity=".26"/>
		<path d="M30 54 L22 22 M44 48 L40 10 M58 48 L62 8 M72 54 L84 22" stroke="${C.skin}" stroke-width="12" stroke-linecap="round" opacity=".26"/>
		<path d="M28 76 L8 60" stroke="${C.skin}" stroke-width="12" stroke-linecap="round" opacity=".26"/>
		<path d="M38 100 h30" stroke="${C.skin}" stroke-width="14" stroke-linecap="round" opacity=".2"/>`,
	足: `
		<circle cx="52" cy="30" r="22" fill="${C.skin}" opacity=".28"/>
		<rect x="42" y="40" width="22" height="46" rx="8" fill="${C.skin}" opacity=".22"/>
		<path d="M36 82 Q40 70 60 72 Q92 76 100 92 Q100 100 90 100 H32 Q26 92 36 82z" fill="${C.skin}" opacity=".32"/>
		<path d="M42 30 a10 10 0 0 1 20 0" stroke="#fff" stroke-width="2" fill="none" opacity=".55"/>`,
	人: `
		${head(60, 11, 7.5)}
		<ellipse cx="54" cy="98" rx="42" ry="5" fill="#1d1d1f" opacity=".1"/>
		<path d="M96 30 h8 M92 40 h10 M96 50 h8" stroke="${C.stone}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`,
	女: `
		${head(52, 9, 7.5, C.pink)}
		<path d="M52 20 C80 30 94 72 92 98 H16 C14 72 26 30 52 20z" fill="${C.pink}" opacity=".2"/>
		<path d="M22 66 H88" stroke="${C.red}" stroke-width="8" opacity=".22"/>
		<path d="M44 7 q8 -9 16 0" stroke="#1d1d1f" stroke-width="3" fill="none" opacity=".35"/>`,
	子: `
		${head(44, 24, 15)}
		<path d="M42 40 C26 60 32 86 48 100 C62 86 66 60 58 40z" fill="${C.blue}" opacity=".24"/>
		${head(12, 50, 6)}${head(98, 46, 6)}
		<circle cx="39" cy="22" r="1.8" fill="#1d1d1f" opacity=".5"/><circle cx="50" cy="22" r="1.8" fill="#1d1d1f" opacity=".5"/>`,
	大: `
		${head(50, 9, 7.5)}
		<path d="M8 46 l6 -5 v10z M102 42 l-6 -5 v10z" fill="${C.red}" opacity=".6"/>
		<path d="M10 100 l6 -6 M98 100 l-6 -6" stroke="${C.red}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
		<ellipse cx="54" cy="56" rx="50" ry="46" fill="${C.sun}" opacity=".14"/>`,
	力: `
		<path d="M12 96 Q12 62 34 50 Q46 22 70 14 Q94 10 92 32 Q90 46 72 46 Q80 70 62 98z" fill="${C.skin}" opacity=".28"/>
		<path d="M46 44 Q58 30 72 34" stroke="#fff" stroke-width="2.5" fill="none" opacity=".55" stroke-linecap="round"/>
		<path d="M96 54 l8 -4 M98 64 l8 2 M92 72 l6 6" stroke="${C.red}" stroke-width="2" stroke-linecap="round" opacity=".55"/>`,
	一: `<rect x="6" y="46" width="98" height="12" rx="6" fill="${C.wood}" opacity=".3"/>`,
	二: `
		<rect x="20" y="25" width="64" height="12" rx="6" fill="${C.wood}" opacity=".3"/>
		<rect x="8" y="73" width="94" height="12" rx="6" fill="${C.wood}" opacity=".3"/>`,
	三: `
		<rect x="22" y="16" width="68" height="12" rx="6" fill="${C.wood}" opacity=".3"/>
		<rect x="24" y="48" width="62" height="12" rx="6" fill="${C.wood}" opacity=".3"/>
		<rect x="8" y="80" width="94" height="12" rx="6" fill="${C.wood}" opacity=".3"/>`,
	上: `
		${ground(88)}
		<path d="M54 4 l-7 10 h14z" fill="${C.blue}" opacity=".6"/>
		<circle cx="82" cy="22" r="7" fill="${C.sun}" opacity=".55"/>
		<path d="M24 30 q4 -4 8 0 q4 -4 8 0" stroke="${C.stone}" stroke-width="1.6" fill="none" opacity=".7"/>`,
	下: `
		<path d="M2 4 H107 V22 q-53 4 -105 0z" fill="${C.blue}" opacity=".2"/>
		<path d="M54 104 l-7 -10 h14z" fill="${C.blue}" opacity=".6"/>
		<path d="M80 22 v10" stroke="${C.bark}" stroke-width="1.2" opacity=".6"/>
		<rect x="70" y="32" width="20" height="24" rx="8" fill="${C.red}" opacity=".3"/>`,
	中: `
		<circle cx="54" cy="54" r="40" fill="${C.red}" opacity=".12"/>
		<circle cx="54" cy="54" r="26" fill="#fff" opacity=".3"/>
		<circle cx="54" cy="54" r="12" fill="${C.red}" opacity=".3"/>
		<path d="M54 2 l-6 -0 l6 10 l6 -10z M54 106 l-5 -7 h10z" fill="${C.wood}" opacity=".6"/>`,
	本: `
		<circle cx="54" cy="24" r="20" fill="${C.green}" opacity=".24"/>
		<rect x="48" y="24" width="12" height="80" rx="4" fill="${C.wood}" opacity=".25"/>
		<circle cx="54" cy="74" r="13" fill="none" stroke="${C.red}" stroke-width="2.5" stroke-dasharray="4 3" opacity=".7"/>
		<path d="M52 82 q-12 8 -26 10 M56 82 q12 8 28 10" stroke="${C.bark}" stroke-width="1.6" fill="none" opacity=".45"/>`
};

// Compounds: the parts' pictures, placed where each part sits.
P['休'] = place(P['人'], 0, 6, 44, 98) + place(P['木'], 36, 4, 72, 100);
P['林'] = place(P['木'], 0, 6, 52, 96) + place(P['木'], 46, 4, 62, 100);
P['森'] = place(P['木'], 20, 0, 72, 52) + place(P['木'], 0, 42, 52, 64) + place(P['木'], 46, 42, 60, 64);
P['明'] = place(P['日'], 6, 18, 44, 58) + place(P['月'], 36, 6, 64, 98);
P['男'] = place(P['田'], 14, 4, 80, 52) + place(P['力'], 14, 42, 76, 64);
P['好'] = place(P['女'], 0, 6, 52, 96) + place(P['子'], 44, 6, 62, 96);

// ------------------------------------------------------------ the kanji --

type Def = Omit<Kanji, 'picture'>;
const k = (
	char: string,
	meaning: string,
	on: string[],
	kun: string[],
	origin: Origin,
	story: string,
	example: [word: string, reading: string, gloss: string],
	parts?: string[]
): Def => ({ char, meaning, on, kun, origin, story, parts, example: { word: example[0], reading: example[1], gloss: example[2] } });

const LESSON_DEFS: { title: string; note: string; defs: Def[] }[] = [
	{
		title: 'Sky & land',
		note: 'These began as drawings. Squint at each one and you can still see the thing it drew.',
		defs: [
			k('日', 'sun; day', ['ニチ', 'ジツ'], ['ひ', 'か'], 'picture', 'A round sun with a dot in the middle. Brushes don’t do circles, so it became a box.', ['日本', 'にほん', 'Japan']),
			k('月', 'moon; month', ['ゲツ', 'ガツ'], ['つき'], 'picture', 'A crescent moon, drawn standing up. The two lines are the shadows on its face.', ['月曜日', 'げつようび', 'Monday']),
			k('山', 'mountain', ['サン'], ['やま'], 'picture', 'Three peaks, the middle one the tallest.', ['富士山', 'ふじさん', 'Mount Fuji']),
			k('川', 'river', ['セン'], ['かわ'], 'picture', 'Water flowing between two banks: three streams running down.', ['小川', 'おがわ', 'stream; brook']),
			k('木', 'tree; wood', ['モク', 'ボク'], ['き'], 'picture', 'A tree: branches across the top, the trunk down the middle, roots spreading at the bottom.', ['木曜日', 'もくようび', 'Thursday']),
			k('火', 'fire', ['カ'], ['ひ'], 'picture', 'A campfire: the flame rises in the middle and two sparks fly out on either side.', ['火曜日', 'かようび', 'Tuesday'])
		]
	},
	{
		title: 'Water & earth',
		note: 'Watch for the dots: in kanji they are often drops, sparks or grains.',
		defs: [
			k('水', 'water', ['スイ'], ['みず'], 'picture', 'A stream in the middle with water splashing off to both sides.', ['水曜日', 'すいようび', 'Wednesday']),
			k('雨', 'rain', ['ウ'], ['あめ'], 'picture', 'A cloud hanging under the sky, with four raindrops falling from it.', ['大雨', 'おおあめ', 'heavy rain']),
			k('田', 'rice field', ['デン'], ['た'], 'picture', 'A rice paddy seen from above, split into four plots by raised paths.', ['田んぼ', 'たんぼ', 'rice paddy']),
			k('土', 'soil; earth', ['ド', 'ト'], ['つち'], 'picture', 'A lump of soil sitting on the ground. The long bottom line is the ground.', ['土曜日', 'どようび', 'Saturday']),
			k('石', 'stone', ['セキ'], ['いし'], 'picture', 'A cliff overhang (the first two strokes) with a stone 口 lying under it.', ['小石', 'こいし', 'pebble'])
		]
	},
	{
		title: 'The body',
		note: 'Old drawings of eyes and mouths were turned and squared off to fit a neat box.',
		defs: [
			k('口', 'mouth', ['コウ'], ['くち'], 'picture', 'An open mouth, squared off. It also means an opening or entrance.', ['入口', 'いりぐち', 'entrance']),
			k('目', 'eye', ['モク'], ['め'], 'picture', 'An eye turned on its side to stand up tall. The two inner lines are the pupil.', ['目薬', 'めぐすり', 'eye drops']),
			k('耳', 'ear', ['ジ'], ['みみ'], 'picture', 'An ear, with the folds of the inner ear as the lines inside.', ['耳', 'みみ', 'ear']),
			k('手', 'hand', ['シュ'], ['て'], 'picture', 'A hand with fingers spread: the lines across are fingers, the hooked line is the wrist.', ['上手', 'じょうず', 'skilful; good at']),
			k('足', 'foot; leg', ['ソク'], ['あし', 'た.りる'], 'picture', 'A kneecap 口 on top of a leg and a foot stepping forward.', ['足', 'あし', 'foot; leg'])
		]
	},
	{
		title: 'People',
		note: 'Each of these is a whole person, drawn in a few strokes.',
		defs: [
			k('人', 'person', ['ジン', 'ニン'], ['ひと'], 'picture', 'A person walking, seen from the side: two legs mid-stride.', ['日本人', 'にほんじん', 'Japanese person']),
			k('女', 'woman', ['ジョ'], ['おんな'], 'picture', 'A woman kneeling gracefully, arms folded in front of her.', ['女の子', 'おんなのこ', 'girl']),
			k('子', 'child', ['シ'], ['こ'], 'picture', 'A baby wrapped in a blanket: a big head on top and both arms stretched out.', ['子ども', 'こども', 'child']),
			k('大', 'big', ['ダイ', 'タイ'], ['おお.きい'], 'picture', 'A person stretching their arms and legs as wide as they can: “this big!”', ['大きい', 'おおきい', 'big']),
			k('力', 'power; strength', ['リョク', 'リキ'], ['ちから'], 'picture', 'An arm flexing its muscle. (Older drawings show a plough, which takes strength too.)', ['力', 'ちから', 'power; strength'])
		]
	},
	{
		title: 'Numbers & places',
		note: 'Not every idea can be drawn, so these are signs: counting sticks and marks above, below or through a line.',
		defs: [
			k('一', 'one', ['イチ'], ['ひと.つ'], 'sign', 'One counting stick laid down.', ['一つ', 'ひとつ', 'one (thing)']),
			k('二', 'two', ['ニ'], ['ふた.つ'], 'sign', 'Two counting sticks. The top one is shorter.', ['二つ', 'ふたつ', 'two (things)']),
			k('三', 'three', ['サン'], ['みっ.つ'], 'sign', 'Three counting sticks. Short, shorter, long.', ['三つ', 'みっつ', 'three (things)']),
			k('上', 'above; up', ['ジョウ'], ['うえ', 'あ.がる'], 'sign', 'A mark sitting above the ground line, pointing up.', ['上', 'うえ', 'above; top']),
			k('下', 'below; down', ['カ', 'ゲ'], ['した', 'さ.がる'], 'sign', 'A mark hanging below a line, pointing down.', ['地下鉄', 'ちかてつ', 'subway']),
			k('中', 'middle; inside', ['チュウ'], ['なか'], 'sign', 'An arrow shot right through the middle of a target.', ['中', 'なか', 'inside; middle']),
			k('本', 'origin; book', ['ホン'], ['もと'], 'sign', 'A tree 木 with a line marking its root: the root of things, the origin. It also means book.', ['本', 'ほん', 'book'])
		]
	},
	{
		title: 'Put them together',
		note: 'Most kanji are built from smaller ones. Spot the parts and the meaning often tells its own story.',
		defs: [
			k('休', 'rest', ['キュウ'], ['やす.む'], 'combo', 'A person 亻 leaning against a tree 木: taking a rest.', ['休み', 'やすみ', 'holiday; break'], ['人', '木']),
			k('林', 'grove; woods', ['リン'], ['はやし'], 'combo', 'Two trees 木木 together make a grove.', ['林', 'はやし', 'grove; woods'], ['木', '木']),
			k('森', 'forest', ['シン'], ['もり'], 'combo', 'Three trees 木 make a whole forest.', ['森', 'もり', 'forest'], ['木', '木', '木']),
			k('明', 'bright', ['メイ'], ['あか.るい'], 'combo', 'The sun 日 and the moon 月 side by side: as bright as it gets.', ['明るい', 'あかるい', 'bright'], ['日', '月']),
			k('男', 'man', ['ダン', 'ナン'], ['おとこ'], 'combo', 'A rice field 田 above, strength 力 below: the one putting his strength into the field.', ['男の子', 'おとこのこ', 'boy'], ['田', '力']),
			k('好', 'like; fond of', ['コウ'], ['す.き'], 'combo', 'A woman 女 holding her child 子: the picture of love.', ['好き', 'すき', 'liked; favourite'], ['女', '子'])
		]
	}
];

export const KANJI_LESSONS: KanjiLesson[] = LESSON_DEFS.map((l, i) => ({
	id: `kanji-${i + 1}`,
	title: l.title,
	note: l.note,
	hue: 140 + i * 14,
	chars: l.defs.map((d) => ({ ...d, picture: P[d.char] ?? '' }))
}));

export const KANJI: Kanji[] = KANJI_LESSONS.flatMap((l) => l.chars);
export const kanjiByChar = new Map(KANJI.map((x) => [x.char, x]));
export const kanjiLessonById = new Map(KANJI_LESSONS.map((l) => [l.id, l]));

/** FSRS card id for a kanji (kana use `kana:<char>`). */
export const kanjiCardId = (x: Kanji) => `kanji:${x.char}`;

export const ORIGIN_LABEL: Record<Origin, string> = {
	picture: 'Picture',
	sign: 'Sign',
	combo: 'Combination'
};

/** Kun'yomi as displayed: あか.るい → あか(るい). */
export const showKun = (r: string) => (r.includes('.') ? r.replace(/\.(.+)$/, '($1)') : r);

/** Multiple-choice meanings: the answer plus distractors, lesson-mates first. */
export function meaningChoices(x: Kanji, pool: Kanji[] = [], n = 4): Kanji[] {
	const out = new Map<string, Kanji>([[x.char, x]]);
	const shuffle = <T>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
	for (const c of [...shuffle(pool), ...shuffle(KANJI)]) {
		if (out.size >= n) break;
		if (c.meaning !== x.meaning) out.set(c.char, c);
	}
	return shuffle([...out.values()]);
}
