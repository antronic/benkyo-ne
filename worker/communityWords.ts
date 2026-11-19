/**
 * Words and phrases that stop a community post or reply before it is published
 * (docs/COMMUNITY.md, "Before posting"). Kept short on purpose: obvious spam and
 * a few slurs in English, Thai and Japanese. Reports and the fleet console catch
 * the rest. Matching ignores case, spaces and common look-alike characters.
 *
 * Add an entry in lowercase with no spaces.
 */
const BLOCKED = [
	// spam
	'viagra',
	'cialis',
	'onlyfans',
	'freecrypto',
	'cryptogiveaway',
	'doubleyourbitcoin',
	'casinobonus',
	'บาคาร่า',
	'สล็อตเว็บตรง',
	'เว็บพนัน',
	'ออนไลน์คาสิโน',
	'出会い系',
	'オンラインカジノ',
	// slurs
	'nigger',
	'faggot',
	'retard',
	'kike',
	'chink',
	'อีดอก',
	'กะหรี่',
	'死ね',
	'ガイジ'
];

const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

export function fold(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKC')
		.replace(/[013457@$]/g, (c) => LOOKALIKE[c] ?? c)
		.replace(/[\s\p{P}\p{S}]/gu, '');
}

/** true when the text contains a blocked word */
export function hasBlockedWords(text: string): boolean {
	const f = fold(text);
	return BLOCKED.some((w) => f.includes(fold(w)));
}
