/** Mnemonic SVG scenes (KanjiVG 109×109 box), drawn under the glyph. See mnemonics.ts. */
export const SCENES: Record<string, string> = {
	ア: `
		<path d="M18 16 L88 13 Q94 24 62 47 L22 36 Q14 26 18 16z" fill="#9aa0a6" opacity=".3"/>
		<path d="M54 40 Q52 70 33 96" stroke="#b07a46" stroke-width="10" fill="none" stroke-linecap="round" opacity=".35"/>
		<path d="M24 18 L84 15" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
		<text x="70" y="70" font-size="13" font-family="system-ui" font-weight="700" fill="#ff6b5a">a!</text>`,
	イ: `
		<rect x="20" y="16" width="34" height="28" rx="2" transform="rotate(-12 37 30)" fill="#ffc94d" opacity=".3" stroke="#b07a46" stroke-width="1.5"/>
		<circle cx="31" cy="28" r="3.5" fill="#ff6b5a" opacity=".7"/>
		<circle cx="42" cy="24" r="3" fill="#4aa3ff" opacity=".7"/>
		<path d="M64 52 L84 96" stroke="#b07a46" stroke-width="4" stroke-linecap="round" opacity=".35"/>`,
	ウ: `
		<path d="M41 30 L54 2 L67 30z" fill="#ffc94d" opacity=".45"/>
		<circle cx="54" cy="3" r="3.5" fill="#ff6b5a" opacity=".85"/>
		<ellipse cx="54" cy="68" rx="28" ry="28" fill="#b38cff" opacity=".18"/>
		<text x="76" y="22" font-size="11" font-family="system-ui" font-weight="700" fill="#b38cff">ooh</text>`,
	エ: `
		<rect x="31" y="24" width="48" height="58" rx="3" fill="#4aa3ff" opacity=".15"/>
		<path d="M31 24 V82 M79 24 V82" stroke="#4aa3ff" stroke-width="2" opacity=".5"/>
		<path d="M90 44 l5 -7 l5 7z M90 56 l5 7 l5 -7z" fill="#ffc94d" opacity=".9"/>`,
	オ: `
		<circle cx="61" cy="9" r="7" fill="#ff8fb1" opacity=".45"/>
		<ellipse cx="61" cy="11.5" rx="2" ry="1.6" fill="#ff6b5a"/>
		<path d="M61 40 L34 98 H90z" fill="#b38cff" opacity=".18"/>
		<path d="M88 12 v12 M88 12 l7 -2 v10" stroke="#ff8fb1" stroke-width="2" fill="none" stroke-linecap="round"/>
		<circle cx="86" cy="24" r="2.5" fill="#ff8fb1"/><circle cx="93" cy="22" r="2.5" fill="#ff8fb1"/>`,
	カ: `
		<circle cx="92" cy="26" r="6" fill="none" stroke="#9aa0a6" stroke-width="1.5" stroke-dasharray="3 3"/>
		<path d="M86 20 l12 12 M98 20 l-12 12" stroke="#ff6b5a" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
		<rect x="22" y="35" width="56" height="7" rx="3.5" fill="#ff6b5a" opacity=".15"/>`,
	キ: `
		<circle cx="54" cy="10" r="8" fill="none" stroke="#e0a800" stroke-width="4" opacity=".4"/>
		<rect x="49" y="16" width="10" height="80" rx="4" transform="rotate(-6 54 56)" fill="#e0a800" opacity=".18"/>
		<rect x="24" y="31" width="58" height="9" rx="4" transform="rotate(-11 53 35)" fill="#e0a800" opacity=".25"/>
		<rect x="18" y="55" width="72" height="9" rx="4" transform="rotate(-11 54 60)" fill="#e0a800" opacity=".25"/>`,
	ク: `
		<circle cx="58" cy="16" r="9" fill="#fff" opacity=".7" stroke="#9aa0a6"/>
		<circle cx="70" cy="11" r="10" fill="#fff" opacity=".7" stroke="#9aa0a6"/>
		<circle cx="81" cy="17" r="8" fill="#fff" opacity=".7" stroke="#9aa0a6"/>
		<rect x="52" y="20" width="32" height="7" rx="2" fill="#fff" opacity=".8" stroke="#9aa0a6"/>
		<circle cx="58" cy="44" r="2.2" fill="#ff6b5a"/><circle cx="68" cy="42" r="2.2" fill="#ff6b5a"/>`,
	ケ: `
		<path d="M18 18 L34 60 M30 40 L52 20 M30 40 L54 62" stroke="#b38cff" stroke-width="6" stroke-linecap="round" opacity=".25" transform="rotate(25 36 40)"/>
		<path d="M74 70 q14 -6 14 -22" stroke="#b38cff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>
		<path d="M84 50 l4 -6 l4 6z" fill="#b38cff" opacity=".7"/>`,
	コ: `
		<rect x="30" y="34" width="52" height="43" fill="#b07a46" opacity=".15"/>
		<path d="M82 36 L84 76" stroke="#ffc94d" stroke-width="7" stroke-linecap="round" opacity=".45"/>
		<path d="M70 37 h10 v10" stroke="#ff6b5a" stroke-width="2" fill="none" opacity=".7"/>`,
	サ: `
		<path d="M30 42 q20 -14 46 -6 q6 8 -6 12 h-32 q-12 -1 -8 -6z" fill="#b07a46" opacity=".35"/>
		<path d="M44 46 v18" stroke="#b07a46" stroke-width="2" opacity=".5"/>
		<path d="M4 96 q50 -8 101 0 V109 H4z" fill="#5fbf5a" opacity=".3"/>`,
	シ: `
		<circle cx="55" cy="55" r="42" fill="#ffc94d" opacity=".18"/>
		<path d="M62 98 Q84 84 98 62 M98 62 l-8 3 M98 62 l-1 8" stroke="#ff6b5a" stroke-width="2.5" stroke-linecap="round" fill="none" opacity=".85"/>
		<circle cx="22" cy="78" r="5" fill="#ff8fb1" opacity=".4"/>`,
	ス: `
		<rect x="26" y="17" width="54" height="5" rx="2.5" fill="#b07a46" opacity=".35"/>
		<rect x="82" y="80" width="16" height="6" rx="3" transform="rotate(50 90 83)" fill="#b07a46" opacity=".55"/>
		<path d="M94 64 q8 6 8 16 M18 78 q-6 4 -8 12" stroke="#4aa3ff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".6"/>`,
	セ: `
		<path d="M84 46 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2z" fill="#ffc94d" opacity=".9"/>
		<path d="M92 30 l1 -3 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1z" fill="#ffc94d" opacity=".8"/>
		<path d="M20 50 L80 38" stroke="#4aa3ff" stroke-width="8" stroke-linecap="round" opacity=".15"/>`,
	ソ: `
		<path d="M86 14 Q90 24 82 36 L44 88" stroke="#9aa0a6" stroke-width="9" fill="none" stroke-linecap="round" opacity=".3"/>
		<ellipse cx="85" cy="13" rx="2" ry="4" fill="#fff" stroke="#9aa0a6"/>
		<path d="M85 10 q16 -6 14 14 q-2 14 -10 20" stroke="#ff6b5a" stroke-width="1.5" fill="none" opacity=".7"/>
		<path d="M14 20 v14 M10 30 l4 5 l4 -5" stroke="#4aa3ff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
	タ: `
		<ellipse cx="54" cy="56" rx="26" ry="44" fill="#b38cff" opacity=".15"/>
		<path d="M40 42 L62 64" stroke="#ff8fb1" stroke-width="11" stroke-linecap="round" opacity=".45"/>
		<path d="M62 64 l8 12 M62 64 l12 4" stroke="#ff8fb1" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
	チ: `
		<circle cx="50" cy="24" r="12" fill="#ff8fb1" opacity=".35"/>
		<circle cx="64" cy="18" r="10" fill="#ff8fb1" opacity=".35"/>
		<circle cx="38" cy="30" r="8" fill="#ff8fb1" opacity=".3"/>
		<path d="M80 8 l4 -4 M86 18 l6 -1 M74 4 l1 -4" stroke="#ff8fb1" stroke-width="2" stroke-linecap="round"/>`,
	ツ: `
		<path d="M4 109 V98 Q30 100 50 92 Q80 78 98 54 Q106 50 104 62 Q100 58 96 64 Q104 86 105 109z" fill="#4aa3ff" opacity=".22"/>
		<circle cx="18" cy="22" r="2.5" fill="#4aa3ff" opacity=".7"/>
		<circle cx="42" cy="14" r="2.5" fill="#4aa3ff" opacity=".7"/>
		<circle cx="90" cy="18" r="2.5" fill="#4aa3ff" opacity=".7"/>
		<path d="M10 30 v12 M7 38 l3 4 l3 -4" stroke="#4aa3ff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
	テ: `
		<path d="M0 26 Q20 34 36 22 M77 19 Q94 28 109 22 M0 50 Q10 54 20 44 M92 39 Q100 46 109 44" stroke="#9aa0a6" stroke-width="1.5" fill="none"/>
		<path d="M58 44 Q56 70 36 90" stroke="#b07a46" stroke-width="10" fill="none" stroke-linecap="round" opacity=".3"/>
		<circle cx="100" cy="23" r="3.5" fill="#4aa3ff" opacity=".7"/>`,
	ト: `
		<rect x="37" y="12" width="18" height="84" rx="4" fill="#b07a46" opacity=".25"/>
		<circle cx="41" cy="28" r="2" fill="#ff6b5a"/><circle cx="51" cy="28" r="2" fill="#ff6b5a"/>
		<circle cx="41" cy="66" r="2" fill="#ffc94d"/><circle cx="51" cy="66" r="2" fill="#ffc94d"/>
		<path d="M74 62 q10 -10 18 -4 q-8 10 -18 4z" fill="#5fbf5a" opacity=".7"/>`,
	ナ: `
		<path d="M14 46 L90 37 Q99 40 92 46 L60 50z" fill="#9aa0a6" opacity=".35"/>
		<path d="M24 41 L86 34" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6"/>
		<path d="M56 52 Q56 80 38 94" stroke="#b07a46" stroke-width="10" fill="none" stroke-linecap="round" opacity=".35"/>`
};
