/** Mnemonic SVG scenes (KanjiVG 109×109 box), drawn under the glyph. See mnemonics.ts. */
export const SCENES: Record<string, string> = {
	さ: `
		<circle cx="54" cy="56" r="40" fill="#ffc94d" opacity=".25"/>
		<circle cx="38" cy="40" r="3" fill="#1d1d1f" opacity=".7"/><circle cx="66" cy="34" r="3" fill="#1d1d1f" opacity=".7"/>
		<rect x="74" y="74" width="24" height="16" rx="3" fill="#4aa3ff" opacity=".4"/>
		<circle cx="86" cy="82" r="5" fill="#4aa3ff" opacity=".7"/>`,
	し: `
		<path d="M0 74 q14 -5 28 0 t28 0 t28 0 t28 0 V109 H0z" fill="#4aa3ff" opacity=".22"/>
		<path d="M68 70 q12 -10 22 0 q-10 10 -22 0z M68 70 l-7 -6 v12z" fill="#ff8fb1" opacity=".75"/>
		<circle cx="84" cy="68" r="1.6" fill="#1d1d1f"/>
		<path d="M44 4 V16" stroke="#b07a46" stroke-width="1.5" opacity=".6"/>`,
	す: `
		<path d="M22 4 L50 34 M90 4 L62 34" stroke="#b07a46" stroke-width="3" stroke-linecap="round" opacity=".5"/>
		<path d="M10 4 H100" stroke="#b07a46" stroke-width="4" stroke-linecap="round" opacity=".5"/>
		<path d="M34 96 q-14 -10 -22 -30 M86 96 q14 -10 22 -30" stroke="#4aa3ff" stroke-width="2" fill="none" stroke-dasharray="3 4" opacity=".6"/>
		<circle cx="58" cy="58" r="16" fill="#b38cff" opacity=".2"/>`,
	せ: `
		<ellipse cx="55" cy="58" rx="46" ry="34" fill="#ff6b5a" opacity=".22"/>
		<rect x="40" y="26" width="16" height="22" rx="4" fill="#fff" stroke="#1d1d1f" stroke-width="1" opacity=".85"/>
		<ellipse cx="62" cy="80" rx="18" ry="7" fill="#ff8fb1" opacity=".45"/>`,
	そ: `
		<path d="M30 102 L74 102" stroke="#b07a46" stroke-width="3" stroke-linecap="round" opacity=".4"/>
		<path d="M84 8 l12 -4 l-3 6z" fill="#9aa0a6" opacity=".7"/>
		<path d="M93 7 q8 10 -4 16" stroke="#ff6b5a" stroke-width="1.5" fill="none" stroke-dasharray="2 2" opacity=".7"/>
		<ellipse cx="56" cy="56" rx="42" ry="44" fill="#ff8fb1" opacity=".16"/>`,
	た: `
		<rect x="10" y="10" width="44" height="90" rx="8" fill="#4aa3ff" opacity=".18"/>
		<rect x="58" y="44" width="44" height="56" rx="8" fill="#ff6b5a" opacity=".18"/>
		<text x="26" y="106" font-size="9" font-family="system-ui" font-weight="700" fill="#4aa3ff">t</text>
		<text x="76" y="106" font-size="9" font-family="system-ui" font-weight="700" fill="#ff6b5a">a</text>`,
	ち: `
		<circle cx="58" cy="70" r="26" fill="#ffc94d" opacity=".3"/>
		<circle cx="52" cy="62" r="2.8" fill="#1d1d1f" opacity=".7"/><circle cx="70" cy="62" r="2.8" fill="#1d1d1f" opacity=".7"/>
		<circle cx="14" cy="18" r="9" fill="#ff8fb1" opacity=".55"/><circle cx="92" cy="20" r="9" fill="#ff8fb1" opacity=".55"/>
		<text x="70" y="104" font-size="10" font-family="system-ui" font-weight="700" fill="#e0a800">chi!</text>`,
	つ: `
		<path d="M4 40 q20 -20 50 -16 q40 4 50 26 v59 H4z" fill="#4aa3ff" opacity=".22"/>
		<path d="M0 100 q14 -6 27 0 t27 0 t27 0 t28 0 V109 H0z" fill="#4aa3ff" opacity=".4"/>
		<circle cx="40" cy="22" r="2" fill="#4aa3ff" opacity=".6"/><circle cx="58" cy="18" r="2.5" fill="#4aa3ff" opacity=".6"/>`,
	て: `
		<path d="M64 18 q20 -6 34 4 q4 8 -6 10 q-14 -2 -28 2z" fill="#ffc94d" opacity=".4"/>
		<path d="M72 12 q4 -8 8 -1 M80 12 q4 -9 8 0 M88 14 q4 -7 7 1" stroke="#e0a800" stroke-width="2" fill="none" opacity=".6"/>
		<path d="M14 30 L4 34" stroke="#b07a46" stroke-width="2" opacity=".5"/>`,
	と: `
		<path d="M20 64 q0 -20 22 -24 q40 -6 52 18 q8 34 -32 38 q-42 2 -42 -32z" fill="#ffc94d" opacity=".3"/>
		<ellipse cx="74" cy="56" rx="10" ry="7" fill="#ff8fb1" opacity=".55"/>
		<text x="80" y="12" font-size="10" font-family="system-ui" font-weight="700" fill="#ff6b5a">ow!</text>`,
	な: `
		<path d="M20 20 v26 M10 30 h20" stroke="#e0a800" stroke-width="3" stroke-linecap="round" opacity=".55"/>
		<path d="M50 50 q-2 -18 14 -24 q16 6 14 24 v50 h-28z" fill="#1d1d1f" opacity=".15"/>
		<circle cx="64" cy="40" r="7" fill="#ffc94d" opacity=".5"/>`,
	に: `
		<path d="M4 100 q6 -50 16 -76 q14 -10 18 4 q-6 30 -6 72z" fill="#ff8fb1" opacity=".22"/>
		<circle cx="22" cy="62" r="9" fill="#ff6b5a" opacity=".35"/>
		<path d="M50 34 h50 M50 76 h50" stroke="#4aa3ff" stroke-width="10" stroke-linecap="round" opacity=".15"/>`,
	ぬ: `
		<ellipse cx="56" cy="88" rx="44" ry="16" fill="#ff6b5a" opacity=".2"/>
		<path d="M14 72 q42 22 84 0" stroke="#ff6b5a" stroke-width="2" fill="none" opacity=".45"/>
		<path d="M76 4 L96 70 M86 2 L102 66" stroke="#b07a46" stroke-width="3" stroke-linecap="round" opacity=".55"/>
		<path d="M50 50 q10 -8 20 0" stroke="#ffc94d" stroke-width="3" fill="none" opacity=".7"/>`,
	ね: `
		<ellipse cx="56" cy="70" rx="40" ry="30" fill="#ffc94d" opacity=".25"/>
		<path d="M70 22 l4 -14 l8 10z M86 18 l8 -12 l4 14z" fill="#e0a800" opacity=".6"/>
		<circle cx="78" cy="26" r="2.4" fill="#e0a800"/><circle cx="92" cy="24" r="2.4" fill="#e0a800"/>
		<path d="M86 32 l12 -1 M86 32 l12 4" stroke="#b07a46" stroke-width="1" opacity=".7"/>`,
	の: `
		<circle cx="54" cy="58" r="44" fill="#ff6b5a" opacity=".28"/>
		<circle cx="54" cy="58" r="44" fill="none" stroke="#ff6b5a" stroke-width="4" opacity=".6"/>
		<path d="M24 88 L86 28" stroke="#ff6b5a" stroke-width="6" stroke-linecap="round" opacity=".35"/>`,
	は: `
		<rect x="6" y="12" width="40" height="86" rx="8" fill="#4aa3ff" opacity=".16"/>
		<rect x="50" y="12" width="54" height="86" rx="8" fill="#ff6b5a" opacity=".16"/>
		<text x="22" y="108" font-size="9" font-family="system-ui" font-weight="700" fill="#4aa3ff">H</text>
		<text x="74" y="108" font-size="9" font-family="system-ui" font-weight="700" fill="#ff6b5a">a</text>`,
	ひ: `
		<circle cx="54" cy="54" r="46" fill="#ffc94d" opacity=".28"/>
		<circle cx="36" cy="26" r="3.4" fill="#1d1d1f" opacity=".7"/><circle cx="72" cy="26" r="3.4" fill="#1d1d1f" opacity=".7"/>
		<path d="M40 62 q14 22 30 0z" fill="#ff6b5a" opacity=".35"/>
		<text x="76" y="104" font-size="9" font-family="system-ui" font-weight="700" fill="#e0a800">hee</text>`,
	ふ: `
		<path d="M10 102 L44 40 q10 -6 20 0 L100 102z" fill="#4aa3ff" opacity=".22"/>
		<path d="M36 54 q18 -10 36 0 L64 40 q-10 -6 -20 0z" fill="#fff" opacity=".7"/>
		<ellipse cx="14" cy="56" rx="12" ry="5" fill="#b38cff" opacity=".25"/><ellipse cx="94" cy="52" rx="12" ry="5" fill="#b38cff" opacity=".25"/>`,
	へ: `
		<path d="M0 74 q30 -50 60 -44 q30 10 49 46 V109 H0z" fill="#5fbf5a" opacity=".25"/>
		<circle cx="88" cy="18" r="9" fill="#ffc94d" opacity=".55"/>
		<path d="M20 90 l3 -6 l3 6z M70 92 l3 -6 l3 6z" fill="#5fbf5a" opacity=".6"/>`,
	ほ: `
		<path d="M50 50 q4 -16 26 -16 q22 0 26 16 q4 50 -26 52 q-30 -2 -26 -52z" fill="#b07a46" opacity=".25"/>
		<path d="M8 6 l14 -4 l6 10 z" fill="#ff6b5a" opacity=".6"/>
		<circle cx="28" cy="12" r="2.5" fill="#fff" stroke="#1d1d1f" stroke-width=".5"/>
		<text x="4" y="104" font-size="9" font-family="system-ui" font-weight="700" fill="#ff6b5a">ho-ho</text>`,
	ま: `
		<path d="M30 30 L56 14 L56 46z M28 52 L56 34 L56 72z" fill="#fff" stroke="#4aa3ff" stroke-width="1" opacity=".55"/>
		<path d="M14 82 q42 20 84 0 l-6 18 h-72z" fill="#b07a46" opacity=".3"/>
		<path d="M0 100 q14 -5 27 0 t27 0 t27 0 t28 0 V109 H0z" fill="#4aa3ff" opacity=".25"/>`,
	み: `
		<circle cx="54" cy="58" r="42" fill="#ff8fb1" opacity=".18"/>
		<text x="76" y="28" font-size="18" font-family="system-ui" font-weight="800" fill="#b38cff" opacity=".7">21</text>
		<path d="M10 16 l3 -8 l3 8z M18 10 l3 -8 l3 8z" fill="#ffc94d" opacity=".7"/>`,
	む: `
		<ellipse cx="50" cy="76" rx="40" ry="24" fill="#9aa0a6" opacity=".2"/>
		<ellipse cx="36" cy="78" rx="10" ry="7" fill="#1d1d1f" opacity=".18"/><ellipse cx="64" cy="70" rx="8" ry="6" fill="#1d1d1f" opacity=".18"/>
		<ellipse cx="20" cy="96" rx="8" ry="5" fill="#ff8fb1" opacity=".6"/>
		<text x="70" y="104" font-size="10" font-family="system-ui" font-weight="700" fill="#b07a46">moo</text>`,
	め: `
		<ellipse cx="56" cy="60" rx="50" ry="34" fill="#fff" stroke="#4aa3ff" stroke-width="1.5" opacity=".5"/>
		<circle cx="56" cy="62" r="18" fill="#4aa3ff" opacity=".35"/>
		<circle cx="56" cy="62" r="8" fill="#1d1d1f" opacity=".3"/>`,
	も: `
		<path d="M0 58 q14 -5 28 0 t28 0 t28 0 t28 0 V109 H0z" fill="#4aa3ff" opacity=".18"/>
		<path d="M14 34 q4 -6 8 0 t8 0 M10 54 q4 -6 8 0 t8 0" stroke="#ff8fb1" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".8"/>
		<circle cx="88" cy="40" r="4" fill="#ff6b5a" opacity=".6"/>`,
	や: `
		<ellipse cx="56" cy="70" rx="40" ry="20" fill="#b07a46" opacity=".28"/>
		<path d="M66 12 q-18 -4 -26 8 M80 16 q18 -6 24 8" stroke="#e0a800" stroke-width="4" fill="none" stroke-linecap="round" opacity=".55"/>
		<path d="M30 88 v16 M44 90 v14 M70 90 v14 M84 88 v16" stroke="#b07a46" stroke-width="4" stroke-linecap="round" opacity=".4"/>`,
	ゆ: `
		<path d="M0 82 q14 -5 28 0 t28 0 t28 0 t28 0 V109 H0z" fill="#4aa3ff" opacity=".2"/>
		<path d="M30 42 q24 -22 48 0 q-24 22 -48 0z M30 42 l-10 -8 v16z" fill="#5fbf5a" opacity=".3"/>
		<circle cx="68" cy="38" r="2.4" fill="#1d1d1f" opacity=".7"/>`,
	よ: `
		<circle cx="46" cy="80" r="20" fill="#ff6b5a" opacity=".3"/>
		<circle cx="46" cy="80" r="6" fill="#ff6b5a" opacity=".5"/>
		<path d="M52 4 q-2 4 0 8" stroke="#b07a46" stroke-width="1.5" fill="none" opacity=".6"/>
		<path d="M80 98 q8 -4 10 -12" stroke="#9aa0a6" stroke-width="1.5" fill="none" stroke-dasharray="2 3"/>`,
	ら: `
		<ellipse cx="54" cy="74" rx="34" ry="28" fill="#fff" stroke="#1d1d1f" stroke-width=".8" opacity=".5"/>
		<path d="M40 8 q-8 18 -2 40 q10 -20 2 -40z" fill="#ff8fb1" opacity=".5"/>
		<circle cx="62" cy="64" r="2.6" fill="#1d1d1f" opacity=".7"/><circle cx="56" cy="74" r="2" fill="#ff8fb1"/>`,
	り: `
		<path d="M0 102 q27 -8 54 0 t55 0 V109 H0z" fill="#4aa3ff" opacity=".25"/>
		<ellipse cx="38" cy="22" rx="4" ry="10" fill="#b07a46" opacity=".55"/><ellipse cx="74" cy="16" rx="4" ry="10" fill="#b07a46" opacity=".55"/>
		<path d="M14 100 q4 -30 -4 -60 M96 100 q4 -30 10 -54" stroke="#5fbf5a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>`,
	る: `
		<path d="M0 30 h109 M0 100 h109" stroke="#9aa0a6" stroke-width="1" stroke-dasharray="4 4" opacity=".5"/>
		<circle cx="56" cy="80" r="18" fill="#5fbf5a" opacity=".22"/>
		<path d="M24 10 v12 l10 -4 l-10 -4" fill="#ff6b5a" opacity=".6"/>
		<circle cx="58" cy="82" r="3" fill="#ff6b5a" opacity=".7"/>`,
	れ: `
		<path d="M64 0 L109 0 L109 30 Z" fill="#ffc94d" opacity=".3"/>
		<circle cx="100" cy="10" r="6" fill="#ffc94d" opacity=".7"/>
		<circle cx="26" cy="30" r="8" fill="#ffc94d" opacity=".4"/>
		<ellipse cx="54" cy="102" rx="44" ry="5" fill="#b07a46" opacity=".25"/>`,
	ろ: `
		<path d="M0 82 C30 72 70 108 109 96 V109 H0z" fill="#9aa0a6" opacity=".25"/>
		<path d="M20 98 l10 -2 M48 95 l10 0 M78 100 l10 -2" stroke="#ffc94d" stroke-width="2" stroke-linecap="round" opacity=".8"/>
		<circle cx="90" cy="16" r="7" fill="#5fbf5a" opacity=".4"/><path d="M90 22 v14" stroke="#b07a46" stroke-width="2" opacity=".5"/>`,
	わ: `
		<circle cx="62" cy="64" r="36" fill="#ff8fb1" opacity=".22"/>
		<path d="M54 50 q4 -4 8 0 M74 50 q4 -4 8 0" stroke="#1d1d1f" stroke-width="1.5" fill="none" opacity=".6"/>
		<path d="M56 54 v12 M80 54 v12" stroke="#4aa3ff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
		<text x="74" y="16" font-size="11" font-family="system-ui" font-weight="700" fill="#ff8fb1">wah</text>`,
	を: `
		<circle cx="46" cy="10" r="7" fill="#ffc94d" opacity=".45"/>
		<path d="M18 24 l-10 -6 M94 46 l10 -4" stroke="#ff6b5a" stroke-width="2" stroke-linecap="round" opacity=".6"/>
		<ellipse cx="60" cy="72" rx="34" ry="30" fill="#4aa3ff" opacity=".16"/>
		<text x="78" y="18" font-size="10" font-family="system-ui" font-weight="700" fill="#4aa3ff">whoa</text>`,
	ん: `
		<path d="M4 98 h100" stroke="#4aa3ff" stroke-width="1.2" opacity=".5"/>
		<path d="M4 60 h100" stroke="#4aa3ff" stroke-width="1" stroke-dasharray="4 4" opacity=".45"/>
		<text x="80" y="54" font-size="20" font-family="Georgia,serif" font-style="italic" fill="#b38cff" opacity=".7">n</text>`,
};
