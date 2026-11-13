export { isReadable, unknownKanaIn, isKanaText } from '#lib/dict/readable.ts';
export {
	lookupJapanese,
	lookupJapaneseResult,
	lookupRomaji,
	romajiCandidates,
	lookupEnglish,
	getGlosses,
	verifyText,
	verifyItem,
	fold,
	type DictHit,
	type LookupResult,
	type VerifyToken,
	type VerifyTextResult,
	type VerifyItemResult
} from '#lib/dict/dict.ts';
export { pickPackWords, toFillItems, type PackPick } from '#lib/dict/packs.ts';
export { DICT_ATTRIBUTION, DICT_CREDITS } from '#lib/dict/attribution.ts';
