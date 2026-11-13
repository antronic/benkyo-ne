/**
 * Mnemonics: a one-line story that links the shape to the sound, plus (for
 * the first rows) an SVG scene drawn *under* the real KanjiVG strokes so the
 * character becomes part of the picture.
 *
 * Scenes use the KanjiVG 109×109 coordinate box.
 */

export interface Mnemonic {
	story: string;
	/** Optional SVG fragment (no <svg> wrapper) drawn beneath the glyph. */
	scene?: string;
}

const eye = (x: number, y: number, r = 3.2) =>
	`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#1d1d1f" stroke-width="1"/>` +
	`<circle cx="${x + r * 0.25}" cy="${y}" r="${r * 0.5}" fill="#1d1d1f"/>`;

const SCENES: Record<string, string> = {
	あ: `
		<circle cx="57" cy="66" r="31" fill="#ff6b5a" opacity=".28"/>
		<path d="M50 20 q-2 -9 6 -14" stroke="#7a4b2a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
		<path d="M57 9 q14 -6 20 4 q-12 6 -20 -4z" fill="#5fbf5a" opacity=".8"/>
		<ellipse cx="44" cy="58" rx="6" ry="9" fill="#fff" opacity=".45"/>`,
	い: `
		<path d="M4 92 q13 -8 26 0 t26 0 t26 0 t26 0 V109 H4z" fill="#4aa3ff" opacity=".22"/>
		<path d="M4 100 q13 -8 26 0 t26 0 t26 0 t26 0" stroke="#4aa3ff" stroke-width="1.5" fill="none" opacity=".5"/>
		${eye(24, 33)}${eye(75, 40)}`,
	う: `
		<circle cx="47" cy="14" r="9" fill="#ffc94d" opacity=".55"/>
		<ellipse cx="50" cy="68" rx="26" ry="28" fill="#b38cff" opacity=".18"/>
		<text x="70" y="22" font-size="11" font-family="system-ui" font-weight="700" fill="#b38cff">ooh</text>`,
	え: `
		<path d="M41 13 q-10 -8 -3 -12 q6 4 3 12z" fill="#ff8fb1" opacity=".8"/>
		<path d="M44 12 q2 -11 10 -9 q-3 7 -10 9z" fill="#ffc94d" opacity=".8"/>
		<ellipse cx="55" cy="60" rx="30" ry="34" fill="#ff8fb1" opacity=".16"/>
		${eye(62, 36, 2.8)}`,
	お: `
		<circle cx="88" cy="26" r="6" fill="#fff" stroke="#9aa0a6" stroke-width="1"/>
		<path d="M82 34 l-6 7 M90 35 l2 8 M95 28 l7 2" stroke="#9aa0a6" stroke-width="1.5" stroke-linecap="round"/>
		<path d="M8 100 q50 -10 100 0 V109 H8z" fill="#5fbf5a" opacity=".3"/>`,
	か: `
		<path d="M90 50 l4 -10 l2 10 l9 -3 l-7 8 l8 6 l-10 0 l1 10 l-6 -8 l-6 7 l1 -10 l-9 -1 l9 -5z" fill="#ffc94d" opacity=".75"/>
		<rect x="14" y="30" width="44" height="7" rx="3.5" fill="#ff6b5a" opacity=".15"/>`,
	き: `
		<circle cx="58" cy="76" r="17" fill="none" stroke="#e0a800" stroke-width="5" opacity=".35"/>
		<rect x="40" y="10" width="10" height="60" rx="4" fill="#e0a800" opacity=".18"/>
		<rect x="26" y="26" width="48" height="6" rx="3" fill="#e0a800" opacity=".25"/>
		<rect x="30" y="44" width="48" height="6" rx="3" fill="#e0a800" opacity=".25"/>`,
	く: `
		<circle cx="82" cy="54" r="34" fill="#4aa3ff" opacity=".16"/>
		${eye(78, 38)}
		<path d="M62 50 l-12 4 l12 4z" fill="#ffc94d" opacity=".9"/>
		<text x="14" y="34" font-size="11" font-family="system-ui" font-weight="700" fill="#4aa3ff">coo</text>`,
	け: `
		<rect x="10" y="20" width="32" height="56" rx="12" fill="#b07a46" opacity=".28"/>
		<path d="M10 34 h32 M10 62 h32" stroke="#7a4b2a" stroke-width="2" opacity=".5"/>
		<path d="M88 40 q4 8 0 14 q-4 -6 0 -14z" fill="#4aa3ff" opacity=".6"/>`,
	こ: `
		${eye(36, 25)}${eye(31, 66)}
		<path d="M26 92 q40 -6 80 0 V109 H26z" fill="#b07a46" opacity=".25"/>`
};

