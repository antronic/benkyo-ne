/**
 * Topic courses shown in Learn (alongside the kana "Fundamentals").
 * Each unit is ~6 high-value words/phrases. Items are checked against the
 * dictionary when a unit is opened (unverified ones are badged).
 */
import type { CardKind } from '#lib/ai/contract.ts';

export interface CourseItem {
	/** kana shown on the card front (D17) */
	reading: string;
	/** written form when it uses kanji */
	kanji?: string;
	gloss: string;
	kind: CardKind;
	/** when / how to use it */
	note?: string;
}

export interface Unit {
	id: string;
	title: string;
	items: CourseItem[];
}

export interface Course {
	id: 'travel' | 'friends' | 'japanglish';
	title: string;
	emoji: string;
	blurb: string;
	hue: number;
	units: Unit[];
}

const w = (reading: string, gloss: string, kanji?: string, note?: string): CourseItem => ({ reading, gloss, kanji, kind: 'word', note });
const p = (reading: string, gloss: string, kanji?: string, note?: string): CourseItem => ({ reading, gloss, kanji, kind: 'phrase', note });

export const COURSES: Course[] = [
	{
		id: 'travel',
		title: 'Travel',
		emoji: '✈️',
		blurb: 'Get around, eat, shop and stay with confidence.',
		hue: 200,
		units: [
			{
				id: 'basics',
				title: 'Survival basics',
				items: [
					p('すみません', 'excuse me; sorry; thank you', '済みません', 'Gets attention, apologises and thanks: the most useful word in Japan.'),
					p('ありがとうございます', 'thank you very much', '有難うございます'),
					w('はい', 'yes'),
					w('いいえ', 'no'),
					p('おねがいします', 'please', 'お願いします', 'Add it after a noun to ask for it: みず、おねがいします.'),
					w('だいじょうぶ', 'okay; all right; no thank you', '大丈夫', 'だいじょうぶです = I’m fine / it’s okay / no thanks.')
				]
			},
			{
				id: 'around',
				title: 'Getting around',
				items: [
					w('えき', 'station', '駅'),
					w('きっぷ', 'ticket', '切符'),
					w('でんしゃ', 'train', '電車'),
					p('トイレはどこですか', 'where is the toilet?', undefined, 'Swap トイレ for any place: えきはどこですか.'),
					w('みぎ', 'right', '右'),
					w('ひだり', 'left', '左')
				]
			},
			{
				id: 'food',
				title: 'Eating out',
				items: [
					p('これをください', 'this one, please', 'これを下さい', 'Point at the menu and say it.'),
					w('おいしい', 'delicious', '美味しい'),
					w('みず', 'water', '水'),
					w('おかいけい', 'the bill; check', 'お会計'),
					p('いただきます', 'let’s eat (said before eating)', '頂きます'),
					p('ごちそうさまでした', 'thank you for the meal (after eating)', 'ご馳走様でした')
				]
			},
			{
				id: 'shopping',
				title: 'Shopping & hotel',
				items: [
					p('いくらですか', 'how much is it?'),
					w('げんきん', 'cash', '現金'),
					w('カード', 'card (credit card)'),
					w('よやく', 'reservation; booking', '予約'),
					w('へや', 'room', '部屋'),
					w('チェックイン', 'check-in')
				]
			}
		]
	},
	{
		id: 'friends',
		title: 'Make friends',
		emoji: '🤝',
		blurb: 'Greet, introduce yourself and keep a conversation going.',
		hue: 330,
		units: [
			{
				id: 'greetings',
				title: 'Greetings',
				items: [
					p('おはようございます', 'good morning'),
					p('こんにちは', 'hello; good afternoon', '今日は'),
					p('こんばんは', 'good evening', '今晩は'),
					p('はじめまして', 'nice to meet you (first meeting)', '初めまして'),
					p('よろしくおねがいします', 'pleased to meet you; I look forward to working with you', 'よろしくお願いします', 'Say it after introducing yourself.'),
					p('またね', 'see you!', undefined, 'Casual, with friends.')
				]
			},
			{
				id: 'about-me',
				title: 'About me',
				items: [
					w('なまえ', 'name', '名前'),
					w('しごと', 'job; work', '仕事'),
					w('しゅみ', 'hobby', '趣味'),
					w('ともだち', 'friend', '友達'),
					w('にほんご', 'Japanese (language)', '日本語'),
					p('どこからきましたか', 'where are you from?', 'どこから来ましたか')
				]
			},
			{
				id: 'small-talk',
				title: 'Small talk',
				items: [
					w('すき', 'liked; favourite', '好き', '〜がすきです = I like 〜.'),
					w('たのしい', 'fun; enjoyable', '楽しい'),
					w('すごい', 'amazing; great'),
					w('ほんとう', 'truth; really', '本当', 'ほんとう？ = really?'),
					w('いっしょに', 'together', '一緒に'),
					p('またあいましょう', 'let’s meet again', 'また会いましょう')
				]
			}
		]
	},
	{
		id: 'japanglish',
		title: 'Japanglish',
		emoji: '🍔',
		blurb: 'Loanwords from English: easy wins and katakana practice.',
		hue: 35,
		units: [
			{
				id: 'food-drink',
				title: 'Food & drink',
				items: [
					w('コーヒー', 'coffee'),
					w('ジュース', 'juice; soft drink'),
					w('ビール', 'beer'),
					w('パン', 'bread', undefined, 'From Portuguese “pão”.'),
					w('ケーキ', 'cake'),
					w('アイスクリーム', 'ice cream')
				]
			},
			{
				id: 'daily',
				title: 'Daily life',
				items: [
					w('スマホ', 'smartphone', undefined, 'Short for スマートフォン.'),
					w('パソコン', 'personal computer', undefined, 'Short for パーソナルコンピューター.'),
					w('コンビニ', 'convenience store'),
					w('テレビ', 'television'),
					w('エアコン', 'air conditioner'),
					w('アプリ', 'app')
				]
			},
			{
				id: 'out',
				title: 'Out & about',
				items: [
					w('ホテル', 'hotel'),
					w('タクシー', 'taxi'),
					w('レストラン', 'restaurant'),
					w('デパート', 'department store'),
					w('チケット', 'ticket'),
					w('メニュー', 'menu')
				]
			},
			{
				id: 'made-in-japan',
				title: 'Made in Japan',
				items: [
					w('サラリーマン', 'office worker (salaried man)', undefined, 'English-looking, but coined in Japan.'),
					w('マンション', 'apartment; condominium', undefined, 'Not a mansion!'),
					w('ノートパソコン', 'laptop', undefined, 'From “notebook PC”.'),
					w('ガソリンスタンド', 'petrol station; gas station'),
					w('マイペース', 'doing things at one’s own pace'),
					w('ペーパードライバー', 'licensed driver who rarely drives')
				]
			}
		]
	}
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id);

/** Hidden system tags (never shown as user tags). */
export const NOW_TAG = '~now';
export const courseTag = (course: string, unit: string) => `~course:${course}/${unit}`;
export const isSystemTag = (t: string) => t.startsWith('~');