const STORIES: Record<string, string> = {
	// hiragana
	あ: '“Ah!” — an apple with a cross-shaped stalk.',
	い: 'Two eels swimming side by side: “ii”.',
	う: 'Someone bent double: “ooh”, a stomach ache.',
	え: 'An exotic bird with a plume asks, “eh?”',
	お: 'A golfer watches the ball fly: “oh!”',
	か: 'A karate chop: “ka!”, the spark is the dot.',
	き: 'A key: the two bars are its teeth.',
	く: 'A bird’s beak going “coo”.',
	け: 'A keg next to a tap.',
	こ: 'Two co-workers lying side by side.',
	さ: 'A sideways smile saying “sa(y) cheese”.',
	し: 'A fish hook: “she” caught a fish.',
	す: 'A swing with a loop: “swoosh”.',
	せ: 'A mouth with a big tooth saying “say”.',
	そ: 'A zig-zag thread: “sew” it up.',
	た: 'The letters t and a squeezed together: “ta”.',
	ち: 'A cheerleader with a big chin: “chi”.',
	つ: 'A tsunami wave curling over.',
	て: 'A hand (手, te) reaching out.',
	と: 'A toe with a splinter.',
	な: 'A nun kneeling by a cross: “na”.',
	に: 'A knee next to two lines: “ni”.',
	ぬ: 'Noodles twirled on chopsticks: “nu”.',
	ね: 'A cat (neko) with its tail curled: “ne”.',
	の: 'A “No entry” sign.',
	は: 'An H and an a: “ha-ha”.',
	ひ: 'A big grin: “hee-hee”.',
	ふ: 'Mount Fuji with clouds around it.',
	へ: 'A gentle hill: “heh”, easy.',
	ほ: 'Santa with his sack: “ho-ho”.',
	ま: 'A mast with two sails: “ma”.',
	み: 'The number 21: “me” at twenty-one.',
	む: 'A cow with a tail: “moo”.',
	め: 'An eye (目, me) with a lash.',
	も: 'A fish hook with two worms: “more” bait.',
	や: 'A yak with horns.',
	ゆ: 'A fish making a U-turn: “you”.',
	よ: 'A yo-yo on a string.',
	ら: 'A rabbit with one ear up: “ra”.',
	り: 'Reeds swaying: “ri”.',
	る: 'A route that ends in a loop: “ru”.',
	れ: 'A man kneeling, reaching for the ray: “re”.',
	ろ: 'A road with no loop (unlike る).',
	わ: 'A baby crying “wah”.',
	を: 'A man throwing his arms out: “whoa”.',
	ん: 'A cursive lowercase n.',
	// katakana
	ア: 'An axe: “a!”',
	イ: 'An easel leaning: “i”.',
	ウ: 'う with a hat on.',
	エ: 'An elevator shaft: “e”.',
	オ: 'An opera singer with arms out: “o”.',
	カ: 'か without its dot.',
	キ: 'き, straightened into a key.',
	ク: 'A cook’s hat: “ku”.',
	ケ: 'A K tilted over: “ke”.',
	コ: 'A corner: “ko”.',
	サ: 'A saddle on two posts: “sa”.',
	シ: 'She smiles: the strokes rise from the bottom up.',
	ス: 'A swing on its side: “su”.',
	セ: 'せ, sharpened.',
	ソ: 'A sewing needle: strokes fall from the top down.',
	タ: 'A tall ta with a sash.',
	チ: 'A cheerleader’s pom-pom stick: “chi”.',
	ツ: 'Tsunami spray: strokes fall from the top down.',
	テ: 'A telegraph pole: “te”.',
	ト: 'A totem pole with a branch: “to”.',
	ナ: 'A knife: “na”.',
	ニ: 'Two lines, like に without the knee.',
	ヌ: 'A noodle on chopsticks: “nu”.',
	ネ: 'A necktie on a hook: “ne”.',
	ノ: 'A single slash: “no”.',
	ハ: 'Two strokes laughing apart: “ha”.',
	ヒ: 'A heel: “hi”.',
	フ: 'A fool’s cap: “fu”.',
	ヘ: 'Exactly the same as hiragana へ.',
	ホ: 'A holy cross with two feet: “ho”.',
	マ: 'A mama’s apron: “ma”.',
	ミ: 'Three lines: “mi”, mimi (ears).',
	ム: 'A moo-cow’s nose: “mu”.',
	メ: 'An X marks the spot: “me”.',
	モ: 'も without the hook.',
	ヤ: 'や, more angular.',
	ユ: 'A U-shaped bracket: “yu”.',
	ヨ: 'A yo-yo’s three strings: “yo”.',
	ラ: 'A rabbit’s ear and a hook: “ra”.',
	リ: 'Exactly like り.',
	ル: 'Two roots: “ru”.',
	レ: 'A ray going up: “re”.',
	ロ: 'A box-shaped road: “ro”.',
	ワ: 'A wide mouth crying “wah”.',
	ヲ: 'Whoa, a man bowing: “wo”.',
	ン: 'N goes up: the last stroke rises from the bottom (unlike ソ).'
};

const DAKUTEN: Record<string, string> = {
	が: 'か', ぎ: 'き', ぐ: 'く', げ: 'け', ご: 'こ',
	ざ: 'さ', じ: 'し', ず: 'す', ぜ: 'せ', ぞ: 'そ',
	だ: 'た', ぢ: 'ち', づ: 'つ', で: 'て', ど: 'と',
	ば: 'は', び: 'ひ', ぶ: 'ふ', べ: 'へ', ぼ: 'ほ',
	ぱ: 'は', ぴ: 'ひ', ぷ: 'ふ', ぺ: 'へ', ぽ: 'ほ'
};

/** Base kana of a dakuten/handakuten kana, or undefined. */
export function baseOf(char: string): string | undefined {
	const hira = DAKUTEN[char];
	if (hira) return hira;
	// katakana are hiragana + 0x60
	const h = String.fromCodePoint(char.codePointAt(0)! - 0x60);
	const b = DAKUTEN[h];
	return b ? String.fromCodePoint(b.codePointAt(0)! + 0x60) : undefined;
}

export function mnemonicFor(char: string): Mnemonic {
	const base = baseOf(char);
	if (base) {
		const isP = 'ぱぴぷぺぽパピプペポ'.includes(char);
		return {
			story: `${base} plus ${isP ? 'a small circle ゜ (h → p)' : 'two small strokes ゛ (voiced)'}.`
		};
	}
	return { story: STORIES[char] ?? '', scene: SCENES[char] };
}
