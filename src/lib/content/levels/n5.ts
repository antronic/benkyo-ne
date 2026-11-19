/**
 * JLPT N5 level units. AI draft, not yet reviewed: every unit's `review` is
 * null until a reviewer checks it (docs/LEVELS.md, "Review").
 *
 * Rules the tests enforce (levels.test.ts): every word is in JMdict with its
 * reading, every kanji in a Japanese line is an N5 kanji on Jonathan Waller's
 * list or one the kanji lessons already teach, every English line has Thai,
 * and every answer index points at a choice.
 */
import type { LevelUnit } from './types.ts';

const DRAFT = { ja: null, th: null };
const SOURCE = 'ai-draft 2026-11-19';

export const N5_UNITS: LevelUnit[] = [
	{
		id: 'n5-01',
		level: 'N5',
		title: { en: 'Nice to meet you', th: 'ยินดีที่ได้รู้จัก' },
		goal: { en: 'Say who you are and ask who someone is.', th: 'บอกว่าตัวเองเป็นใคร และถามว่าอีกฝ่ายเป็นใคร' },
		kanji: ['名', '前', '生'],
		words: [
			{ reading: 'わたし', kanji: '私', gloss: { en: 'I; me', th: 'ฉัน; ผม' }, kind: 'word' },
			{ reading: 'なまえ', kanji: '名前', gloss: { en: 'name', th: 'ชื่อ' }, kind: 'word' },
			{ reading: 'がくせい', kanji: '学生', gloss: { en: 'student', th: 'นักเรียน; นักศึกษา' }, kind: 'word' },
			{ reading: 'せんせい', kanji: '先生', gloss: { en: 'teacher', th: 'ครู; อาจารย์' }, kind: 'word' },
			{ reading: 'かいしゃいん', kanji: '会社員', gloss: { en: 'office worker', th: 'พนักงานบริษัท' }, kind: 'word' },
			{ reading: 'にほんじん', kanji: '日本人', gloss: { en: 'Japanese person', th: 'คนญี่ปุ่น' }, kind: 'word' },
			{ reading: 'ともだち', kanji: '友達', gloss: { en: 'friend', th: 'เพื่อน' }, kind: 'word' },
			{ reading: 'だれ', kanji: '誰', gloss: { en: 'who', th: 'ใคร' }, kind: 'word' },
			{ reading: 'なに', kanji: '何', gloss: { en: 'what', th: 'อะไร' }, kind: 'word' },
			{ reading: 'ひと', kanji: '人', gloss: { en: 'person', th: 'คน' }, kind: 'word' },
			{ reading: 'いしゃ', kanji: '医者', gloss: { en: 'doctor', th: 'หมอ; แพทย์' }, kind: 'word' },
			{ reading: 'はじめまして', kanji: '初めまして', gloss: { en: 'nice to meet you', th: 'ยินดีที่ได้รู้จัก' }, kind: 'phrase' }
		],
		grammar: [
			{
				id: 'n5-wa-desu',
				pattern: '〜は〜です',
				formation: 'N1 は N2 です',
				meaning: { en: 'N1 is N2', th: 'N1 คือ / เป็น N2' },
				note: {
					en: 'は is read “wa” when it is a particle. It marks what you are talking about. です makes the sentence polite, for men and women alike.',
					th: 'は อ่านว่า “วะ” เมื่อเป็นคำช่วย ใช้บอกเรื่องที่กำลังพูดถึง です ทำให้ประโยคสุภาพ ใช้ได้ทั้งผู้ชายและผู้หญิง ต่างจาก ครับ/ค่ะ'
				},
				examples: [
					{ ja: 'わたしはがくせいです。', en: 'I am a student.', th: 'ฉันเป็นนักเรียน' },
					{ ja: '山田さんは先生です。', en: 'Ms Yamada is a teacher.', th: 'คุณยามาดะเป็นครู' },
					{ ja: 'わたしの名前はナリンです。', en: 'My name is Narin.', th: 'ฉันชื่อนาริน' },
					{ ja: 'リンさんはタイ人です。', en: 'Lin is Thai.', th: 'คุณลินเป็นคนไทย' },
					{ ja: 'ジョンさんはアメリカ人です。', en: 'John is American.', th: 'คุณจอห์นเป็นคนอเมริกัน' }
				]
			},
			{
				id: 'n5-ja-arimasen',
				pattern: '〜じゃありません',
				formation: 'N1 は N2 じゃありません',
				meaning: { en: 'N1 is not N2', th: 'N1 ไม่ใช่ N2' },
				note: {
					en: 'ではありません means the same and sounds more formal, as in writing. じゃないです is a softer, everyday polite form.',
					th: 'ではありません ความหมายเดียวกันแต่เป็นทางการกว่า มักใช้ในภาษาเขียน ส่วน じゃないです เป็นแบบสุภาพที่ใช้ในชีวิตประจำวัน'
				},
				examples: [
					{ ja: 'わたしは先生じゃありません。', en: 'I am not a teacher.', th: 'ฉันไม่ใช่ครู' },
					{ ja: 'リンさんは日本人じゃありません。', en: 'Lin is not Japanese.', th: 'คุณลินไม่ใช่คนญี่ปุ่น' },
					{ ja: '山田さんはがくせいじゃありません。かいしゃいんです。', en: 'Mr Yamada is not a student. He is an office worker.', th: 'คุณยามาดะไม่ใช่นักเรียน เป็นพนักงานบริษัท' },
					{ ja: 'これはわたしの本じゃありません。', en: 'This is not my book.', th: 'นี่ไม่ใช่หนังสือของฉัน' },
					{ ja: 'わたしはいしゃではありません。', en: 'I am not a doctor. (formal)', th: 'ฉันไม่ใช่หมอ (แบบทางการ)' }
				]
			},
			{
				id: 'n5-ka',
				pattern: '〜か',
				formation: 'sentence + か',
				meaning: { en: 'turns a sentence into a question', th: 'ทำให้ประโยคเป็นคำถาม (…ไหม / …หรือเปล่า)' },
				note: {
					en: 'No question mark is needed: か does the job. Answer with はい、そうです (yes) or いいえ、ちがいます (no).',
					th: 'ไม่ต้องใส่เครื่องหมายคำถาม เพราะ か ทำหน้าที่นั้นแล้ว ตอบว่า はい、そうです (ใช่) หรือ いいえ、ちがいます (ไม่ใช่)'
				},
				examples: [
					{ ja: 'リンさんはがくせいですか。', en: 'Are you a student, Lin?', th: 'คุณลินเป็นนักเรียนไหม' },
					{ ja: 'はい、そうです。', en: 'Yes, that’s right.', th: 'ใช่ ถูกต้อง' },
					{ ja: '先生はタイ人ですか。', en: 'Is the teacher Thai?', th: 'ครูเป็นคนไทยไหม' },
					{ ja: 'いいえ、ちがいます。日本人です。', en: 'No. She is Japanese.', th: 'ไม่ใช่ เป็นคนญี่ปุ่น' },
					{ ja: 'お名前は何ですか。', en: 'What is your name?', th: 'คุณชื่ออะไร' }
				]
			}
		],
		reading: {
			title: { en: 'First day of class', th: 'วันแรกของคลาส' },
			lines: [
				{ ja: 'リン：はじめまして。リンです。タイ人です。', en: 'Lin: Nice to meet you. I’m Lin. I’m Thai.', th: 'ลิน: ยินดีที่ได้รู้จักค่ะ ฉันชื่อลิน เป็นคนไทยค่ะ' },
				{ ja: '山田：はじめまして。山田です。リンさんはがくせいですか。', en: 'Yamada: Nice to meet you. I’m Yamada. Are you a student, Lin?', th: 'ยามาดะ: ยินดีที่ได้รู้จักครับ ผมยามาดะ คุณลินเป็นนักเรียนไหมครับ' },
				{ ja: 'リン：はい、そうです。山田さんは先生ですか。', en: 'Lin: Yes, I am. Are you a teacher, Mr Yamada?', th: 'ลิน: ใช่ค่ะ คุณยามาดะเป็นครูไหมคะ' },
				{ ja: '山田：いいえ、先生じゃありません。かいしゃいんです。', en: 'Yamada: No, I’m not a teacher. I’m an office worker.', th: 'ยามาดะ: ไม่ใช่ครับ ผมไม่ใช่ครู เป็นพนักงานบริษัทครับ' },
				{ ja: 'リン：そうですか。よろしくおねがいします。', en: 'Lin: I see. Pleased to meet you.', th: 'ลิน: อย่างนั้นเหรอคะ ยินดีที่ได้รู้จักค่ะ' }
			],
			questions: [
				{
					q: { en: 'Where is Lin from?', th: 'ลินมาจากประเทศอะไร' },
					choices: [
						{ en: 'Thailand', th: 'ไทย' },
						{ en: 'Japan', th: 'ญี่ปุ่น' },
						{ en: 'America', th: 'อเมริกา' }
					],
					answer: 0
				},
				{
					q: { en: 'What does Mr Yamada do?', th: 'คุณยามาดะทำอาชีพอะไร' },
					choices: [
						{ en: 'He is a teacher.', th: 'เป็นครู' },
						{ en: 'He is an office worker.', th: 'เป็นพนักงานบริษัท' },
						{ en: 'He is a student.', th: 'เป็นนักเรียน' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-02',
		level: 'N5',
		title: { en: 'This and that', th: 'นี่และนั่น' },
		goal: { en: 'Point at things, ask what they are and whose they are.', th: 'ชี้สิ่งของ ถามว่าคืออะไร และเป็นของใคร' },
		kanji: ['何', '語', '国'],
		words: [
			{ reading: 'これ', gloss: { en: 'this (near me)', th: 'นี่ (ใกล้ผู้พูด)' }, kind: 'word' },
			{ reading: 'それ', gloss: { en: 'that (near you)', th: 'นั่น (ใกล้ผู้ฟัง)' }, kind: 'word' },
			{ reading: 'どれ', gloss: { en: 'which one (of three or more)', th: 'อันไหน (ตั้งแต่สามอย่างขึ้นไป)' }, kind: 'word' },
			{ reading: 'ほん', kanji: '本', gloss: { en: 'book', th: 'หนังสือ' }, kind: 'word' },
			{ reading: 'じしょ', kanji: '辞書', gloss: { en: 'dictionary', th: 'พจนานุกรม' }, kind: 'word' },
			{ reading: 'かさ', kanji: '傘', gloss: { en: 'umbrella', th: 'ร่ม' }, kind: 'word' },
			{ reading: 'かばん', kanji: '鞄', gloss: { en: 'bag', th: 'กระเป๋า' }, kind: 'word' },
			{ reading: 'とけい', kanji: '時計', gloss: { en: 'watch; clock', th: 'นาฬิกา' }, kind: 'word' },
			{ reading: 'くるま', kanji: '車', gloss: { en: 'car', th: 'รถยนต์' }, kind: 'word' },
			{ reading: 'にほんご', kanji: '日本語', gloss: { en: 'Japanese (language)', th: 'ภาษาญี่ปุ่น' }, kind: 'word' },
			{ reading: 'えいご', kanji: '英語', gloss: { en: 'English (language)', th: 'ภาษาอังกฤษ' }, kind: 'word' },
			{ reading: 'くに', kanji: '国', gloss: { en: 'country', th: 'ประเทศ' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-kore',
				pattern: 'これ・それ・あれ',
				formation: 'これ / それ / あれ は N です',
				meaning: { en: 'this (near me) / that (near you) / that (over there)', th: 'นี่ / นั่น / โน่น' },
				note: {
					en: 'これ is near the speaker, それ near the listener, あれ far from both. Ask with 何: これは何ですか.',
					th: 'ภาษาไทยแบ่งสามระยะแบบเดียวกัน: これ = นี่ (ใกล้ผู้พูด) それ = นั่น (ใกล้ผู้ฟัง) あれ = โน่น (ไกลจากทั้งคู่)'
				},
				examples: [
					{ ja: 'これは本です。', en: 'This is a book.', th: 'นี่คือหนังสือ' },
					{ ja: 'それはかさですか。', en: 'Is that an umbrella?', th: 'นั่นคือร่มไหม' },
					{ ja: 'あれは何ですか。', en: 'What is that over there?', th: 'โน่นคืออะไร' },
					{ ja: 'あれは車です。', en: 'That over there is a car.', th: 'โน่นคือรถยนต์' },
					{ ja: 'これはじしょじゃありません。', en: 'This isn’t a dictionary.', th: 'นี่ไม่ใช่พจนานุกรม' }
				]
			},
			{
				id: 'n5-kono',
				pattern: 'この・その・あの',
				formation: 'この / その / あの + N',
				meaning: { en: 'this N / that N / that N over there', th: 'N นี้ / N นั้น / N โน้น' },
				note: {
					en: 'この always needs a noun after it; これ stands alone. この本 = this book.',
					th: 'この ต้องมีคำนามตามหลังเสมอ ส่วน これ ใช้เดี่ยว ๆ ได้ ภาษาไทยวาง “นี้” หลังคำนาม (หนังสือเล่มนี้) แต่ภาษาญี่ปุ่นวาง この ไว้หน้าคำนาม (この本)'
				},
				examples: [
					{ ja: 'この本は日本語の本です。', en: 'This book is a Japanese book.', th: 'หนังสือเล่มนี้เป็นหนังสือภาษาญี่ปุ่น' },
					{ ja: 'そのかさはわたしのです。', en: 'That umbrella is mine.', th: 'ร่มคันนั้นเป็นของฉัน' },
					{ ja: 'あの人はだれですか。', en: 'Who is that person over there?', th: 'คนโน้นคือใคร' },
					{ ja: 'この車は日本の車です。', en: 'This car is a Japanese car.', th: 'รถคันนี้เป็นรถญี่ปุ่น' },
					{ ja: 'あの先生はタイ人です。', en: 'That teacher over there is Thai.', th: 'ครูคนโน้นเป็นคนไทย' }
				]
			},
			{
				id: 'n5-no',
				pattern: '〜の〜',
				formation: 'N1 の N2',
				meaning: { en: 'N2 of N1: owner, origin or kind', th: 'N2 ของ N1 (เจ้าของ ที่มา หรือประเภท)' },
				note: {
					en: 'The order is the reverse of English “of”: わたしの本 is “my book”. When the noun is clear, drop it: わたしのです = it’s mine.',
					th: 'ลำดับกลับกันกับภาษาไทย: わたしの本 = หนังสือของฉัน ถ้ารู้แล้วว่าพูดถึงอะไร ตัดคำนามหลังออกได้: わたしのです = เป็นของฉัน'
				},
				examples: [
					{ ja: 'これはわたしの本です。', en: 'This is my book.', th: 'นี่คือหนังสือของฉัน' },
					{ ja: '山田さんのかさはあれです。', en: 'Mr Yamada’s umbrella is that one over there.', th: 'ร่มของคุณยามาดะคือคันโน้น' },
					{ ja: 'それは日本語の本ですか。', en: 'Is that a book in Japanese?', th: 'นั่นเป็นหนังสือภาษาญี่ปุ่นไหม' },
					{ ja: '先生の国はどこですか。', en: 'Which country is the teacher from?', th: 'ครูมาจากประเทศอะไร' },
					{ ja: 'そのとけいはわたしのじゃありません。', en: 'That watch isn’t mine.', th: 'นาฬิกาเรือนนั้นไม่ใช่ของฉัน' }
				]
			}
		],
		reading: {
			title: { en: 'Whose is it?', th: 'เป็นของใคร' },
			lines: [
				{ ja: 'A：これは何ですか。', en: 'A: What is this?', th: 'A: นี่คืออะไร' },
				{ ja: 'B：それは日本語のじしょです。', en: 'B: That’s a Japanese dictionary.', th: 'B: นั่นคือพจนานุกรมภาษาญี่ปุ่น' },
				{ ja: 'A：だれのじしょですか。', en: 'A: Whose dictionary is it?', th: 'A: เป็นพจนานุกรมของใคร' },
				{ ja: 'B：山田先生のです。', en: 'B: It’s Professor Yamada’s.', th: 'B: ของอาจารย์ยามาดะ' },
				{ ja: 'A：あのかさはだれのですか。', en: 'A: Whose is that umbrella over there?', th: 'A: ร่มคันโน้นเป็นของใคร' },
				{ ja: 'B：あれはわたしのです。', en: 'B: That one’s mine.', th: 'B: คันโน้นเป็นของฉัน' }
			],
			questions: [
				{
					q: { en: 'Whose is the dictionary?', th: 'พจนานุกรมเป็นของใคร' },
					choices: [
						{ en: 'Professor Yamada’s', th: 'ของอาจารย์ยามาดะ' },
						{ en: 'B’s, the one answering', th: 'ของ B (คนที่ตอบ)' },
						{ en: 'A’s, the one asking', th: 'ของ A (คนที่ถาม)' }
					],
					answer: 0
				},
				{
					q: { en: 'Whose is the umbrella?', th: 'ร่มเป็นของใคร' },
					choices: [
						{ en: 'Professor Yamada’s', th: 'ของอาจารย์ยามาดะ' },
						{ en: 'B’s, the one answering', th: 'ของ B (คนที่ตอบ)' },
						{ en: 'A’s, the one asking', th: 'ของ A (คนที่ถาม)' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-03',
		level: 'N5',
		title: { en: 'Where is it?', th: 'อยู่ที่ไหน' },
		goal: { en: 'Ask where something is and say what is where.', th: 'ถามว่าสิ่งของอยู่ที่ไหน และบอกว่ามีอะไรอยู่ตรงไหน' },
		kanji: ['右', '左', '外'],
		words: [
			{ reading: 'どこ', gloss: { en: 'where', th: 'ที่ไหน' }, kind: 'word' },
			{ reading: 'えき', kanji: '駅', gloss: { en: 'station', th: 'สถานีรถไฟ' }, kind: 'word' },
			{ reading: 'みせ', kanji: '店', gloss: { en: 'shop', th: 'ร้าน' }, kind: 'word' },
			{ reading: 'いえ', kanji: '家', gloss: { en: 'house; home', th: 'บ้าน' }, kind: 'word' },
			{ reading: 'つくえ', kanji: '机', gloss: { en: 'desk', th: 'โต๊ะ' }, kind: 'word' },
			{ reading: 'いす', kanji: '椅子', gloss: { en: 'chair', th: 'เก้าอี้' }, kind: 'word' },
			{ reading: 'ねこ', kanji: '猫', gloss: { en: 'cat', th: 'แมว' }, kind: 'word' },
			{ reading: 'いぬ', kanji: '犬', gloss: { en: 'dog', th: 'สุนัข; หมา' }, kind: 'word' },
			{ reading: 'みぎ', kanji: '右', gloss: { en: 'right', th: 'ขวา' }, kind: 'word' },
			{ reading: 'ひだり', kanji: '左', gloss: { en: 'left', th: 'ซ้าย' }, kind: 'word' },
			{ reading: 'そと', kanji: '外', gloss: { en: 'outside', th: 'ข้างนอก' }, kind: 'word' },
			{ reading: 'うえ', kanji: '上', gloss: { en: 'on; above', th: 'บน; ข้างบน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-koko',
				pattern: 'ここ・そこ・あそこ・どこ',
				formation: 'ここ / そこ / あそこ は N です ・ N は どこですか',
				meaning: { en: 'here / there / over there / where', th: 'ที่นี่ / ที่นั่น / ที่โน่น / ที่ไหน' },
				note: {
					en: 'The same split as これ・それ・あれ, for places.',
					th: 'แบ่งระยะแบบเดียวกับ これ・それ・あれ แต่ใช้กับสถานที่'
				},
				examples: [
					{ ja: 'ここはえきです。', en: 'This is the station.', th: 'ที่นี่คือสถานี' },
					{ ja: 'トイレはどこですか。', en: 'Where is the toilet?', th: 'ห้องน้ำอยู่ที่ไหน' },
					{ ja: 'トイレはあそこです。', en: 'The toilet is over there.', th: 'ห้องน้ำอยู่ที่โน่น' },
					{ ja: '山田さんのいえはどこですか。', en: 'Where is Mr Yamada’s house?', th: 'บ้านของคุณยามาดะอยู่ที่ไหน' },
					{ ja: 'そこはわたしのいすです。', en: 'That’s my chair.', th: 'ตรงนั้นคือเก้าอี้ของฉัน' }
				]
			},
			{
				id: 'n5-aru-iru',
				pattern: 'あります・います',
				formation: 'N が あります (things) ・ N が います (people, animals)',
				meaning: { en: 'there is / there are', th: 'มี' },
				note: {
					en: 'あります is for things that don’t move by themselves; います for people and animals.',
					th: 'ภาษาไทยใช้ “มี” คำเดียว แต่ภาษาญี่ปุ่นแยก: あります ใช้กับสิ่งของ います ใช้กับคนและสัตว์'
				},
				examples: [
					{ ja: 'つくえがあります。', en: 'There is a desk.', th: 'มีโต๊ะ' },
					{ ja: 'ねこがいます。', en: 'There is a cat.', th: 'มีแมว' },
					{ ja: '先生がいます。', en: 'The teacher is here.', th: 'มีครูอยู่' },
					{ ja: '本がありません。', en: 'There are no books.', th: 'ไม่มีหนังสือ' },
					{ ja: 'いぬはいませんか。', en: 'Isn’t there a dog?', th: 'ไม่มีสุนัขเหรอ' }
				]
			},
			{
				id: 'n5-ni-aru',
				pattern: '〜に〜があります',
				formation: 'place に N が あります / います ・ N は place に あります / います',
				meaning: { en: 'N is at a place', th: 'N อยู่ที่ (สถานที่)' },
				note: {
					en: 'に marks where something is. Put the thing first with は when it is already the topic: ねこはいすの下にいます.',
					th: 'に บอกตำแหน่งที่สิ่งนั้นอยู่ ถ้าสิ่งนั้นเป็นเรื่องที่กำลังพูดถึงอยู่แล้ว ให้ขึ้นต้นด้วย は: ねこはいすの下にいます (แมวอยู่ใต้เก้าอี้)'
				},
				examples: [
					{ ja: 'つくえの上に本があります。', en: 'There is a book on the desk.', th: 'มีหนังสืออยู่บนโต๊ะ' },
					{ ja: 'いすの下にねこがいます。', en: 'There is a cat under the chair.', th: 'มีแมวอยู่ใต้เก้าอี้' },
					{ ja: 'えきの右にみせがあります。', en: 'There is a shop to the right of the station.', th: 'มีร้านอยู่ทางขวาของสถานี' },
					{ ja: '山田さんはいえの中にいます。', en: 'Mr Yamada is in the house.', th: 'คุณยามาดะอยู่ในบ้าน' },
					{ ja: 'いぬは外にいます。', en: 'The dog is outside.', th: 'สุนัขอยู่ข้างนอก' }
				]
			}
		],
		reading: {
			title: { en: 'Excuse me, where is…?', th: 'ขอโทษค่ะ … อยู่ที่ไหน' },
			lines: [
				{ ja: 'A：すみません、トイレはどこですか。', en: 'A: Excuse me, where is the toilet?', th: 'A: ขอโทษค่ะ ห้องน้ำอยู่ที่ไหนคะ' },
				{ ja: 'B：トイレですか。あそこです。', en: 'B: The toilet? It’s over there.', th: 'B: ห้องน้ำเหรอครับ อยู่ที่โน่นครับ' },
				{ ja: 'A：あのみせの右ですか。', en: 'A: To the right of that shop?', th: 'A: ทางขวาของร้านโน้นเหรอคะ' },
				{ ja: 'B：いいえ、左です。みせの左にあります。', en: 'B: No, the left. It’s to the left of the shop.', th: 'B: ไม่ใช่ครับ ทางซ้าย อยู่ทางซ้ายของร้านครับ' },
				{ ja: 'A：ありがとうございます。', en: 'A: Thank you.', th: 'A: ขอบคุณค่ะ' }
			],
			questions: [
				{
					q: { en: 'Where is the toilet?', th: 'ห้องน้ำอยู่ที่ไหน' },
					choices: [
						{ en: 'To the right of the shop', th: 'ทางขวาของร้าน' },
						{ en: 'To the left of the shop', th: 'ทางซ้ายของร้าน' },
						{ en: 'Inside the station', th: 'ในสถานี' }
					],
					answer: 1
				},
				{
					q: { en: 'What is A looking for?', th: 'A กำลังหาอะไร' },
					choices: [
						{ en: 'The toilet', th: 'ห้องน้ำ' },
						{ en: 'The station', th: 'สถานี' },
						{ en: 'A shop', th: 'ร้าน' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-04',
		level: 'N5',
		title: { en: 'Time and prices', th: 'เวลาและราคา' },
		goal: { en: 'Tell the time, ask prices and say opening hours.', th: 'บอกเวลา ถามราคา และบอกเวลาเปิดปิด' },
		kanji: ['時', '半', '円', '午', '百'],
		words: [
			{ reading: 'いま', kanji: '今', gloss: { en: 'now', th: 'ตอนนี้' }, kind: 'word' },
			{ reading: 'なんじ', kanji: '何時', gloss: { en: 'what time', th: 'กี่โมง' }, kind: 'word' },
			{ reading: 'じかん', kanji: '時間', gloss: { en: 'time; hours', th: 'เวลา; ชั่วโมง' }, kind: 'word' },
			{ reading: 'はん', kanji: '半', gloss: { en: 'half; half past', th: 'ครึ่ง' }, kind: 'word' },
			{ reading: 'ごぜん', kanji: '午前', gloss: { en: 'morning; a.m.', th: 'ช่วงเช้า; ก่อนเที่ยง' }, kind: 'word' },
			{ reading: 'ごご', kanji: '午後', gloss: { en: 'afternoon; p.m.', th: 'ช่วงบ่าย; หลังเที่ยง' }, kind: 'word' },
			{ reading: 'えん', kanji: '円', gloss: { en: 'yen', th: 'เยน' }, kind: 'word' },
			{ reading: 'ひゃく', kanji: '百', gloss: { en: 'hundred', th: 'ร้อย' }, kind: 'word' },
			{ reading: 'せん', kanji: '千', gloss: { en: 'thousand', th: 'พัน' }, kind: 'word' },
			{ reading: 'ぎんこう', kanji: '銀行', gloss: { en: 'bank', th: 'ธนาคาร' }, kind: 'word' },
			{ reading: 'ひるやすみ', kanji: '昼休み', gloss: { en: 'lunch break', th: 'พักกลางวัน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-ji-han',
				pattern: '〜時・〜時半',
				formation: 'number + 時 (+ 半)',
				meaning: { en: 'telling the time: o’clock and half past', th: 'บอกเวลา: …โมง และ …โมงครึ่ง' },
				note: {
					en: 'Some readings change: 四時 よじ, 七時 しちじ, 九時 くじ. 半 means half past. Minutes (〜ふん, written 分) come in N4.',
					th: 'บางตัวเปลี่ยนเสียง: 四時 よじ, 七時 しちじ, 九時 くじ ส่วน 半 แปลว่า “ครึ่ง” ภาษาญี่ปุ่นนับชั่วโมง 1–12 ไม่มีคำแบบ “ทุ่ม” ใช้ 午前 (ก่อนเที่ยง) และ 午後 (หลังเที่ยง) แทน นาที (〜ふん เขียนว่า 分) จะเรียนใน N4'
				},
				examples: [
					{ ja: '今、何時ですか。', en: 'What time is it now?', th: 'ตอนนี้กี่โมงแล้ว' },
					{ ja: '九時です。', en: 'It’s nine o’clock.', th: 'เก้าโมง' },
					{ ja: '午後三時半です。', en: 'It’s half past three in the afternoon.', th: 'บ่ายสามโมงครึ่ง' },
					{ ja: '午前十一時です。', en: 'It’s eleven in the morning.', th: 'สิบเอ็ดโมงเช้า' },
					{ ja: '午後一時半です。', en: 'It’s half past one in the afternoon.', th: 'บ่ายโมงครึ่ง' }
				]
			},
			{
				id: 'n5-ikura',
				pattern: 'いくらですか・〜円',
				formation: 'N は いくらですか ・ number + 円',
				meaning: { en: 'asking and saying prices', th: 'ถามราคาและบอกราคา' },
				note: {
					en: '円 is read えん. Watch the sound changes: 三百 さんびゃく, 六百 ろっぴゃく, 八百 はっぴゃく, 三千 さんぜん.',
					th: '円 อ่านว่า えん (เยน) ระวังเสียงที่เปลี่ยน: 三百 さんびゃく, 六百 ろっぴゃく, 八百 はっぴゃく, 三千 さんぜん'
				},
				examples: [
					{ ja: 'このかさはいくらですか。', en: 'How much is this umbrella?', th: 'ร่มคันนี้ราคาเท่าไร' },
					{ ja: '五百円です。', en: 'It’s 500 yen.', th: 'ห้าร้อยเยน' },
					{ ja: 'そのかばんは三千円です。', en: 'That bag is 3,000 yen.', th: 'กระเป๋าใบนั้นสามพันเยน' },
					{ ja: 'コーヒーは四百円です。', en: 'Coffee is 400 yen.', th: 'กาแฟสี่ร้อยเยน' },
					{ ja: 'あの車は百万円です。', en: 'That car over there is a million yen.', th: 'รถคันโน้นราคาหนึ่งล้านเยน' }
				]
			},
			{
				id: 'n5-kara-made',
				pattern: '〜から〜まで',
				formation: 'time / place から time / place まで',
				meaning: { en: 'from … to / until …', th: 'ตั้งแต่ … ถึง …' },
				note: {
					en: 'Either half works alone: 九時から (from nine), 五時まで (until five).',
					th: 'ใช้ครึ่งเดียวก็ได้: 九時から (ตั้งแต่เก้าโมง) 五時まで (จนถึงห้าโมง)'
				},
				examples: [
					{ ja: 'ぎんこうは九時から三時までです。', en: 'The bank is open from nine to three.', th: 'ธนาคารเปิดตั้งแต่เก้าโมงถึงบ่ายสามโมง' },
					{ ja: 'ひるやすみは十二時から一時までです。', en: 'Lunch break is from twelve to one.', th: 'พักกลางวันตั้งแต่เที่ยงถึงบ่ายโมง' },
					{ ja: '日本語のクラスは何時からですか。', en: 'What time does the Japanese class start?', th: 'คลาสภาษาญี่ปุ่นเริ่มกี่โมง' },
					{ ja: 'みせは午後八時までです。', en: 'The shop is open until 8 p.m.', th: 'ร้านเปิดถึงสองทุ่ม' },
					{ ja: 'クラスは九時から十時半までです。', en: 'Class is from nine to half past ten.', th: 'คลาสเรียนตั้งแต่เก้าโมงถึงสิบโมงครึ่ง' }
				]
			}
		],
		reading: {
			title: { en: 'At the shop', th: 'ที่ร้าน' },
			lines: [
				{ ja: 'A：すみません、今、何時ですか。', en: 'A: Excuse me, what time is it now?', th: 'A: ขอโทษครับ ตอนนี้กี่โมงแล้วครับ' },
				{ ja: 'B：七時半です。', en: 'B: It’s half past seven.', th: 'B: หนึ่งทุ่มครึ่งค่ะ' },
				{ ja: 'A：このみせは何時までですか。', en: 'A: Until what time is this shop open?', th: 'A: ร้านนี้เปิดถึงกี่โมงครับ' },
				{ ja: 'B：九時までです。', en: 'B: Until nine.', th: 'B: ถึงสามทุ่มค่ะ' },
				{ ja: 'A：このかさはいくらですか。', en: 'A: How much is this umbrella?', th: 'A: ร่มคันนี้ราคาเท่าไรครับ' },
				{ ja: 'B：八百円です。', en: 'B: It’s 800 yen.', th: 'B: แปดร้อยเยนค่ะ' }
			],
			questions: [
				{
					q: { en: 'What time is it?', th: 'ตอนนี้กี่โมง' },
					choices: [
						{ en: 'Half past seven', th: 'เจ็ดโมงครึ่ง (หนึ่งทุ่มครึ่ง)' },
						{ en: 'Nine o’clock', th: 'เก้าโมง (สามทุ่ม)' },
						{ en: 'Eight o’clock', th: 'แปดโมง (สองทุ่ม)' }
					],
					answer: 0
				},
				{
					q: { en: 'How much is the umbrella?', th: 'ร่มราคาเท่าไร' },
					choices: [
						{ en: '900 yen', th: '900 เยน' },
						{ en: '700 yen', th: '700 เยน' },
						{ en: '800 yen', th: '800 เยน' }
					],
					answer: 2
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-05',
		level: 'N5',
		title: { en: 'Everyday verbs', th: 'คำกริยาในชีวิตประจำวัน' },
		goal: { en: 'Say what you do and where you go.', th: 'บอกว่าทำอะไร และไปที่ไหน' },
		kanji: ['行', '来', '食', '見'],
		words: [
			{ reading: 'いく', kanji: '行く', gloss: { en: 'to go', th: 'ไป' }, kind: 'word' },
			{ reading: 'くる', kanji: '来る', gloss: { en: 'to come', th: 'มา' }, kind: 'word' },
			{ reading: 'たべる', kanji: '食べる', gloss: { en: 'to eat', th: 'กิน' }, kind: 'word' },
			{ reading: 'のむ', kanji: '飲む', gloss: { en: 'to drink', th: 'ดื่ม' }, kind: 'word' },
			{ reading: 'みる', kanji: '見る', gloss: { en: 'to see; to watch', th: 'ดู; เห็น' }, kind: 'word' },
			{ reading: 'かう', kanji: '買う', gloss: { en: 'to buy', th: 'ซื้อ' }, kind: 'word' },
			{ reading: 'よむ', kanji: '読む', gloss: { en: 'to read', th: 'อ่าน' }, kind: 'word' },
			{ reading: 'かえる', kanji: '帰る', gloss: { en: 'to go home; to return', th: 'กลับ (บ้าน)' }, kind: 'word' },
			{ reading: 'ごはん', kanji: 'ご飯', gloss: { en: 'meal; cooked rice', th: 'ข้าว; มื้ออาหาร' }, kind: 'word' },
			{ reading: 'みず', kanji: '水', gloss: { en: 'water', th: 'น้ำ' }, kind: 'word' },
			{ reading: 'がっこう', kanji: '学校', gloss: { en: 'school', th: 'โรงเรียน' }, kind: 'word' },
			{ reading: 'あした', kanji: '明日', gloss: { en: 'tomorrow', th: 'พรุ่งนี้' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-masu',
				pattern: '〜ます・〜ません',
				formation: 'V-ます ・ V-ません',
				meaning: { en: 'polite present and future: do, will do / don’t, won’t', th: 'รูปสุภาพปัจจุบันและอนาคต: ทำ, จะทำ / ไม่ทำ, จะไม่ทำ' },
				note: {
					en: 'One form covers habits, now and the future. A time word such as 明日 tells which.',
					th: 'รูปเดียวใช้ได้ทั้งนิสัย ปัจจุบัน และอนาคต เหมือนภาษาไทยที่ใช้คำบอกเวลา เช่น 明日 (พรุ่งนี้) ช่วยบอกความหมาย'
				},
				examples: [
					{ ja: '山田さんは来ます。', en: 'Mr Yamada will come.', th: 'คุณยามาดะจะมา' },
					{ ja: '明日、行きます。', en: 'I’ll go tomorrow.', th: 'พรุ่งนี้จะไป' },
					{ ja: 'わたしは行きません。', en: 'I won’t go.', th: 'ฉันจะไม่ไป' },
					{ ja: '毎日、日本語の本を読みます。', en: 'I read a Japanese book every day.', th: 'อ่านหนังสือภาษาญี่ปุ่นทุกวัน' },
					{ ja: 'リンさんは来ませんか。', en: 'Isn’t Lin coming?', th: 'คุณลินไม่มาเหรอ' }
				]
			},
			{
				id: 'n5-wo',
				pattern: '〜を〜ます',
				formation: 'N を V-ます',
				meaning: { en: 'を marks what the action is done to', th: 'を บอกสิ่งที่ถูกกระทำ (กรรม)' },
				note: {
					en: 'を is read “o”. The verb always comes last: ごはんを食べます = eat a meal.',
					th: 'を อ่านว่า “โอะ” ภาษาไทยไม่ต้องมีคำนี้ และกริยามาก่อนกรรม แต่ภาษาญี่ปุ่นวางกริยาไว้ท้ายสุด: ごはんを食べます = กินข้าว'
				},
				examples: [
					{ ja: 'ごはんを食べます。', en: 'I eat a meal.', th: 'กินข้าว' },
					{ ja: '水をのみます。', en: 'I drink water.', th: 'ดื่มน้ำ' },
					{ ja: 'テレビを見ません。', en: 'I don’t watch TV.', th: 'ไม่ดูทีวี' },
					{ ja: '何を食べますか。', en: 'What will you eat?', th: 'จะกินอะไร' },
					{ ja: '本をかいます。', en: 'I’ll buy a book.', th: 'จะซื้อหนังสือ' }
				]
			},
			{
				id: 'n5-e-iku',
				pattern: '〜へ行きます',
				formation: 'place へ 行きます / 来ます / かえります',
				meaning: { en: 'go / come / return to a place', th: 'ไป / มา / กลับ (ที่ไหน)' },
				note: {
					en: 'へ is read “e” when it is a particle. に also works for the place you go to.',
					th: 'へ อ่านว่า “เอะ” เมื่อเป็นคำช่วย ใช้ に บอกจุดหมายแทนได้เช่นกัน'
				},
				examples: [
					{ ja: '学校へ行きます。', en: 'I go to school.', th: 'ไปโรงเรียน' },
					{ ja: '明日、日本へ行きます。', en: 'I’m going to Japan tomorrow.', th: 'พรุ่งนี้จะไปญี่ปุ่น' },
					{ ja: '山田さんはタイへ来ます。', en: 'Mr Yamada is coming to Thailand.', th: 'คุณยามาดะจะมาเมืองไทย' },
					{ ja: 'どこへ行きますか。', en: 'Where are you going?', th: 'จะไปไหน' },
					{ ja: 'いえへかえります。', en: 'I’m going home.', th: 'จะกลับบ้าน' }
				]
			}
		],
		reading: {
			title: { en: 'Plans for tomorrow', th: 'แผนของพรุ่งนี้' },
			lines: [
				{ ja: 'A：リンさん、明日、どこへ行きますか。', en: 'A: Lin, where are you going tomorrow?', th: 'A: คุณลิน พรุ่งนี้จะไปไหน' },
				{ ja: 'B：学校へ行きます。日本語のクラスがあります。', en: 'B: I’m going to school. I have Japanese class.', th: 'B: ไปโรงเรียน มีคลาสภาษาญี่ปุ่น' },
				{ ja: 'A：クラスの後、何をしますか。', en: 'A: What will you do after class?', th: 'A: หลังเลิกคลาสจะทำอะไร' },
				{ ja: 'B：ごはんを食べます。それから、えいがを見ます。', en: 'B: I’ll eat. Then I’ll watch a film.', th: 'B: กินข้าว แล้วก็ดูหนัง' },
				{ ja: 'A：いいですね。', en: 'A: That sounds nice.', th: 'A: ดีจังเลย' }
			],
			questions: [
				{
					q: { en: 'Where is Lin going tomorrow?', th: 'พรุ่งนี้ลินจะไปไหน' },
					choices: [
						{ en: 'Home', th: 'บ้าน' },
						{ en: 'School', th: 'โรงเรียน' },
						{ en: 'Japan', th: 'ญี่ปุ่น' }
					],
					answer: 1
				},
				{
					q: { en: 'What will Lin do after class?', th: 'หลังเลิกคลาสลินจะทำอะไร' },
					choices: [
						{ en: 'Eat, then watch a film', th: 'กินข้าว แล้วดูหนัง' },
						{ en: 'Read a book', th: 'อ่านหนังสือ' },
						{ en: 'Go home', th: 'กลับบ้าน' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-06',
		level: 'N5',
		title: { en: 'What I did', th: 'สิ่งที่ฉันทำไป' },
		goal: { en: 'Talk about your day: what you did, when and where.', th: 'เล่าเรื่องในวันหนึ่ง: ทำอะไร เมื่อไร และที่ไหน' },
		kanji: ['今', '毎', '年'],
		words: [
			{ reading: 'きのう', kanji: '昨日', gloss: { en: 'yesterday', th: 'เมื่อวาน' }, kind: 'word' },
			{ reading: 'きょう', kanji: '今日', gloss: { en: 'today', th: 'วันนี้' }, kind: 'word' },
			{ reading: 'まいにち', kanji: '毎日', gloss: { en: 'every day', th: 'ทุกวัน' }, kind: 'word' },
			{ reading: 'まいあさ', kanji: '毎朝', gloss: { en: 'every morning', th: 'ทุกเช้า' }, kind: 'word' },
			{ reading: 'ことし', kanji: '今年', gloss: { en: 'this year', th: 'ปีนี้' }, kind: 'word' },
			{ reading: 'きょねん', kanji: '去年', gloss: { en: 'last year', th: 'ปีที่แล้ว' }, kind: 'word' },
			{ reading: 'あさ', kanji: '朝', gloss: { en: 'morning', th: 'ตอนเช้า' }, kind: 'word' },
			{ reading: 'よる', kanji: '夜', gloss: { en: 'night; evening', th: 'กลางคืน' }, kind: 'word' },
			{ reading: 'べんきょう', kanji: '勉強', gloss: { en: 'study', th: 'การเรียน; การทบทวน' }, kind: 'word' },
			{ reading: 'しごと', kanji: '仕事', gloss: { en: 'work; job', th: 'งาน' }, kind: 'word' },
			{ reading: 'ねる', kanji: '寝る', gloss: { en: 'to go to bed; to sleep', th: 'นอน; เข้านอน' }, kind: 'word' },
			{ reading: 'おきる', kanji: '起きる', gloss: { en: 'to get up', th: 'ตื่นนอน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-mashita',
				pattern: '〜ました・〜ませんでした',
				formation: 'V-ました ・ V-ませんでした',
				meaning: { en: 'polite past: did / didn’t', th: 'อดีตแบบสุภาพ: ทำแล้ว / ไม่ได้ทำ' },
				note: {
					en: 'Change ます to ました for the past, and ません to ませんでした for the past negative.',
					th: 'ภาษาไทยบอกอดีตด้วยคำอย่าง “แล้ว” หรือ “เมื่อวาน” แต่ภาษาญี่ปุ่นเปลี่ยนท้ายกริยา: ます → ました, ません → ませんでした'
				},
				examples: [
					{ ja: 'きのう、日本語をべんきょうしました。', en: 'Yesterday I studied Japanese.', th: 'เมื่อวานเรียนภาษาญี่ปุ่น' },
					{ ja: '今日はコーヒーをのみませんでした。', en: 'I didn’t drink coffee today.', th: 'วันนี้ไม่ได้ดื่มกาแฟ' },
					{ ja: 'きょねん、日本へ行きました。', en: 'Last year I went to Japan.', th: 'ปีที่แล้วไปญี่ปุ่น' },
					{ ja: '何を食べましたか。', en: 'What did you eat?', th: 'กินอะไรไป' },
					{ ja: '山田さんは来ませんでした。', en: 'Mr Yamada didn’t come.', th: 'คุณยามาดะไม่ได้มา' }
				]
			},
			{
				id: 'n5-ni-time',
				pattern: '〜に (time)',
				formation: 'clock time / date + に V',
				meaning: { en: 'に marks a point in time', th: 'に บอกเวลาที่เกิดเหตุการณ์ (ตอน…)' },
				note: {
					en: 'Use に with clock times and dates, but not with words like 今日, 明日, 毎日 or 今年.',
					th: 'ใช้ に กับเวลาและวันที่ แต่ไม่ใช้กับคำอย่าง 今日 (วันนี้), 明日 (พรุ่งนี้), 毎日 (ทุกวัน), 今年 (ปีนี้)'
				},
				examples: [
					{ ja: '毎朝、六時におきます。', en: 'I get up at six every morning.', th: 'ตื่นตอนหกโมงทุกเช้า' },
					{ ja: 'よる十一時にねます。', en: 'I go to bed at eleven at night.', th: 'เข้านอนตอนห้าทุ่ม' },
					{ ja: '七時に学校へ行きます。', en: 'I go to school at seven.', th: 'ไปโรงเรียนตอนเจ็ดโมง' },
					{ ja: '何時にねましたか。', en: 'What time did you go to bed?', th: 'เข้านอนกี่โมง' },
					{ ja: '今年、日本へ行きます。', en: 'I’m going to Japan this year.', th: 'ปีนี้จะไปญี่ปุ่น' }
				]
			},
			{
				id: 'n5-de-place',
				pattern: '〜で〜ます',
				formation: 'place で V-ます',
				meaning: { en: 'で marks where an action happens', th: 'で บอกสถานที่ที่ทำกิจกรรม (ที่…)' },
				note: {
					en: 'に is where something is (あります, います); で is where something is done.',
					th: 'ภาษาไทยใช้ “ที่” ทั้งสองแบบ แต่ภาษาญี่ปุ่นแยก: に ใช้กับที่ที่สิ่งนั้นอยู่ (あります, います) で ใช้กับที่ที่ทำกิจกรรม'
				},
				examples: [
					{ ja: '学校で日本語をべんきょうします。', en: 'I study Japanese at school.', th: 'เรียนภาษาญี่ปุ่นที่โรงเรียน' },
					{ ja: 'いえでごはんを食べます。', en: 'I eat at home.', th: 'กินข้าวที่บ้าน' },
					{ ja: 'どこでかいましたか。', en: 'Where did you buy it?', th: 'ซื้อที่ไหน' },
					{ ja: 'みせでかさをかいました。', en: 'I bought an umbrella at the shop.', th: 'ซื้อร่มที่ร้าน' },
					{ ja: 'ぎんこうではたらきます。', en: 'I work at a bank.', th: 'ทำงานที่ธนาคาร' }
				]
			}
		],
		reading: {
			title: { en: 'My day off', th: 'วันหยุดของฉัน' },
			lines: [
				{ ja: 'きのうは休みでした。', en: 'Yesterday was my day off.', th: 'เมื่อวานเป็นวันหยุด' },
				{ ja: '午前十時におきました。', en: 'I got up at ten in the morning.', th: 'ตื่นตอนสิบโมงเช้า' },
				{ ja: '午後、えきの前のみせへ行きました。', en: 'In the afternoon I went to the shop in front of the station.', th: 'ตอนบ่ายไปร้านหน้าสถานี' },
				{ ja: 'みせでかばんをかいました。', en: 'I bought a bag at the shop.', th: 'ซื้อกระเป๋าที่ร้าน' },
				{ ja: 'よる、いえでテレビを見ました。', en: 'In the evening I watched TV at home.', th: 'ตอนกลางคืนดูทีวีที่บ้าน' },
				{ ja: 'べんきょうはしませんでした。', en: 'I didn’t study.', th: 'ไม่ได้ทบทวนหนังสือเลย' }
			],
			questions: [
				{
					q: { en: 'What time did the writer get up?', th: 'ผู้เขียนตื่นกี่โมง' },
					choices: [
						{ en: 'Six in the morning', th: 'หกโมงเช้า' },
						{ en: 'Ten in the morning', th: 'สิบโมงเช้า' },
						{ en: 'Noon', th: 'เที่ยงวัน' }
					],
					answer: 1
				},
				{
					q: { en: 'What did the writer buy?', th: 'ผู้เขียนซื้ออะไร' },
					choices: [
						{ en: 'A bag', th: 'กระเป๋า' },
						{ en: 'An umbrella', th: 'ร่ม' },
						{ en: 'A book', th: 'หนังสือ' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-07',
		level: 'N5',
		title: { en: 'Counting things', th: 'การนับสิ่งของ' },
		goal: { en: 'Count things from one to five and ask for them in a shop.', th: 'นับสิ่งของตั้งแต่หนึ่งถึงห้า และขอสิ่งของในร้าน' },
		kanji: ['一', '二', '三', '四', '五'],
		words: [
			{ reading: 'ひとつ', kanji: '一つ', gloss: { en: 'one (thing)', th: 'หนึ่ง (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'ふたつ', kanji: '二つ', gloss: { en: 'two (things)', th: 'สอง (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'みっつ', kanji: '三つ', gloss: { en: 'three (things)', th: 'สาม (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'よっつ', kanji: '四つ', gloss: { en: 'four (things)', th: 'สี่ (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'いつつ', kanji: '五つ', gloss: { en: 'five (things)', th: 'ห้า (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'いち', kanji: '一', gloss: { en: 'one', th: 'หนึ่ง' }, kind: 'word' },
			{ reading: 'に', kanji: '二', gloss: { en: 'two', th: 'สอง' }, kind: 'word' },
			{ reading: 'さん', kanji: '三', gloss: { en: 'three', th: 'สาม' }, kind: 'word' },
			{ reading: 'よん', kanji: '四', gloss: { en: 'four', th: 'สี่' }, kind: 'word' },
			{ reading: 'ご', kanji: '五', gloss: { en: 'five', th: 'ห้า' }, kind: 'word' },
			{ reading: 'いくつ', gloss: { en: 'how many', th: 'กี่ (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'たまご', kanji: '卵', gloss: { en: 'egg', th: 'ไข่' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-tsu',
				pattern: '〜つ',
				formation: 'ひとつ, ふたつ, みっつ, よっつ, いつつ …',
				meaning: { en: 'counting things in general (one, two, three …)', th: 'ใช้นับสิ่งของทั่วไป (หนึ่ง สอง สาม …)' },
				note: {
					en: 'Japanese counts with a counter after the number. つ works for almost any object when you don’t know the exact counter. The number usually comes right before the verb: りんごを三つください.',
					th: 'ภาษาญี่ปุ่นนับโดยใส่คำลักษณนามหลังตัวเลข つ ใช้นับสิ่งของได้เกือบทุกอย่างเมื่อไม่รู้ลักษณนามที่ถูกต้อง ตัวเลขมักอยู่หน้ากริยา เช่น りんごを三つください'
				},
				examples: [
					{ ja: 'りんごを三つください。', en: 'Three apples, please.', th: 'ขอแอปเปิลสามลูกค่ะ' },
					{ ja: 'いすが四つあります。', en: 'There are four chairs.', th: 'มีเก้าอี้สี่ตัว' },
					{ ja: 'たまごは五つあります。', en: 'There are five eggs.', th: 'ไข่มีห้าฟอง' },
					{ ja: '「いくつですか。」「二つです。」', en: '“How many?” “Two.”', th: '“กี่อันคะ” “สองอันค่ะ”' },
					{ ja: 'かばんの中にペンが一つあります。', en: 'There is one pen in the bag.', th: 'ในกระเป๋ามีปากกาหนึ่งด้าม' }
				]
			},
			{
				id: 'n5-wo-kudasai',
				pattern: '〜をください',
				formation: 'N を (number) ください',
				meaning: { en: 'please give me N; N, please', th: 'ขอ N หน่อย' },
				note: {
					en: 'The everyday way to ask for something in a shop or restaurant. Put the number between を and ください: 水を二つください.',
					th: 'วิธีขอสิ่งของในร้านค้าหรือร้านอาหารที่ใช้ทุกวัน ใส่จำนวนไว้ระหว่าง を กับ ください เช่น 水を二つください'
				},
				examples: [
					{ ja: '水をください。', en: 'Water, please.', th: 'ขอน้ำหน่อยค่ะ' },
					{ ja: 'このりんごを二つください。', en: 'Two of these apples, please.', th: 'ขอแอปเปิลนี้สองลูกค่ะ' },
					{ ja: 'コーヒーを一つください。', en: 'One coffee, please.', th: 'ขอกาแฟหนึ่งแก้วค่ะ' },
					{ ja: 'メニューをください。', en: 'The menu, please.', th: 'ขอเมนูหน่อยค่ะ' },
					{ ja: 'それを三つください。', en: 'Three of those, please.', th: 'ขออันนั้นสามอันค่ะ' }
				]
			},
			{
				id: 'n5-to-and',
				pattern: '〜と〜',
				formation: 'N1 と N2',
				meaning: { en: 'N1 and N2 (the whole list)', th: 'N1 และ N2 (บอกครบทุกอย่าง)' },
				note: {
					en: 'と joins nouns only, never verbs or whole sentences. It names every item: パンとたまご means bread and eggs, nothing else.',
					th: 'と ใช้เชื่อมคำนามเท่านั้น ไม่ใช้เชื่อมกริยาหรือประโยค และหมายถึงบอกครบทุกอย่าง パンとたまご คือขนมปังกับไข่ ไม่มีอย่างอื่น'
				},
				examples: [
					{ ja: 'パンとたまごをください。', en: 'Bread and eggs, please.', th: 'ขอขนมปังกับไข่ค่ะ' },
					{ ja: '山田さんと田中さんは先生です。', en: 'Mr Yamada and Ms Tanaka are teachers.', th: 'คุณยามาดะกับคุณทานากะเป็นครู' },
					{ ja: 'りんごとみかんをかいました。', en: 'I bought apples and mandarins.', th: 'ฉันซื้อแอปเปิลกับส้ม' },
					{ ja: 'つくえの上に本とノートがあります。', en: 'There is a book and a notebook on the desk.', th: 'บนโต๊ะมีหนังสือกับสมุด' },
					{ ja: 'コーヒーを一つと、水を二つください。', en: 'One coffee and two waters, please.', th: 'ขอกาแฟหนึ่งแก้วกับน้ำสองแก้วค่ะ' }
				]
			}
		],
		reading: {
			title: { en: 'At a café', th: 'ที่ร้านกาแฟ' },
			lines: [
				{ ja: 'てんいん：いらっしゃいませ。', en: 'Clerk: Welcome.', th: 'พนักงาน: ยินดีต้อนรับค่ะ' },
				{ ja: 'リン：コーヒーを二つください。', en: 'Lin: Two coffees, please.', th: 'ลิน: ขอกาแฟสองแก้วค่ะ' },
				{ ja: 'てんいん：はい。ケーキはいかがですか。', en: 'Clerk: Certainly. Would you like some cake?', th: 'พนักงาน: ได้ค่ะ รับเค้กด้วยไหมคะ' },
				{ ja: 'リン：じゃあ、チョコレートケーキを一つと、チーズケーキを一つください。', en: 'Lin: Then one chocolate cake and one cheesecake, please.', th: 'ลิน: งั้นขอเค้กช็อกโกแลตหนึ่งชิ้นกับชีสเค้กหนึ่งชิ้นค่ะ' },
				{ ja: 'てんいん：コーヒー二つと、ケーキ二つですね。千円です。', en: 'Clerk: Two coffees and two cakes. That’s 1,000 yen.', th: 'พนักงาน: กาแฟสองแก้วกับเค้กสองชิ้นนะคะ หนึ่งพันเยนค่ะ' }
			],
			questions: [
				{
					q: { en: 'How many coffees does Lin ask for?', th: 'ลินสั่งกาแฟกี่แก้ว' },
					choices: [
						{ en: 'One', th: 'หนึ่งแก้ว' },
						{ en: 'Two', th: 'สองแก้ว' },
						{ en: 'Three', th: 'สามแก้ว' }
					],
					answer: 1
				},
				{
					q: { en: 'How much is it?', th: 'ทั้งหมดราคาเท่าไร' },
					choices: [
						{ en: '500 yen', th: '500 เยน' },
						{ en: '1,000 yen', th: '1,000 เยน' },
						{ en: '2,000 yen', th: '2,000 เยน' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-08',
		level: 'N5',
		title: { en: 'People and ages', th: 'จำนวนคนและอายุ' },
		goal: { en: 'Count people, say your age and say “me too”.', th: 'นับจำนวนคน บอกอายุ และพูดว่า “ฉันก็เหมือนกัน”' },
		kanji: ['六', '七', '八', '九', '十'],
		words: [
			{ reading: 'むっつ', kanji: '六つ', gloss: { en: 'six (things)', th: 'หก (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'ななつ', kanji: '七つ', gloss: { en: 'seven (things)', th: 'เจ็ด (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'やっつ', kanji: '八つ', gloss: { en: 'eight (things)', th: 'แปด (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'ここのつ', kanji: '九つ', gloss: { en: 'nine (things)', th: 'เก้า (ชิ้น / อัน)' }, kind: 'word' },
			{ reading: 'はたち', kanji: '二十歳', gloss: { en: 'twenty years old', th: 'อายุยี่สิบปี' }, kind: 'word' },
			{ reading: 'ろく', kanji: '六', gloss: { en: 'six', th: 'หก' }, kind: 'word' },
			{ reading: 'なな', kanji: '七', gloss: { en: 'seven', th: 'เจ็ด' }, kind: 'word' },
			{ reading: 'はち', kanji: '八', gloss: { en: 'eight', th: 'แปด' }, kind: 'word' },
			{ reading: 'きゅう', kanji: '九', gloss: { en: 'nine', th: 'เก้า' }, kind: 'word' },
			{ reading: 'じゅう', kanji: '十', gloss: { en: 'ten', th: 'สิบ' }, kind: 'word' },
			{ reading: 'ひとり', kanji: '一人', gloss: { en: 'one person; alone', th: 'หนึ่งคน; คนเดียว' }, kind: 'word' },
			{ reading: 'ふたり', kanji: '二人', gloss: { en: 'two people', th: 'สองคน' }, kind: 'word' },
			{ reading: 'こども', kanji: '子供', gloss: { en: 'child', th: 'เด็ก; ลูก' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-nin',
				pattern: '〜人（にん）',
				formation: 'ひとり, ふたり, さんにん, よにん, ごにん …',
				meaning: { en: 'counting people', th: 'ใช้นับจำนวนคน' },
				note: {
					en: 'One and two people are special: ひとり and ふたり. Four people is よにん. Ask with 何人 (なんにん).',
					th: 'หนึ่งคนและสองคนอ่านพิเศษว่า ひとり และ ふたり สี่คนอ่านว่า よにん ถามจำนวนคนด้วย 何人 (なんにん)'
				},
				examples: [
					{ ja: '学生が三人います。', en: 'There are three students.', th: 'มีนักเรียนสามคน' },
					{ ja: '「何人ですか。」「二人です。」', en: '“How many people?” “Two.”', th: '“กี่ท่านคะ” “สองคนค่ะ”' },
					{ ja: 'クラスに学生が十人います。', en: 'There are ten students in the class.', th: 'ในห้องเรียนมีนักเรียนสิบคน' },
					{ ja: 'かぞくは四人です。', en: 'There are four people in my family.', th: 'ครอบครัวของฉันมีสี่คน' },
					{ ja: '日本人の友だちが一人います。', en: 'I have one Japanese friend.', th: 'ฉันมีเพื่อนคนญี่ปุ่นหนึ่งคน' }
				]
			},
			{
				id: 'n5-sai',
				pattern: '〜さい',
				formation: 'number + さい',
				meaning: { en: '… years old', th: 'อายุ … ปี' },
				note: {
					en: 'Watch the sounds: 1 いっさい, 8 はっさい, 10 じゅっさい. Twenty is usually はたち. おいくつですか is a politer way to ask なんさいですか.',
					th: 'ระวังเสียงอ่าน: 1 いっさい, 8 はっさい, 10 じゅっさい อายุยี่สิบปีมักพูดว่า はたち และ おいくつですか เป็นวิธีถามอายุที่สุภาพกว่า なんさいですか'
				},
				examples: [
					{ ja: 'わたしは二十さいです。', en: 'I am twenty years old.', th: 'ฉันอายุยี่สิบปี' },
					{ ja: '「なんさいですか。」「七さいです。」', en: '“How old are you?” “Seven.”', th: '“อายุกี่ขวบ” “เจ็ดขวบ”' },
					{ ja: '山田さんは三十八さいです。', en: 'Mr Yamada is thirty-eight.', th: 'คุณยามาดะอายุสามสิบแปดปี' },
					{ ja: '「おいくつですか。」「六十さいです。」', en: '“May I ask your age?” “I’m sixty.”', th: '“ขอถามอายุได้ไหมคะ” “หกสิบปีค่ะ”' },
					{ ja: '子どもは九さいと六さいです。', en: 'My children are nine and six.', th: 'ลูกอายุเก้าขวบกับหกขวบ' }
				]
			},
			{
				id: 'n5-mo',
				pattern: '〜も',
				formation: 'N も',
				meaning: { en: 'N too; N also', th: 'N ก็ … ด้วย' },
				note: {
					en: 'も takes the place of は, が or を: say わたしも, not わたしはも. With other particles it comes after them: 学校にも.',
					th: 'も ใช้แทน は が หรือ を ให้พูดว่า わたしも ไม่ใช่ わたしはも ถ้าเป็นคำช่วยอื่นให้วางต่อท้าย เช่น 学校にも'
				},
				examples: [
					{ ja: 'わたしも学生です。', en: 'I’m a student too.', th: 'ฉันก็เป็นนักเรียนเหมือนกัน' },
					{ ja: 'リンさんもタイ人です。', en: 'Lin is Thai too.', th: 'คุณลินก็เป็นคนไทยเหมือนกัน' },
					{ ja: '山田さんは先生です。田中さんも先生です。', en: 'Mr Yamada is a teacher. Ms Tanaka is a teacher too.', th: 'คุณยามาดะเป็นครู คุณทานากะก็เป็นครูด้วย' },
					{ ja: 'コーヒーをください。水もください。', en: 'A coffee, please. And some water too.', th: 'ขอกาแฟค่ะ ขอน้ำด้วยค่ะ' },
					{ ja: '「わたしは二十さいです。」「わたしもです。」', en: '“I’m twenty.” “Me too.”', th: '“ฉันอายุยี่สิบปี” “ฉันก็เหมือนกัน”' }
				]
			}
		],
		reading: {
			title: { en: 'My Japanese class', th: 'คลาสภาษาญี่ปุ่นของฉัน' },
			lines: [
				{ ja: 'これはわたしの日本語のクラスです。', en: 'This is my Japanese class.', th: 'นี่คือคลาสภาษาญี่ปุ่นของฉัน' },
				{ ja: '学生は八人います。', en: 'There are eight students.', th: 'มีนักเรียนแปดคน' },
				{ ja: 'タイ人が五人、アメリカ人が二人、中国人が一人です。', en: 'Five are Thai, two are American and one is Chinese.', th: 'เป็นคนไทยห้าคน คนอเมริกันสองคน และคนจีนหนึ่งคน' },
				{ ja: '先生は山田先生です。四十さいです。', en: 'The teacher is Mr Yamada. He is forty.', th: 'ครูคืออาจารย์ยามาดะ อายุสี่สิบปี' },
				{ ja: '山田先生は子どもが二人います。', en: 'Mr Yamada has two children.', th: 'อาจารย์ยามาดะมีลูกสองคน' }
			],
			questions: [
				{
					q: { en: 'How many students are in the class?', th: 'ในคลาสมีนักเรียนกี่คน' },
					choices: [
						{ en: 'Five', th: 'ห้าคน' },
						{ en: 'Eight', th: 'แปดคน' },
						{ en: 'Ten', th: 'สิบคน' }
					],
					answer: 1
				},
				{
					q: { en: 'How many students are Thai?', th: 'นักเรียนคนไทยมีกี่คน' },
					choices: [
						{ en: 'One', th: 'หนึ่งคน' },
						{ en: 'Two', th: 'สองคน' },
						{ en: 'Five', th: 'ห้าคน' }
					],
					answer: 2
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-09',
		level: 'N5',
		title: { en: 'Shopping', th: 'ซื้อของ' },
		goal: { en: 'Talk about prices, say what you want and say “only”.', th: 'พูดเรื่องราคา บอกสิ่งที่อยากได้ และพูดว่า “แค่ / เท่านั้น”' },
		kanji: ['千', '万', '高'],
		words: [
			{ reading: 'たかい', kanji: '高い', gloss: { en: 'expensive; tall; high', th: 'แพง; สูง' }, kind: 'word' },
			{ reading: 'やすい', kanji: '安い', gloss: { en: 'cheap', th: 'ถูก (ราคา)' }, kind: 'word' },
			{ reading: 'まん', kanji: '万', gloss: { en: 'ten thousand', th: 'หมื่น' }, kind: 'word' },
			{ reading: 'さいふ', kanji: '財布', gloss: { en: 'wallet; purse', th: 'กระเป๋าสตางค์' }, kind: 'word' },
			{ reading: 'くつ', kanji: '靴', gloss: { en: 'shoes', th: 'รองเท้า' }, kind: 'word' },
			{ reading: 'ふく', kanji: '服', gloss: { en: 'clothes', th: 'เสื้อผ้า' }, kind: 'word' },
			{ reading: 'シャツ', gloss: { en: 'shirt', th: 'เสื้อเชิ้ต' }, kind: 'word' },
			{ reading: 'デパート', gloss: { en: 'department store', th: 'ห้างสรรพสินค้า' }, kind: 'word' },
			{ reading: 'ほしい', kanji: '欲しい', gloss: { en: 'to want (a thing)', th: 'อยากได้' }, kind: 'word' },
			{ reading: 'あたらしい', kanji: '新しい', gloss: { en: 'new', th: 'ใหม่' }, kind: 'word' },
			{ reading: 'ふるい', kanji: '古い', gloss: { en: 'old (things)', th: 'เก่า' }, kind: 'word' },
			{ reading: 'おかね', kanji: 'お金', gloss: { en: 'money', th: 'เงิน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-i-adj',
				pattern: '〜いです・〜くないです',
				formation: 'N は A-い です / A-くないです',
				meaning: { en: 'N is (not) A, with an い-adjective', th: 'N (ไม่) … ใช้กับคุณศัพท์ い' },
				note: {
					en: 'To make an い-adjective negative, change the last い to くない: 高い → 高くない. いい is irregular: よくないです. くありません is the more formal negative.',
					th: 'ทำคุณศัพท์ い ให้เป็นปฏิเสธโดยเปลี่ยน い ตัวท้ายเป็น くない เช่น 高い → 高くない ส่วน いい เป็นข้อยกเว้น กลายเป็น よくないです และ くありません เป็นรูปปฏิเสธที่ทางการกว่า'
				},
				examples: [
					{ ja: 'このかばんは高いです。', en: 'This bag is expensive.', th: 'กระเป๋าใบนี้แพง' },
					{ ja: 'このくつは安いです。', en: 'These shoes are cheap.', th: 'รองเท้าคู่นี้ถูก' },
					{ ja: 'このシャツは高くないです。', en: 'This shirt isn’t expensive.', th: 'เสื้อเชิ้ตตัวนี้ไม่แพง' },
					{ ja: 'わたしのさいふは古いです。', en: 'My wallet is old.', th: 'กระเป๋าสตางค์ของฉันเก่าแล้ว' },
					{ ja: '「そのふくはあたらしいですか。」「いいえ、あたらしくないです。」', en: '“Are those clothes new?” “No, they aren’t.”', th: '“เสื้อผ้านั้นใหม่ไหม” “ไม่ ไม่ใหม่”' }
				]
			},
			{
				id: 'n5-hoshii',
				pattern: '〜がほしいです',
				formation: 'N が ほしいです',
				meaning: { en: 'I want N', th: 'อยากได้ N' },
				note: {
					en: 'ほしい is for things, and the thing takes が. Use it about yourself, or to ask a friend. Don’t ask a teacher or a customer 何がほしいですか: it sounds too direct.',
					th: 'ほしい ใช้กับสิ่งของ และสิ่งนั้นใช้คำช่วย が ใช้พูดถึงตัวเองหรือถามเพื่อน ไม่ควรถามครูหรือลูกค้าว่า 何がほしいですか เพราะฟังดูตรงเกินไป'
				},
				examples: [
					{ ja: 'あたらしいくつがほしいです。', en: 'I want new shoes.', th: 'อยากได้รองเท้าใหม่' },
					{ ja: '大きいかばんがほしいです。', en: 'I want a big bag.', th: 'อยากได้กระเป๋าใบใหญ่' },
					{ ja: '何がほしいですか。', en: 'What do you want?', th: 'อยากได้อะไร' },
					{ ja: '今、お金がほしいです。', en: 'Right now I want money.', th: 'ตอนนี้อยากได้เงิน' },
					{ ja: '車はほしくないです。', en: 'I don’t want a car.', th: 'ไม่อยากได้รถยนต์' }
				]
			},
			{
				id: 'n5-dake',
				pattern: '〜だけ',
				formation: 'N / number + だけ',
				meaning: { en: 'only; just', th: 'แค่; เท่านั้น' },
				note: {
					en: 'だけ comes right after what it limits. 見るだけです (I’m just looking) is a handy phrase in shops.',
					th: 'だけ วางต่อท้ายสิ่งที่ต้องการจำกัด ประโยค 見るだけです (แค่ดูเฉย ๆ) มีประโยชน์มากเวลาเดินร้านค้า'
				},
				examples: [
					{ ja: '千円だけあります。', en: 'I only have 1,000 yen.', th: 'มีแค่หนึ่งพันเยน' },
					{ ja: '見るだけです。', en: 'I’m just looking.', th: 'แค่ดูเฉย ๆ ค่ะ' },
					{ ja: 'シャツを一つだけかいました。', en: 'I bought just one shirt.', th: 'ซื้อเสื้อเชิ้ตแค่ตัวเดียว' },
					{ ja: 'このみせはカードだけです。', en: 'This shop takes cards only.', th: 'ร้านนี้รับแค่บัตร' },
					{ ja: '水だけください。', en: 'Just water, please.', th: 'ขอแค่น้ำเปล่าค่ะ' }
				]
			}
		],
		reading: {
			title: { en: 'Buying shoes', th: 'ซื้อรองเท้า' },
			lines: [
				{ ja: 'リン：すみません、このくつはいくらですか。', en: 'Lin: Excuse me, how much are these shoes?', th: 'ลิน: ขอโทษค่ะ รองเท้าคู่นี้ราคาเท่าไรคะ' },
				{ ja: 'てんいん：一万二千円です。', en: 'Clerk: 12,000 yen.', th: 'พนักงาน: หนึ่งหมื่นสองพันเยนค่ะ' },
				{ ja: 'リン：高いですね。すこし安いくつはありますか。', en: 'Lin: That’s expensive. Do you have cheaper shoes?', th: 'ลิน: แพงจังเลย มีรองเท้าที่ถูกกว่านี้หน่อยไหมคะ' },
				{ ja: 'てんいん：こちらは五千円です。', en: 'Clerk: These are 5,000 yen.', th: 'พนักงาน: คู่นี้ห้าพันเยนค่ะ' },
				{ ja: 'リン：いいですね。これをください。', en: 'Lin: Nice. I’ll take these.', th: 'ลิน: ดีจังค่ะ เอาคู่นี้ค่ะ' }
			],
			questions: [
				{
					q: { en: 'How much are the first shoes?', th: 'รองเท้าคู่แรกราคาเท่าไร' },
					choices: [
						{ en: '2,000 yen', th: '2,000 เยน' },
						{ en: '5,000 yen', th: '5,000 เยน' },
						{ en: '12,000 yen', th: '12,000 เยน' }
					],
					answer: 2
				},
				{
					q: { en: 'What does Lin buy?', th: 'ลินซื้ออะไร' },
					choices: [
						{ en: 'The 12,000 yen shoes', th: 'รองเท้าราคา 12,000 เยน' },
						{ en: 'The 5,000 yen shoes', th: 'รองเท้าราคา 5,000 เยน' },
						{ en: 'Nothing', th: 'ไม่ได้ซื้ออะไร' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-10',
		level: 'N5',
		title: { en: 'Making plans', th: 'นัดหมาย' },
		goal: { en: 'Name the days of the week, invite someone and say who you do things with.', th: 'บอกวันในสัปดาห์ ชวนคนอื่น และบอกว่าทำสิ่งต่าง ๆ กับใคร' },
		kanji: ['火', '水', '木', '金', '土'],
		words: [
			{ reading: 'げつようび', kanji: '月曜日', gloss: { en: 'Monday', th: 'วันจันทร์' }, kind: 'word' },
			{ reading: 'かようび', kanji: '火曜日', gloss: { en: 'Tuesday', th: 'วันอังคาร' }, kind: 'word' },
			{ reading: 'すいようび', kanji: '水曜日', gloss: { en: 'Wednesday', th: 'วันพุธ' }, kind: 'word' },
			{ reading: 'もくようび', kanji: '木曜日', gloss: { en: 'Thursday', th: 'วันพฤหัสบดี' }, kind: 'word' },
			{ reading: 'きんようび', kanji: '金曜日', gloss: { en: 'Friday', th: 'วันศุกร์' }, kind: 'word' },
			{ reading: 'どようび', kanji: '土曜日', gloss: { en: 'Saturday', th: 'วันเสาร์' }, kind: 'word' },
			{ reading: 'にちようび', kanji: '日曜日', gloss: { en: 'Sunday', th: 'วันอาทิตย์' }, kind: 'word' },
			{ reading: 'しゅうまつ', kanji: '週末', gloss: { en: 'weekend', th: 'สุดสัปดาห์' }, kind: 'word' },
			{ reading: 'えいが', kanji: '映画', gloss: { en: 'movie; film', th: 'ภาพยนตร์; หนัง' }, kind: 'word' },
			{ reading: 'いっしょに', kanji: '一緒に', gloss: { en: 'together', th: 'ด้วยกัน' }, kind: 'word' },
			{ reading: 'ひま', kanji: '暇', gloss: { en: 'free (time)', th: 'ว่าง' }, kind: 'word' },
			{ reading: 'あう', kanji: '会う', gloss: { en: 'to meet', th: 'พบ; เจอ' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-masenka',
				pattern: '〜ませんか',
				formation: 'V-ませんか',
				meaning: { en: 'won’t you …? would you like to …? (an invitation)', th: '… ไหม (ชวนอย่างสุภาพ)' },
				note: {
					en: 'A polite invitation that leaves the other person room to say no. Accept with ええ、いいですね. Decline softly with すみません、ちょっと…',
					th: 'เป็นการชวนอย่างสุภาพ ที่เปิดโอกาสให้อีกฝ่ายปฏิเสธได้ ตอบรับว่า ええ、いいですね ปฏิเสธอย่างนุ่มนวลว่า すみません、ちょっと…'
				},
				examples: [
					{ ja: '土よう日にえいがを見ませんか。', en: 'Would you like to see a movie on Saturday?', th: 'วันเสาร์ไปดูหนังกันไหม' },
					{ ja: 'いっしょにひるごはんを食べませんか。', en: 'Would you like to have lunch together?', th: 'กินข้าวกลางวันด้วยกันไหม' },
					{ ja: '金よう日に山に行きませんか。', en: 'Would you like to go to the mountains on Friday?', th: 'วันศุกร์ไปภูเขากันไหม' },
					{ ja: 'コーヒーをのみませんか。', en: 'Would you like a coffee?', th: 'ดื่มกาแฟกันไหม' },
					{ ja: '日よう日にテニスをしませんか。', en: 'Shall we play tennis on Sunday?', th: 'วันอาทิตย์เล่นเทนนิสกันไหม' }
				]
			},
			{
				id: 'n5-mashou',
				pattern: '〜ましょう',
				formation: 'V-ましょう / V-ましょうか',
				meaning: { en: 'let’s …; shall we …?', th: '… กันเถอะ; … กันไหม' },
				note: {
					en: 'ましょう suggests doing something together, or agrees to a plan. ましょうか asks “shall we?” or offers help: 手つだいましょうか.',
					th: 'ましょう ใช้ชวนทำด้วยกันหรือตอบตกลงแผน ส่วน ましょうか ใช้ถามว่า “… กันไหม” หรือเสนอความช่วยเหลือ เช่น 手つだいましょうか'
				},
				examples: [
					{ ja: 'いっしょに行きましょう。', en: 'Let’s go together.', th: 'ไปด้วยกันเถอะ' },
					{ ja: '水よう日にあいましょう。', en: 'Let’s meet on Wednesday.', th: 'เจอกันวันพุธนะ' },
					{ ja: 'ここで休みましょう。', en: 'Let’s take a rest here.', th: 'พักตรงนี้กันเถอะ' },
					{ ja: '「何を食べましょうか。」「すしを食べましょう。」', en: '“What shall we eat?” “Let’s have sushi.”', th: '“กินอะไรกันดี” “กินซูชิกันเถอะ”' },
					{ ja: '三時にえきであいましょう。', en: 'Let’s meet at the station at three.', th: 'เจอกันที่สถานีตอนบ่ายสามโมงนะ' }
				]
			},
			{
				id: 'n5-to-issho',
				pattern: '〜と（いっしょに）',
				formation: 'person と (いっしょに) V',
				meaning: { en: 'with a person', th: 'กับ (ใคร)' },
				note: {
					en: 'と after a person means “with”. いっしょに (together) can be added, or left out. Ask with だれと.',
					th: 'と หลังชื่อคนแปลว่า “กับ” จะเติม いっしょに (ด้วยกัน) หรือไม่ก็ได้ ถามว่ากับใครด้วย だれと'
				},
				examples: [
					{ ja: '友だちとえいがを見ます。', en: 'I watch a movie with a friend.', th: 'ดูหนังกับเพื่อน' },
					{ ja: '木よう日に母とかいものに行きます。', en: 'On Thursday I’m going shopping with my mother.', th: 'วันพฤหัสจะไปซื้อของกับแม่' },
					{ ja: '山田さんといっしょにひるごはんを食べました。', en: 'I had lunch with Mr Yamada.', th: 'กินข้าวกลางวันกับคุณยามาดะ' },
					{ ja: 'だれと行きますか。', en: 'Who are you going with?', th: 'จะไปกับใคร' },
					{ ja: '先生と日本語で話しました。', en: 'I talked with the teacher in Japanese.', th: 'คุยกับครูเป็นภาษาญี่ปุ่น' }
				]
			}
		],
		reading: {
			title: { en: 'A plan for the weekend', th: 'แผนวันหยุดสุดสัปดาห์' },
			lines: [
				{ ja: 'ナリン：リンさん、土よう日はひまですか。', en: 'Narin: Lin, are you free on Saturday?', th: 'นาริน: ลิน วันเสาร์ว่างไหม' },
				{ ja: 'リン：土よう日はアルバイトです。でも、日よう日はひまです。', en: 'Lin: I work my part-time job on Saturday. But I’m free on Sunday.', th: 'ลิน: วันเสาร์ทำงานพาร์ตไทม์ แต่วันอาทิตย์ว่างนะ' },
				{ ja: 'ナリン：じゃあ、日よう日にいっしょにえいがを見ませんか。', en: 'Narin: Then would you like to see a movie together on Sunday?', th: 'นาริน: งั้นวันอาทิตย์ไปดูหนังด้วยกันไหม' },
				{ ja: 'リン：いいですね。見ましょう。何時にあいましょうか。', en: 'Lin: Sounds good. Let’s. What time shall we meet?', th: 'ลิน: ดีเลย ไปดูกัน จะเจอกันกี่โมงดี' },
				{ ja: 'ナリン：十時に学校の前であいましょう。', en: 'Narin: Let’s meet in front of the school at ten.', th: 'นาริน: เจอกันหน้าโรงเรียนตอนสิบโมงนะ' }
			],
			questions: [
				{
					q: { en: 'Which day will they see the movie?', th: 'ทั้งสองจะไปดูหนังวันไหน' },
					choices: [
						{ en: 'Friday', th: 'วันศุกร์' },
						{ en: 'Saturday', th: 'วันเสาร์' },
						{ en: 'Sunday', th: 'วันอาทิตย์' }
					],
					answer: 2
				},
				{
					q: { en: 'Where will they meet?', th: 'ทั้งสองจะเจอกันที่ไหน' },
					choices: [
						{ en: 'At the station', th: 'ที่สถานี' },
						{ en: 'In front of the school', th: 'หน้าโรงเรียน' },
						{ en: 'At the cinema', th: 'ที่โรงหนัง' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-11',
		level: 'N5',
		title: { en: 'Dates and birthdays', th: 'วันที่และวันเกิด' },
		goal: { en: 'Say the date, ask when something is and add ね or よ to a sentence.', th: 'บอกวันที่ ถามว่าเมื่อไร และเติม ね หรือ よ ท้ายประโยค' },
		kanji: ['日', '月', '先'],
		words: [
			{ reading: 'ついたち', kanji: '一日', gloss: { en: 'the first (of the month)', th: 'วันที่หนึ่ง (ของเดือน)' }, kind: 'word' },
			{ reading: 'ふつか', kanji: '二日', gloss: { en: 'the second; two days', th: 'วันที่สอง; สองวัน' }, kind: 'word' },
			{ reading: 'みっか', kanji: '三日', gloss: { en: 'the third; three days', th: 'วันที่สาม; สามวัน' }, kind: 'word' },
			{ reading: 'よっか', kanji: '四日', gloss: { en: 'the fourth; four days', th: 'วันที่สี่; สี่วัน' }, kind: 'word' },
			{ reading: 'いつか', kanji: '五日', gloss: { en: 'the fifth; five days', th: 'วันที่ห้า; ห้าวัน' }, kind: 'word' },
			{ reading: 'とおか', kanji: '十日', gloss: { en: 'the tenth; ten days', th: 'วันที่สิบ; สิบวัน' }, kind: 'word' },
			{ reading: 'はつか', kanji: '二十日', gloss: { en: 'the twentieth; twenty days', th: 'วันที่ยี่สิบ; ยี่สิบวัน' }, kind: 'word' },
			{ reading: 'なんにち', kanji: '何日', gloss: { en: 'what day of the month; how many days', th: 'วันที่เท่าไร; กี่วัน' }, kind: 'word' },
			{ reading: 'なんがつ', kanji: '何月', gloss: { en: 'what month', th: 'เดือนอะไร' }, kind: 'word' },
			{ reading: 'たんじょうび', kanji: '誕生日', gloss: { en: 'birthday', th: 'วันเกิด' }, kind: 'word' },
			{ reading: 'せんげつ', kanji: '先月', gloss: { en: 'last month', th: 'เดือนที่แล้ว' }, kind: 'word' },
			{ reading: 'らいげつ', kanji: '来月', gloss: { en: 'next month', th: 'เดือนหน้า' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-dates',
				pattern: '〜月〜日',
				formation: 'number 月 number 日',
				meaning: { en: 'dates: month and day', th: 'วันที่: เดือนและวัน' },
				note: {
					en: 'Days 1 to 10, 14, 20 and 24 have their own readings: ついたち, ふつか, みっか … とおか, じゅうよっか, はつか, にじゅうよっか. Watch three months too: 四月 しがつ, 七月 しちがつ, 九月 くがつ.',
					th: 'วันที่ 1 ถึง 10, 14, 20 และ 24 มีเสียงอ่านเฉพาะ: ついたち, ふつか, みっか … とおか, じゅうよっか, はつか, にじゅうよっか ระวังชื่อเดือนสามเดือนนี้ด้วย: 四月 しがつ, 七月 しちがつ, 九月 くがつ'
				},
				examples: [
					{ ja: '今日は十月十日です。', en: 'Today is the tenth of October.', th: 'วันนี้วันที่สิบเดือนตุลาคม' },
					{ ja: 'たんじょう日は三月三日です。', en: 'My birthday is the third of March.', th: 'วันเกิดของฉันคือวันที่สามมีนาคม' },
					{ ja: '「何月何日ですか。」「五月五日です。」', en: '“What’s the date?” “The fifth of May.”', th: '“วันที่เท่าไร เดือนอะไร” “วันที่ห้าพฤษภาคม”' },
					{ ja: '四月一日に日本へ行きます。', en: 'I’m going to Japan on the first of April.', th: 'จะไปญี่ปุ่นวันที่หนึ่งเมษายน' },
					{ ja: '七月七日は「たなばた」です。', en: 'The seventh of July is Tanabata.', th: 'วันที่เจ็ดกรกฎาคมคือวันทานาบาตะ' }
				]
			},
			{
				id: 'n5-itsu',
				pattern: 'いつ',
				formation: 'いつ V-ますか / N は いつですか',
				meaning: { en: 'when', th: 'เมื่อไร' },
				note: {
					en: 'いつ never takes に: いつ行きますか, not いつに行きますか. In an answer, an exact time or date does take に: 三日に行きます.',
					th: 'いつ ไม่ต้องตามด้วย に พูดว่า いつ行きますか ไม่ใช่ いつに行きますか แต่ตอนตอบ ถ้าบอกวันหรือเวลาที่แน่นอนให้ใส่ に เช่น 三日に行きます'
				},
				examples: [
					{ ja: 'たんじょう日はいつですか。', en: 'When is your birthday?', th: 'วันเกิดเมื่อไร' },
					{ ja: 'いつ日本へ来ましたか。', en: 'When did you come to Japan?', th: 'มาญี่ปุ่นเมื่อไร' },
					{ ja: '「テストはいつですか。」「らいしゅうの月よう日です。」', en: '“When is the test?” “Next Monday.”', th: '“สอบเมื่อไร” “วันจันทร์หน้า”' },
					{ ja: '休みはいつからですか。', en: 'When does the holiday start?', th: 'วันหยุดเริ่มเมื่อไร' },
					{ ja: 'いつがいいですか。', en: 'When is good for you?', th: 'สะดวกเมื่อไร' }
				]
			},
			{
				id: 'n5-ne-yo',
				pattern: '〜ね・〜よ',
				formation: 'sentence + ね / よ',
				meaning: { en: 'ね: isn’t it? (shared feeling) · よ: you know (new information)', th: 'ね: … นะ / … เนอะ (ชวนให้เห็นด้วย) · よ: … นะ (บอกข้อมูลใหม่)' },
				note: {
					en: 'Use ね when you expect the listener to agree or already know. Use よ to tell them something they don’t know yet. Too much よ can sound pushy.',
					th: 'ใช้ ね เมื่อคิดว่าผู้ฟังเห็นด้วยหรือรู้อยู่แล้ว ใช้ よ เมื่อบอกสิ่งที่ผู้ฟังยังไม่รู้ ถ้าใช้ よ บ่อยเกินไปอาจฟังดูเหมือนยัดเยียด'
				},
				examples: [
					{ ja: 'いい天気ですね。', en: 'Nice weather, isn’t it?', th: 'อากาศดีนะ' },
					{ ja: 'このケーキ、おいしいですね。', en: 'This cake is good, isn’t it?', th: 'เค้กนี้อร่อยเนอะ' },
					{ ja: '明日はテストですよ。', en: 'There’s a test tomorrow, you know.', th: 'พรุ่งนี้มีสอบนะ' },
					{ ja: '田中さんは先生ですよ。', en: 'Ms Tanaka is a teacher, you know.', th: 'คุณทานากะเป็นครูนะ' },
					{ ja: '先月、山に行きましたよ。', en: 'I went to the mountains last month, you know.', th: 'เดือนที่แล้วไปภูเขามานะ' }
				]
			}
		],
		reading: {
			title: { en: 'When is your birthday?', th: 'วันเกิดเมื่อไร' },
			lines: [
				{ ja: 'ナリン：リンさん、たんじょう日はいつですか。', en: 'Narin: Lin, when is your birthday?', th: 'นาริน: ลิน วันเกิดเมื่อไร' },
				{ ja: 'リン：三月二十日です。ナリンさんは？', en: 'Lin: The twentieth of March. And you, Narin?', th: 'ลิน: วันที่ยี่สิบมีนาคม แล้วนารินล่ะ' },
				{ ja: 'ナリン：わたしのたんじょう日は先月でした。十月八日です。', en: 'Narin: My birthday was last month. The eighth of October.', th: 'นาริน: วันเกิดของฉันผ่านไปเมื่อเดือนที่แล้ว วันที่แปดตุลาคม' },
				{ ja: 'リン：そうですか。来年はいっしょにパーティーをしましょう。', en: 'Lin: Oh, I see. Let’s have a party together next year.', th: 'ลิน: อย่างนั้นเหรอ ปีหน้ามาจัดปาร์ตี้ด้วยกันนะ' },
				{ ja: 'ナリン：いいですね。', en: 'Narin: Sounds good.', th: 'นาริน: ดีเลย' }
			],
			questions: [
				{
					q: { en: 'When is Lin’s birthday?', th: 'วันเกิดของลินคือวันไหน' },
					choices: [
						{ en: 'The second of March', th: 'วันที่สองมีนาคม' },
						{ en: 'The twentieth of March', th: 'วันที่ยี่สิบมีนาคม' },
						{ en: 'The eighth of October', th: 'วันที่แปดตุลาคม' }
					],
					answer: 1
				},
				{
					q: { en: 'When was Narin’s birthday?', th: 'วันเกิดของนารินคือเมื่อไร' },
					choices: [
						{ en: 'Last month', th: 'เดือนที่แล้ว' },
						{ en: 'Next month', th: 'เดือนหน้า' },
						{ en: 'Today', th: 'วันนี้' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-12',
		level: 'N5',
		title: { en: 'My family', th: 'ครอบครัวของฉัน' },
		goal: { en: 'Talk about your family and other people’s, give examples and ask who.', th: 'พูดถึงครอบครัวของตัวเองและของคนอื่น ยกตัวอย่าง และถามว่าใคร' },
		kanji: ['父', '母', '子', '男', '女'],
		words: [
			{ reading: 'ちち', kanji: '父', gloss: { en: '(my) father', th: 'พ่อ (ของฉัน)' }, kind: 'word' },
			{ reading: 'はは', kanji: '母', gloss: { en: '(my) mother', th: 'แม่ (ของฉัน)' }, kind: 'word' },
			{ reading: 'おとうさん', kanji: 'お父さん', gloss: { en: 'father (polite)', th: 'คุณพ่อ' }, kind: 'word' },
			{ reading: 'おかあさん', kanji: 'お母さん', gloss: { en: 'mother (polite)', th: 'คุณแม่' }, kind: 'word' },
			{ reading: 'あに', kanji: '兄', gloss: { en: '(my) older brother', th: 'พี่ชาย (ของฉัน)' }, kind: 'word' },
			{ reading: 'あね', kanji: '姉', gloss: { en: '(my) older sister', th: 'พี่สาว (ของฉัน)' }, kind: 'word' },
			{ reading: 'おとうと', kanji: '弟', gloss: { en: 'younger brother', th: 'น้องชาย' }, kind: 'word' },
			{ reading: 'いもうと', kanji: '妹', gloss: { en: 'younger sister', th: 'น้องสาว' }, kind: 'word' },
			{ reading: 'おとこのこ', kanji: '男の子', gloss: { en: 'boy', th: 'เด็กผู้ชาย' }, kind: 'word' },
			{ reading: 'おんなのこ', kanji: '女の子', gloss: { en: 'girl', th: 'เด็กผู้หญิง' }, kind: 'word' },
			{ reading: 'かぞく', kanji: '家族', gloss: { en: 'family', th: 'ครอบครัว' }, kind: 'word' },
			{ reading: 'りょうしん', kanji: '両親', gloss: { en: 'parents', th: 'พ่อแม่' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-family-words',
				pattern: '父・お父さん',
				formation: 'my family: 父, 母, 兄 … / your family: お父さん, お母さん, お兄さん …',
				meaning: { en: 'two sets of family words: your own family and someone else’s', th: 'คำเรียกครอบครัวสองชุด: ของตัวเองและของคนอื่น' },
				note: {
					en: 'When you talk to others about your own family, use the plain words: 父, 母, 兄. For someone else’s family use the polite ones: お父さん, お母さん. At home you call your own parents お父さん and お母さん too.',
					th: 'เวลาพูดถึงครอบครัวตัวเองกับคนอื่นใช้คำธรรมดา: 父, 母, 兄 ถ้าพูดถึงครอบครัวของคนอื่นใช้คำสุภาพ: お父さん, お母さん แต่ที่บ้านเรียกพ่อแม่ตัวเองว่า お父さん และ お母さん ได้'
				},
				examples: [
					{ ja: '父はかいしゃいんです。', en: 'My father is an office worker.', th: 'พ่อของฉันเป็นพนักงานบริษัท' },
					{ ja: '母は六十さいです。', en: 'My mother is sixty.', th: 'แม่ของฉันอายุหกสิบปี' },
					{ ja: '山田さんのお父さんは先生です。', en: 'Mr Yamada’s father is a teacher.', th: 'คุณพ่อของคุณยามาดะเป็นครู' },
					{ ja: 'お母さんはおげんきですか。', en: 'How is your mother?', th: 'คุณแม่สบายดีไหม' },
					{ ja: 'あにが一人と、いもうとが二人います。', en: 'I have one older brother and two younger sisters.', th: 'ฉันมีพี่ชายหนึ่งคนกับน้องสาวสองคน' }
				]
			},
			{
				id: 'n5-ya-nado',
				pattern: '〜や〜（など）',
				formation: 'N1 や N2 (など)',
				meaning: { en: 'N1, N2 and so on (some examples, not the whole list)', th: 'N1 และ N2 เป็นต้น (ยกตัวอย่าง ไม่ได้บอกทั้งหมด)' },
				note: {
					en: 'と names every item; や gives a few examples and hints there are more. など (and so on) can close the list.',
					th: 'と บอกครบทุกอย่าง ส่วน や ยกตัวอย่างบางอย่างและบอกเป็นนัยว่ายังมีอีก ปิดท้ายรายการด้วย など (เป็นต้น) ได้'
				},
				examples: [
					{ ja: 'つくえの上に本やノートがあります。', en: 'There are books, notebooks and other things on the desk.', th: 'บนโต๊ะมีหนังสือ สมุด และอื่น ๆ' },
					{ ja: 'パンやたまごをかいました。', en: 'I bought bread, eggs and a few other things.', th: 'ซื้อขนมปัง ไข่ และของอื่น ๆ' },
					{ ja: '休みの日は、母や友だちと出かけます。', en: 'On my days off I go out with my mother, friends and others.', th: 'วันหยุดฉันออกไปข้างนอกกับแม่ เพื่อน และคนอื่น ๆ' },
					{ ja: '父はやさいやくだものが好きです。', en: 'My father likes vegetables, fruit and so on.', th: 'พ่อชอบผัก ผลไม้ และอื่น ๆ' },
					{ ja: 'かばんの中にペンやさいふなどがあります。', en: 'In the bag there are pens, a wallet and so on.', th: 'ในกระเป๋ามีปากกา กระเป๋าสตางค์ เป็นต้น' }
				]
			},
			{
				id: 'n5-dare-ga',
				pattern: 'だれが・何が',
				formation: 'question word が V / A',
				meaning: { en: 'who …? what …? (the question word is the subject)', th: 'ใคร … / อะไร … (คำถามเป็นประธาน)' },
				note: {
					en: 'A question word can never take は, so a subject question uses が: だれが来ましたか. The answer keeps が too: 父が来ました.',
					th: 'คำแสดงคำถามใช้กับ は ไม่ได้ ถ้าถามประธานให้ใช้ が เช่น だれが来ましたか ตอนตอบก็ใช้ が เช่นกัน เช่น 父が来ました'
				},
				examples: [
					{ ja: 'だれが来ましたか。', en: 'Who came?', th: 'ใครมา' },
					{ ja: '「だれが先生ですか。」「あの女の人です。」', en: '“Who is the teacher?” “That woman.”', th: '“ใครเป็นครู” “ผู้หญิงคนนั้น”' },
					{ ja: 'どれがあなたのかさですか。', en: 'Which one is your umbrella?', th: 'คันไหนเป็นร่มของคุณ' },
					{ ja: 'へやに何がありますか。', en: 'What is in the room?', th: 'ในห้องมีอะไร' },
					{ ja: '「だれがピアノをひきますか。」「母がひきます。」', en: '“Who plays the piano?” “My mother does.”', th: '“ใครเล่นเปียโน” “แม่เล่น”' }
				]
			}
		],
		reading: {
			title: { en: 'My family', th: 'ครอบครัวของฉัน' },
			lines: [
				{ ja: 'わたしのかぞくは五人です。', en: 'There are five people in my family.', th: 'ครอบครัวของฉันมีห้าคน' },
				{ ja: '父と母とあにといもうとと、わたしです。', en: 'My father, my mother, my older brother, my younger sister and me.', th: 'พ่อ แม่ พี่ชาย น้องสาว และฉัน' },
				{ ja: '父は五十さいで、先生です。母はいしゃです。', en: 'My father is fifty and a teacher. My mother is a doctor.', th: 'พ่ออายุห้าสิบปีและเป็นครู แม่เป็นหมอ' },
				{ ja: 'あには今、日本にいます。', en: 'My older brother is in Japan now.', th: 'ตอนนี้พี่ชายอยู่ที่ญี่ปุ่น' },
				{ ja: 'いもうとは十二さいです。ねこやいぬが好きです。', en: 'My younger sister is twelve. She likes cats, dogs and so on.', th: 'น้องสาวอายุสิบสองปี ชอบแมว หมา และสัตว์อื่น ๆ' }
			],
			questions: [
				{
					q: { en: 'How many people are in the family?', th: 'ครอบครัวนี้มีกี่คน' },
					choices: [
						{ en: 'Four', th: 'สี่คน' },
						{ en: 'Five', th: 'ห้าคน' },
						{ en: 'Six', th: 'หกคน' }
					],
					answer: 1
				},
				{
					q: { en: 'What does the mother do?', th: 'แม่ทำอาชีพอะไร' },
					choices: [
						{ en: 'She is a teacher.', th: 'เป็นครู' },
						{ en: 'She is a doctor.', th: 'เป็นหมอ' },
						{ en: 'She is an office worker.', th: 'เป็นพนักงานบริษัท' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-13',
		level: 'N5',
		title: { en: 'Describing places', th: 'บรรยายสถานที่' },
		goal: { en: 'Describe people and places with な-adjectives and say “not very”.', th: 'บรรยายคนและสถานที่ด้วยคุณศัพท์ な และพูดว่า “ไม่ค่อย”' },
		kanji: ['大', '小', '長'],
		words: [
			{ reading: 'おおきい', kanji: '大きい', gloss: { en: 'big', th: 'ใหญ่' }, kind: 'word' },
			{ reading: 'ちいさい', kanji: '小さい', gloss: { en: 'small', th: 'เล็ก' }, kind: 'word' },
			{ reading: 'ながい', kanji: '長い', gloss: { en: 'long', th: 'ยาว' }, kind: 'word' },
			{ reading: 'みじかい', kanji: '短い', gloss: { en: 'short', th: 'สั้น' }, kind: 'word' },
			{ reading: 'ひろい', kanji: '広い', gloss: { en: 'wide; spacious', th: 'กว้าง' }, kind: 'word' },
			{ reading: 'せまい', kanji: '狭い', gloss: { en: 'narrow; small (room)', th: 'แคบ' }, kind: 'word' },
			{ reading: 'きれい', kanji: '綺麗', gloss: { en: 'pretty; clean', th: 'สวย; สะอาด' }, kind: 'word' },
			{ reading: 'しずか', kanji: '静か', gloss: { en: 'quiet', th: 'เงียบ' }, kind: 'word' },
			{ reading: 'にぎやか', kanji: '賑やか', gloss: { en: 'lively; busy', th: 'คึกคัก' }, kind: 'word' },
			{ reading: 'ゆうめい', kanji: '有名', gloss: { en: 'famous', th: 'มีชื่อเสียง' }, kind: 'word' },
			{ reading: 'しんせつ', kanji: '親切', gloss: { en: 'kind', th: 'ใจดี' }, kind: 'word' },
			{ reading: 'げんき', kanji: '元気', gloss: { en: 'well; lively', th: 'สบายดี; ร่าเริง' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-na-adj',
				pattern: '〜です・〜じゃないです（な-adjective）',
				formation: 'N は A です / A じゃないです',
				meaning: { en: 'N is (not) A, with a な-adjective', th: 'N (ไม่) … ใช้กับคุณศัพท์ な' },
				note: {
					en: 'な-adjectives work like nouns: しずかです, しずかじゃないです. きれい ends in い but is a な-adjective, so it is きれいじゃないです.',
					th: 'คุณศัพท์ な ผันเหมือนคำนาม: しずかです, しずかじゃないです คำว่า きれい ลงท้ายด้วย い แต่เป็นคุณศัพท์ な จึงพูดว่า きれいじゃないです'
				},
				examples: [
					{ ja: 'このまちはしずかです。', en: 'This town is quiet.', th: 'เมืองนี้เงียบสงบ' },
					{ ja: '山田さんはしんせつです。', en: 'Mr Yamada is kind.', th: 'คุณยามาดะใจดี' },
					{ ja: 'この川はきれいです。', en: 'This river is clean.', th: 'แม่น้ำสายนี้สะอาด' },
					{ ja: '今日、田中さんはげんきじゃないです。', en: 'Ms Tanaka isn’t herself today.', th: 'วันนี้คุณทานากะดูไม่ค่อยสดใส' },
					{ ja: 'このレストランはゆうめいです。', en: 'This restaurant is famous.', th: 'ร้านอาหารร้านนี้มีชื่อเสียง' }
				]
			},
			{
				id: 'n5-adj-noun',
				pattern: 'A-い N・A-な N',
				formation: 'A-い + N / A + な + N',
				meaning: { en: 'an adjective before a noun', th: 'คุณศัพท์ขยายคำนาม' },
				note: {
					en: 'The adjective comes before the noun, the opposite of Thai. い-adjectives go straight in (大きい木); な-adjectives add な (しずかなへや).',
					th: 'คุณศัพท์อยู่หน้าคำนาม กลับกันกับภาษาไทย คุณศัพท์ い วางหน้าคำนามได้เลย (大きい木) ส่วนคุณศัพท์ な ต้องเติม な (しずかなへや)'
				},
				examples: [
					{ ja: '大きい木があります。', en: 'There is a big tree.', th: 'มีต้นไม้ใหญ่' },
					{ ja: '小さい車がほしいです。', en: 'I want a small car.', th: 'อยากได้รถคันเล็ก' },
					{ ja: 'しずかなへやで本を読みます。', en: 'I read in a quiet room.', th: 'อ่านหนังสือในห้องที่เงียบ' },
					{ ja: '長い川ですね。', en: 'It’s a long river, isn’t it?', th: 'แม่น้ำยาวจังเลยนะ' },
					{ ja: '山田さんはしんせつな人です。', en: 'Mr Yamada is a kind person.', th: 'คุณยามาดะเป็นคนใจดี' }
				]
			},
			{
				id: 'n5-amari',
				pattern: 'あまり〜ない',
				formation: 'あまり + negative',
				meaning: { en: 'not very; not much', th: 'ไม่ค่อย …' },
				note: {
					en: 'あまり goes with a negative: あまり大きくないです (not very big), あまり見ません (I don’t watch much).',
					th: 'あまり ใช้คู่กับรูปปฏิเสธ เช่น あまり大きくないです (ไม่ค่อยใหญ่) あまり見ません (ไม่ค่อยดู)'
				},
				examples: [
					{ ja: 'このへやはあまり大きくないです。', en: 'This room isn’t very big.', th: 'ห้องนี้ไม่ค่อยใหญ่' },
					{ ja: '日本語はあまりむずかしくないです。', en: 'Japanese isn’t very difficult.', th: 'ภาษาญี่ปุ่นไม่ค่อยยาก' },
					{ ja: 'あまりテレビを見ません。', en: 'I don’t watch TV much.', th: 'ไม่ค่อยดูทีวี' },
					{ ja: 'このまちはあまりにぎやかじゃないです。', en: 'This town isn’t very lively.', th: 'เมืองนี้ไม่ค่อยคึกคัก' },
					{ ja: 'コーヒーはあまり好きじゃないです。', en: 'I don’t like coffee much.', th: 'ไม่ค่อยชอบกาแฟ' }
				]
			}
		],
		reading: {
			title: { en: 'My town', th: 'เมืองของฉัน' },
			lines: [
				{ ja: 'わたしのまちは小さいです。', en: 'My town is small.', th: 'เมืองของฉันเล็ก' },
				{ ja: 'でも、きれいな川と大きい山があります。', en: 'But it has a clean river and a big mountain.', th: 'แต่มีแม่น้ำที่สะอาดและภูเขาลูกใหญ่' },
				{ ja: 'まちの人はとてもしんせつです。', en: 'The people in the town are very kind.', th: 'คนในเมืองใจดีมาก' },
				{ ja: 'えきの前はあまりにぎやかじゃないです。', en: 'The area in front of the station isn’t very lively.', th: 'หน้าสถานีไม่ค่อยคึกคัก' },
				{ ja: 'わたしはこのしずかなまちが好きです。', en: 'I like this quiet town.', th: 'ฉันชอบเมืองที่เงียบสงบแห่งนี้' }
			],
			questions: [
				{
					q: { en: 'What is the town like?', th: 'เมืองนี้เป็นอย่างไร' },
					choices: [
						{ en: 'Big and lively', th: 'ใหญ่และคึกคัก' },
						{ en: 'Small and quiet', th: 'เล็กและเงียบสงบ' },
						{ en: 'Famous and expensive', th: 'มีชื่อเสียงและแพง' }
					],
					answer: 1
				},
				{
					q: { en: 'What does the town have?', th: 'ในเมืองมีอะไร' },
					choices: [
						{ en: 'A clean river and a big mountain', th: 'แม่น้ำที่สะอาดและภูเขาลูกใหญ่' },
						{ en: 'A big station', th: 'สถานีขนาดใหญ่' },
						{ en: 'A famous restaurant', th: 'ร้านอาหารที่มีชื่อเสียง' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-14',
		level: 'N5',
		title: { en: 'The weather', th: 'สภาพอากาศ' },
		goal: { en: 'Talk about the weather, say how things were and give a reason.', th: 'พูดเรื่องอากาศ บอกว่าเมื่อก่อนเป็นอย่างไร และให้เหตุผล' },
		kanji: ['天', '気', '雨'],
		words: [
			{ reading: 'てんき', kanji: '天気', gloss: { en: 'weather', th: 'อากาศ; สภาพอากาศ' }, kind: 'word' },
			{ reading: 'あめ', kanji: '雨', gloss: { en: 'rain', th: 'ฝน' }, kind: 'word' },
			{ reading: 'ゆき', kanji: '雪', gloss: { en: 'snow', th: 'หิมะ' }, kind: 'word' },
			{ reading: 'はれ', kanji: '晴れ', gloss: { en: 'sunny weather', th: 'อากาศแจ่มใส' }, kind: 'word' },
			{ reading: 'くもり', kanji: '曇り', gloss: { en: 'cloudy weather', th: 'มีเมฆมาก' }, kind: 'word' },
			{ reading: 'あつい', kanji: '暑い', gloss: { en: 'hot (weather)', th: 'ร้อน (อากาศ)' }, kind: 'word' },
			{ reading: 'さむい', kanji: '寒い', gloss: { en: 'cold (weather)', th: 'หนาว' }, kind: 'word' },
			{ reading: 'あたたかい', kanji: '暖かい', gloss: { en: 'warm', th: 'อบอุ่น' }, kind: 'word' },
			{ reading: 'すずしい', kanji: '涼しい', gloss: { en: 'cool', th: 'เย็นสบาย' }, kind: 'word' },
			{ reading: 'かぜ', kanji: '風', gloss: { en: 'wind', th: 'ลม' }, kind: 'word' },
			{ reading: 'そら', kanji: '空', gloss: { en: 'sky', th: 'ท้องฟ้า' }, kind: 'word' },
			{ reading: 'てんきよほう', kanji: '天気予報', gloss: { en: 'weather forecast', th: 'พยากรณ์อากาศ' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-adj-past',
				pattern: '〜かったです・〜でした',
				formation: 'A-い → A-かったです / A-な, N → でした',
				meaning: { en: 'was A; was N (past of adjectives and nouns)', th: '… (ในอดีต) รูปอดีตของคุณศัพท์และคำนาม' },
				note: {
					en: 'い-adjectives drop い and add かったです: さむい → さむかったです. いい becomes よかったです. な-adjectives and nouns take でした. Past negative: くなかったです, じゃなかったです.',
					th: 'คุณศัพท์ い ตัด い แล้วเติม かったです เช่น さむい → さむかったです ส่วน いい กลายเป็น よかったです คุณศัพท์ な และคำนามใช้ でした รูปอดีตปฏิเสธคือ くなかったです และ じゃなかったです'
				},
				examples: [
					{ ja: 'きのうはさむかったです。', en: 'It was cold yesterday.', th: 'เมื่อวานหนาว' },
					{ ja: 'きのうのテストはむずかしくなかったです。', en: 'Yesterday’s test wasn’t difficult.', th: 'ข้อสอบเมื่อวานไม่ยาก' },
					{ ja: 'きのうは雨でした。', en: 'It rained yesterday.', th: 'เมื่อวานฝนตก' },
					{ ja: 'りょこうはたのしかったです。', en: 'The trip was fun.', th: 'การเที่ยวสนุกมาก' },
					{ ja: '山はとてもしずかでした。', en: 'The mountains were very quiet.', th: 'ภูเขาเงียบมาก' }
				]
			},
			{
				id: 'n5-deshou',
				pattern: '〜でしょう',
				formation: 'N / A + でしょう',
				meaning: { en: 'probably; it will likely be …', th: 'คงจะ …; น่าจะ …' },
				note: {
					en: 'でしょう is how weather forecasts talk: 明日は雨でしょう. With a rising tone it asks the listener to agree: “…, right?”',
					th: 'でしょう เป็นสำนวนที่พยากรณ์อากาศใช้ เช่น 明日は雨でしょう ถ้าพูดเสียงสูงขึ้นท้ายประโยค จะเป็นการถามให้อีกฝ่ายเห็นด้วยว่า “… ใช่ไหม”'
				},
				examples: [
					{ ja: '明日は雨でしょう。', en: 'It will probably rain tomorrow.', th: 'พรุ่งนี้ฝนคงจะตก' },
					{ ja: '午後は天気がいいでしょう。', en: 'The weather will probably be good in the afternoon.', th: 'ช่วงบ่ายอากาศน่าจะดี' },
					{ ja: '北のほうはさむいでしょう。', en: 'It will probably be cold in the north.', th: 'ทางเหนือน่าจะหนาว' },
					{ ja: 'あのレストランは高いでしょう。', en: 'That restaurant is probably expensive.', th: 'ร้านอาหารร้านนั้นคงจะแพง' },
					{ ja: '明日は天気がいいでしょうか。', en: 'Will the weather be good tomorrow, do you think?', th: 'พรุ่งนี้อากาศจะดีไหมนะ' }
				]
			},
			{
				id: 'n5-kara-because',
				pattern: '〜から（reason）',
				formation: 'reason + から、result',
				meaning: { en: 'because …, so …', th: 'เพราะ … จึง …' },
				note: {
					en: 'The reason comes first, then から, then what happens. This から means “because”, not “from” (n5-04).',
					th: 'เหตุผลอยู่ข้างหน้า ตามด้วย から แล้วจึงเป็นผล から ตัวนี้แปลว่า “เพราะ” ไม่ใช่ “จาก” (บทที่ 4)'
				},
				examples: [
					{ ja: '雨ですから、行きません。', en: 'It’s raining, so I’m not going.', th: 'ฝนตก เลยไม่ไป' },
					{ ja: '天気がいいですから、山に行きましょう。', en: 'The weather is nice, so let’s go to the mountains.', th: 'อากาศดี ไปภูเขากันเถอะ' },
					{ ja: 'あついですから、水をのみます。', en: 'It’s hot, so I’ll drink some water.', th: 'ร้อน เลยจะดื่มน้ำ' },
					{ ja: '「どうして来ませんでしたか。」「雨でしたから。」', en: '“Why didn’t you come?” “Because it was raining.”', th: '“ทำไมไม่มา” “เพราะฝนตก”' },
					{ ja: '今日はひまですから、えいがを見ます。', en: 'I’m free today, so I’ll watch a movie.', th: 'วันนี้ว่าง เลยจะดูหนัง' }
				]
			}
		],
		reading: {
			title: { en: 'Today’s forecast', th: 'พยากรณ์อากาศวันนี้' },
			lines: [
				{ ja: '今日の天気です。', en: 'Here is today’s weather.', th: 'นี่คือสภาพอากาศวันนี้' },
				{ ja: '北は、午前は雪でしょう。とてもさむいでしょう。', en: 'In the north it will probably snow in the morning. It will be very cold.', th: 'ทางเหนือช่วงเช้าน่าจะมีหิมะตก และน่าจะหนาวมาก' },
				{ ja: '南は天気がいいでしょう。あたたかいでしょう。', en: 'In the south the weather will probably be good and warm.', th: 'ทางใต้อากาศน่าจะดีและอบอุ่น' },
				{ ja: '西は午後から雨でしょう。', en: 'In the west it will probably rain from the afternoon.', th: 'ทางตะวันตกน่าจะมีฝนตกตั้งแต่ช่วงบ่าย' },
				{ ja: '明日は、どこも天気がいいでしょう。', en: 'Tomorrow the weather will probably be good everywhere.', th: 'พรุ่งนี้อากาศน่าจะดีทุกพื้นที่' }
			],
			questions: [
				{
					q: { en: 'What will the morning be like in the north?', th: 'ช่วงเช้าทางเหนืออากาศจะเป็นอย่างไร' },
					choices: [
						{ en: 'Rain', th: 'ฝนตก' },
						{ en: 'Snow', th: 'หิมะตก' },
						{ en: 'Sunny and warm', th: 'แจ่มใสและอบอุ่น' }
					],
					answer: 1
				},
				{
					q: { en: 'When will it rain in the west?', th: 'ทางตะวันตกฝนจะตกเมื่อไร' },
					choices: [
						{ en: 'In the morning', th: 'ช่วงเช้า' },
						{ en: 'From the afternoon', th: 'ตั้งแต่ช่วงบ่าย' },
						{ en: 'Tomorrow', th: 'พรุ่งนี้' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-15',
		level: 'N5',
		title: { en: 'School and likes', th: 'โรงเรียนและสิ่งที่ชอบ' },
		goal: { en: 'Say what you like and what you are good at, and join two sentences with “but”.', th: 'บอกสิ่งที่ชอบและสิ่งที่ถนัด และเชื่อมสองประโยคด้วย “แต่”' },
		kanji: ['学', '校', '友'],
		words: [
			{ reading: 'だいがく', kanji: '大学', gloss: { en: 'university', th: 'มหาวิทยาลัย' }, kind: 'word' },
			{ reading: 'こうこう', kanji: '高校', gloss: { en: 'high school', th: 'โรงเรียนมัธยมปลาย' }, kind: 'word' },
			{ reading: 'りゅうがくせい', kanji: '留学生', gloss: { en: 'international student', th: 'นักเรียนต่างชาติ' }, kind: 'word' },
			{ reading: 'ゆうじん', kanji: '友人', gloss: { en: 'friend (formal)', th: 'เพื่อน (ภาษาทางการ)' }, kind: 'word' },
			{ reading: 'しゅくだい', kanji: '宿題', gloss: { en: 'homework', th: 'การบ้าน' }, kind: 'word' },
			{ reading: 'じゅぎょう', kanji: '授業', gloss: { en: 'class; lesson', th: 'คาบเรียน' }, kind: 'word' },
			{ reading: 'すき', kanji: '好き', gloss: { en: 'liked; to like', th: 'ชอบ' }, kind: 'word' },
			{ reading: 'きらい', kanji: '嫌い', gloss: { en: 'disliked; to dislike', th: 'ไม่ชอบ; เกลียด' }, kind: 'word' },
			{ reading: 'じょうず', kanji: '上手', gloss: { en: 'good at; skilful', th: 'เก่ง' }, kind: 'word' },
			{ reading: 'へた', kanji: '下手', gloss: { en: 'bad at; unskilful', th: 'ไม่เก่ง' }, kind: 'word' },
			{ reading: 'とくい', kanji: '得意', gloss: { en: 'good at (one’s strong point)', th: 'ถนัด' }, kind: 'word' },
			{ reading: 'うた', kanji: '歌', gloss: { en: 'song', th: 'เพลง' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-suki',
				pattern: '〜が好きです・〜がきらいです',
				formation: 'N が 好きです / きらいです',
				meaning: { en: 'I like N / I dislike N', th: 'ชอบ N / ไม่ชอบ N' },
				note: {
					en: 'The thing you like takes が, not を. 大好き means “love”. きらい sounds strong, so あまり好きじゃない is the gentler way to say you don’t like something.',
					th: 'สิ่งที่ชอบใช้คำช่วย が ไม่ใช่ を ส่วน 大好き แปลว่า “ชอบมาก” คำว่า きらい ฟังดูแรง การพูดว่า あまり好きじゃない จึงนุ่มนวลกว่า'
				},
				examples: [
					{ ja: 'わたしはねこが好きです。', en: 'I like cats.', th: 'ฉันชอบแมว' },
					{ ja: '「何のスポーツが好きですか。」「サッカーが好きです。」', en: '“Which sport do you like?” “I like football.”', th: '“ชอบกีฬาอะไร” “ชอบฟุตบอล”' },
					{ ja: 'やさいがきらいです。', en: 'I don’t like vegetables.', th: 'ไม่ชอบผัก' },
					{ ja: '田中さんは日本のうたが大好きです。', en: 'Ms Tanaka loves Japanese songs.', th: 'คุณทานากะชอบเพลงญี่ปุ่นมาก' },
					{ ja: 'どんな食べものが好きですか。', en: 'What kind of food do you like?', th: 'ชอบอาหารแบบไหน' }
				]
			},
			{
				id: 'n5-jouzu',
				pattern: '〜が上手です・〜がへたです',
				formation: 'N が 上手です / へたです / とくいです',
				meaning: { en: 'good at N / bad at N', th: 'เก่ง N / ไม่เก่ง N' },
				note: {
					en: '上手 is praise for someone else. About yourself say とくいです. When someone praises your Japanese, the modest reply is いいえ、まだまだです.',
					th: '上手 ใช้ชมคนอื่น ถ้าพูดถึงตัวเองให้ใช้ とくいです เมื่อมีคนชมภาษาญี่ปุ่นของเรา ให้ตอบอย่างถ่อมตัวว่า いいえ、まだまだです'
				},
				examples: [
					{ ja: 'リンさんは日本語が上手ですね。', en: 'Your Japanese is good, Lin.', th: 'คุณลินพูดภาษาญี่ปุ่นเก่งจังเลย' },
					{ ja: 'いいえ、まだまだです。', en: 'Oh no, I still have a long way to go.', th: 'ไม่หรอกค่ะ ยังต้องฝึกอีกเยอะ' },
					{ ja: '父はりょうりが上手です。', en: 'My father is a good cook.', th: 'พ่อทำอาหารเก่ง' },
					{ ja: 'わたしはうたがへたです。', en: 'I’m bad at singing.', th: 'ฉันร้องเพลงไม่เก่ง' },
					{ ja: 'わたしはテニスがとくいです。', en: 'Tennis is my strong point.', th: 'ฉันถนัดเทนนิส' }
				]
			},
			{
				id: 'n5-ga-but',
				pattern: '〜が、〜',
				formation: 'sentence 1 が、sentence 2',
				meaning: { en: '…, but …', th: '… แต่ …' },
				note: {
					en: 'が after a full sentence means “but”. It also softens a request: すみませんが、… でも does the same job at the start of a new sentence.',
					th: 'が หลังประโยคที่สมบูรณ์แปลว่า “แต่” ยังใช้ทำให้คำขอนุ่มนวลขึ้นได้ เช่น すみませんが、… ส่วน でも มีความหมายเดียวกันแต่ใช้ขึ้นต้นประโยคใหม่'
				},
				examples: [
					{ ja: '日本語はむずかしいですが、おもしろいです。', en: 'Japanese is difficult, but it’s interesting.', th: 'ภาษาญี่ปุ่นยาก แต่สนุก' },
					{ ja: 'このへやは小さいですが、きれいです。', en: 'This room is small, but it’s clean.', th: 'ห้องนี้เล็ก แต่สะอาด' },
					{ ja: 'すみませんが、トイレはどこですか。', en: 'Excuse me, but where is the toilet?', th: 'ขอโทษนะคะ ห้องน้ำอยู่ที่ไหนคะ' },
					{ ja: 'にくは好きですが、さかなはきらいです。', en: 'I like meat, but I don’t like fish.', th: 'ชอบเนื้อ แต่ไม่ชอบปลา' },
					{ ja: '友だちは来ましたが、先生は来ませんでした。', en: 'My friends came, but the teacher didn’t.', th: 'เพื่อนมา แต่ครูไม่มา' }
				]
			}
		],
		reading: {
			title: { en: 'Lin’s university', th: 'มหาวิทยาลัยของลิน' },
			lines: [
				{ ja: 'わたしは大学の一年生です。', en: 'I’m a first-year university student.', th: 'ฉันเป็นนักศึกษาปีหนึ่ง' },
				{ ja: '大学に友だちがたくさんいます。', en: 'I have lots of friends at university.', th: 'ที่มหาวิทยาลัยฉันมีเพื่อนเยอะ' },
				{ ja: '日本語のじゅぎょうはむずかしいですが、おもしろいです。', en: 'The Japanese classes are difficult, but interesting.', th: 'คาบภาษาญี่ปุ่นยาก แต่สนุก' },
				{ ja: 'わたしはうたが好きです。でも、あまり上手じゃないです。', en: 'I like singing. But I’m not very good at it.', th: 'ฉันชอบร้องเพลง แต่ร้องไม่ค่อยเก่ง' },
				{ ja: '友だちのナリンさんはうたがとても上手です。', en: 'My friend Narin is a very good singer.', th: 'นารินเพื่อนของฉันร้องเพลงเก่งมาก' }
			],
			questions: [
				{
					q: { en: 'What is Lin?', th: 'ลินเป็นใคร' },
					choices: [
						{ en: 'A first-year university student', th: 'นักศึกษามหาวิทยาลัยปีหนึ่ง' },
						{ en: 'A high school student', th: 'นักเรียนมัธยมปลาย' },
						{ en: 'A Japanese teacher', th: 'ครูสอนภาษาญี่ปุ่น' }
					],
					answer: 0
				},
				{
					q: { en: 'Who is a very good singer?', th: 'ใครร้องเพลงเก่งมาก' },
					choices: [
						{ en: 'Lin', th: 'ลิน' },
						{ en: 'Narin', th: 'นาริน' },
						{ en: 'The teacher', th: 'ครู' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-16',
		level: 'N5',
		title: { en: 'Asking the way', th: 'ถามทาง' },
		goal: { en: 'Follow and give directions with the て-form and ask politely with てください.', th: 'ฟังและบอกทางด้วยรูป て และขอร้องอย่างสุภาพด้วย てください' },
		kanji: ['東', '西', '南', '北'],
		words: [
			{ reading: 'ひがし', kanji: '東', gloss: { en: 'east', th: 'ทิศตะวันออก' }, kind: 'word' },
			{ reading: 'にし', kanji: '西', gloss: { en: 'west', th: 'ทิศตะวันตก' }, kind: 'word' },
			{ reading: 'みなみ', kanji: '南', gloss: { en: 'south', th: 'ทิศใต้' }, kind: 'word' },
			{ reading: 'きた', kanji: '北', gloss: { en: 'north', th: 'ทิศเหนือ' }, kind: 'word' },
			{ reading: 'ひがしぐち', kanji: '東口', gloss: { en: 'east exit', th: 'ทางออกฝั่งตะวันออก' }, kind: 'word' },
			{ reading: 'にしぐち', kanji: '西口', gloss: { en: 'west exit', th: 'ทางออกฝั่งตะวันตก' }, kind: 'word' },
			{ reading: 'みち', kanji: '道', gloss: { en: 'road; way', th: 'ถนน; ทาง' }, kind: 'word' },
			{ reading: 'かど', kanji: '角', gloss: { en: 'corner', th: 'หัวมุม' }, kind: 'word' },
			{ reading: 'しんごう', kanji: '信号', gloss: { en: 'traffic light', th: 'สัญญาณไฟจราจร' }, kind: 'word' },
			{ reading: 'まっすぐ', gloss: { en: 'straight ahead', th: 'ตรงไป' }, kind: 'word' },
			{ reading: 'わたる', kanji: '渡る', gloss: { en: 'to cross', th: 'ข้าม' }, kind: 'word' },
			{ reading: 'まがる', kanji: '曲がる', gloss: { en: 'to turn', th: 'เลี้ยว' }, kind: 'word' },
			{ reading: 'あるく', kanji: '歩く', gloss: { en: 'to walk', th: 'เดิน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-wo-through',
				pattern: '〜を（through）',
				formation: 'place を あるく / わたる / まがる',
				meaning: { en: 'along; through; across (a place you move over)', th: 'ไปตาม; ผ่าน; ข้าม (สถานที่ที่เคลื่อนผ่าน)' },
				note: {
					en: 'With verbs of moving, を marks the space you move along or through: 道をあるく (walk along the road), はしをわたる (cross the bridge).',
					th: 'เมื่อใช้กับกริยาการเคลื่อนที่ を บอกพื้นที่ที่เคลื่อนผ่าน เช่น 道をあるく (เดินไปตามถนน) はしをわたる (ข้ามสะพาน)'
				},
				examples: [
					{ ja: '毎朝、川のそばをあるきます。', en: 'Every morning I walk along the river.', th: 'ทุกเช้าฉันเดินเลียบแม่น้ำ' },
					{ ja: 'はしをわたります。', en: 'I cross the bridge.', th: 'ข้ามสะพาน' },
					{ ja: 'こうえんをさんぽします。', en: 'I take a walk in the park.', th: 'เดินเล่นในสวนสาธารณะ' },
					{ ja: 'かどを右にまがります。', en: 'I turn right at the corner.', th: 'เลี้ยวขวาที่หัวมุม' },
					{ ja: 'この道をまっすぐ行きます。', en: 'I go straight along this road.', th: 'ตรงไปตามถนนสายนี้' }
				]
			},
			{
				id: 'n5-te-form',
				pattern: '〜て、〜',
				formation: 'う・つ・る → って / む・ぶ・ぬ → んで / く → いて / ぐ → いで / す → して / る-verbs → て / する → して, 来る → きて, 行く → 行って',
				meaning: { en: 'do A and (then) B', th: 'ทำ A แล้ว (ก็) ทำ B' },
				note: {
					en: 'The て-form links actions in order. Only the last verb shows the tense: おきて、食べました means “got up and ate”. 行く is the one く-verb that becomes って.',
					th: 'รูป て ใช้เชื่อมการกระทำตามลำดับ กาลจะแสดงที่กริยาตัวสุดท้ายเท่านั้น เช่น おきて、食べました แปลว่า “ตื่นแล้วกิน” ส่วน 行く เป็นกริยา く ตัวเดียวที่กลายเป็น って'
				},
				examples: [
					{ ja: 'あさ、おきて、ごはんを食べます。', en: 'In the morning I get up and eat.', th: 'ตอนเช้าตื่นนอนแล้วกินข้าว' },
					{ ja: '東口を出て、右にまがります。', en: 'Go out the east exit and turn right.', th: 'ออกทางออกฝั่งตะวันออกแล้วเลี้ยวขวา' },
					{ ja: '友だちにあって、えいがを見ました。', en: 'I met a friend and we watched a movie.', th: 'เจอเพื่อนแล้วดูหนังด้วยกัน' },
					{ ja: '本を読んで、ねました。', en: 'I read a book and went to bed.', th: 'อ่านหนังสือแล้วเข้านอน' },
					{ ja: 'かどを左にまがって、まっすぐ行きます。', en: 'Turn left at the corner and go straight.', th: 'เลี้ยวซ้ายที่หัวมุมแล้วตรงไป' }
				]
			},
			{
				id: 'n5-te-kudasai',
				pattern: '〜てください',
				formation: 'V-て ください',
				meaning: { en: 'please do …', th: 'กรุณา …; ช่วย … หน่อย' },
				note: {
					en: 'A polite request, used for directions and instructions. To a superior, ていただけませんか is softer; you will meet it at N4.',
					th: 'เป็นการขอร้องอย่างสุภาพ ใช้บอกทางและให้คำแนะนำ ถ้าพูดกับผู้ใหญ่ ていただけませんか จะนุ่มนวลกว่า ซึ่งจะได้เรียนในระดับ N4'
				},
				examples: [
					{ ja: 'ちょっと見てください。', en: 'Please take a look.', th: 'ช่วยดูหน่อย' },
					{ ja: 'ここに名前を書いてください。', en: 'Please write your name here.', th: 'กรุณาเขียนชื่อตรงนี้' },
					{ ja: '二つ目のかどを右にまがってください。', en: 'Please turn right at the second corner.', th: 'กรุณาเลี้ยวขวาที่หัวมุมที่สอง' },
					{ ja: 'ゆっくり話してください。', en: 'Please speak slowly.', th: 'ช่วยพูดช้า ๆ หน่อย' },
					{ ja: '南口でまってください。', en: 'Please wait at the south exit.', th: 'กรุณารอที่ทางออกฝั่งใต้' }
				]
			}
		],
		reading: {
			title: { en: 'Where is the hospital?', th: 'โรงพยาบาลอยู่ที่ไหน' },
			lines: [
				{ ja: 'リン：すみません、山田びょういんはどこですか。', en: 'Lin: Excuse me, where is Yamada Hospital?', th: 'ลิน: ขอโทษค่ะ โรงพยาบาลยามาดะอยู่ที่ไหนคะ' },
				{ ja: '男の人：えきの東口を出て、まっすぐ行ってください。', en: 'Man: Go out the east exit of the station and go straight.', th: 'ผู้ชาย: ออกทางออกฝั่งตะวันออกของสถานี แล้วตรงไปครับ' },
				{ ja: '男の人：二つ目のしんごうを左にまがってください。', en: 'Man: Turn left at the second traffic light.', th: 'ผู้ชาย: เลี้ยวซ้ายที่สัญญาณไฟจราจรที่สองครับ' },
				{ ja: '男の人：はしをわたって、右にあります。', en: 'Man: Cross the bridge, and it’s on the right.', th: 'ผู้ชาย: ข้ามสะพานไป แล้วจะอยู่ทางขวาครับ' },
				{ ja: 'リン：ありがとうございます。', en: 'Lin: Thank you very much.', th: 'ลิน: ขอบคุณมากค่ะ' }
			],
			questions: [
				{
					q: { en: 'Which exit should Lin use?', th: 'ลินควรออกทางออกไหน' },
					choices: [
						{ en: 'The east exit', th: 'ทางออกฝั่งตะวันออก' },
						{ en: 'The west exit', th: 'ทางออกฝั่งตะวันตก' },
						{ en: 'The north exit', th: 'ทางออกฝั่งเหนือ' }
					],
					answer: 0
				},
				{
					q: { en: 'What should she do at the second traffic light?', th: 'ที่สัญญาณไฟจราจรที่สองต้องทำอย่างไร' },
					choices: [
						{ en: 'Turn right', th: 'เลี้ยวขวา' },
						{ en: 'Turn left', th: 'เลี้ยวซ้าย' },
						{ en: 'Cross the bridge', th: 'ข้ามสะพาน' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-17',
		level: 'N5',
		title: { en: 'Going out and coming in', th: 'ออกไปและเข้ามา' },
		goal: { en: 'Say where you leave and enter, and do one thing after another.', th: 'บอกว่าออกจากที่ไหนและเข้าไปที่ไหน และทำสิ่งหนึ่งหลังจากอีกสิ่งหนึ่ง' },
		kanji: ['出', '入', '休'],
		words: [
			{ reading: 'でる', kanji: '出る', gloss: { en: 'to go out; to leave', th: 'ออก; ออกจาก' }, kind: 'word' },
			{ reading: 'はいる', kanji: '入る', gloss: { en: 'to enter; to go in', th: 'เข้า; เข้าไป' }, kind: 'word' },
			{ reading: 'やすむ', kanji: '休む', gloss: { en: 'to rest; to take time off', th: 'พัก; หยุด (งาน / เรียน)' }, kind: 'word' },
			{ reading: 'やすみ', kanji: '休み', gloss: { en: 'holiday; day off', th: 'วันหยุด' }, kind: 'word' },
			{ reading: 'でぐち', kanji: '出口', gloss: { en: 'exit', th: 'ทางออก' }, kind: 'word' },
			{ reading: 'いりぐち', kanji: '入口', gloss: { en: 'entrance', th: 'ทางเข้า' }, kind: 'word' },
			{ reading: 'でかける', kanji: '出かける', gloss: { en: 'to go out (somewhere)', th: 'ออกไปข้างนอก' }, kind: 'word' },
			{ reading: 'ふろ', kanji: '風呂', gloss: { en: 'bath', th: 'อ่างอาบน้ำ; การแช่น้ำ' }, kind: 'word' },
			{ reading: 'へや', kanji: '部屋', gloss: { en: 'room', th: 'ห้อง' }, kind: 'word' },
			{ reading: 'まど', kanji: '窓', gloss: { en: 'window', th: 'หน้าต่าง' }, kind: 'word' },
			{ reading: 'あける', kanji: '開ける', gloss: { en: 'to open', th: 'เปิด' }, kind: 'word' },
			{ reading: 'しめる', kanji: '閉める', gloss: { en: 'to close; to shut', th: 'ปิด' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-wo-deru',
				pattern: '〜を出ます',
				formation: 'place を 出ます',
				meaning: { en: 'leave a place', th: 'ออกจาก (สถานที่)' },
				note: {
					en: 'The place you leave takes を. 大学を出る can also mean to graduate from university.',
					th: 'สถานที่ที่ออกมาใช้คำช่วย を ประโยค 大学を出る ยังแปลว่าเรียนจบมหาวิทยาลัยได้ด้วย'
				},
				examples: [
					{ ja: '八時にうちを出ます。', en: 'I leave home at eight.', th: 'ออกจากบ้านตอนแปดโมง' },
					{ ja: '七時に学校を出ました。', en: 'I left school at seven.', th: 'ออกจากโรงเรียนตอนหนึ่งทุ่ม' },
					{ ja: '西口を出てください。', en: 'Please go out the west exit.', th: 'กรุณาออกทางออกฝั่งตะวันตก' },
					{ ja: '「何時にうちを出ますか。」「九時です。」', en: '“What time do you leave home?” “At nine.”', th: '“ออกจากบ้านกี่โมง” “เก้าโมง”' },
					{ ja: '先月、大学を出ました。', en: 'I graduated from university last month.', th: 'เดือนที่แล้วเรียนจบมหาวิทยาลัย' }
				]
			},
			{
				id: 'n5-ni-hairu',
				pattern: '〜に入ります',
				formation: 'place に 入ります',
				meaning: { en: 'enter a place; go into', th: 'เข้าไปใน (สถานที่)' },
				note: {
					en: 'The place you go into takes に. おふろに入る means to take a bath, and 入る is also “to join” a club or a school.',
					th: 'สถานที่ที่เข้าไปใช้คำช่วย に ส่วน おふろに入る แปลว่าแช่น้ำอาบน้ำ และ 入る ยังแปลว่า “เข้าร่วม” ชมรมหรือโรงเรียนได้ด้วย'
				},
				examples: [
					{ ja: 'へやに入ります。', en: 'I go into the room.', th: 'เข้าไปในห้อง' },
					{ ja: '毎日、おふろに入ります。', en: 'I take a bath every day.', th: 'แช่น้ำอาบน้ำทุกวัน' },
					{ ja: '今年、大学に入りました。', en: 'I started university this year.', th: 'ปีนี้เข้ามหาวิทยาลัย' },
					{ ja: 'このきっさてんに入りましょう。', en: 'Let’s go into this café.', th: 'เข้าร้านกาแฟนี้กันเถอะ' },
					{ ja: 'テニスのクラブに入りました。', en: 'I joined the tennis club.', th: 'เข้าชมรมเทนนิส' }
				]
			},
			{
				id: 'n5-te-kara',
				pattern: '〜てから',
				formation: 'V-て から',
				meaning: { en: 'after doing A, B', th: 'หลังจากทำ A แล้วจึง B' },
				note: {
					en: 'てから makes the order clear: A is finished before B starts. Plain て only lists actions; てから stresses “first A, then B”.',
					th: 'てから บอกลำดับชัดเจนว่า A เสร็จแล้ว B จึงเริ่ม รูป て ธรรมดาแค่เรียงการกระทำ แต่ てから เน้นว่า “ทำ A ก่อน แล้วค่อย B”'
				},
				examples: [
					{ ja: 'ごはんを食べてから、学校へ行きます。', en: 'After eating, I go to school.', th: 'กินข้าวเสร็จแล้วไปโรงเรียน' },
					{ ja: 'しゅくだいをしてから、テレビを見ます。', en: 'I watch TV after doing my homework.', th: 'ทำการบ้านเสร็จแล้วค่อยดูทีวี' },
					{ ja: 'おふろに入ってから、ねます。', en: 'I take a bath and then go to bed.', th: 'อาบน้ำเสร็จแล้วเข้านอน' },
					{ ja: '電話をしてから、来てください。', en: 'Please call before you come.', th: 'กรุณาโทรมาก่อนแล้วค่อยมา' },
					{ ja: '休んでから、また書きましょう。', en: 'Let’s take a break and then write some more.', th: 'พักก่อนแล้วค่อยเขียนต่อกันเถอะ' }
				]
			}
		],
		reading: {
			title: { en: 'My day off', th: 'วันหยุดของฉัน' },
			lines: [
				{ ja: '今日は休みです。', en: 'Today is my day off.', th: 'วันนี้เป็นวันหยุด' },
				{ ja: '九時におきて、おふろに入りました。', en: 'I got up at nine and took a bath.', th: 'ตื่นตอนเก้าโมงแล้วแช่น้ำอาบน้ำ' },
				{ ja: 'ごはんを食べてから、うちを出ました。', en: 'After eating, I left home.', th: 'กินข้าวเสร็จแล้วก็ออกจากบ้าน' },
				{ ja: 'えきの前のきっさてんに入って、本を読みました。', en: 'I went into the café in front of the station and read a book.', th: 'เข้าร้านกาแฟหน้าสถานีแล้วอ่านหนังสือ' },
				{ ja: '六時にうちへかえりました。', en: 'I went home at six.', th: 'กลับบ้านตอนหกโมงเย็น' }
			],
			questions: [
				{
					q: { en: 'What did the writer do right after getting up?', th: 'ผู้เขียนทำอะไรหลังตื่นนอน' },
					choices: [
						{ en: 'Took a bath', th: 'แช่น้ำอาบน้ำ' },
						{ en: 'Left home', th: 'ออกจากบ้าน' },
						{ en: 'Read a book', th: 'อ่านหนังสือ' }
					],
					answer: 0
				},
				{
					q: { en: 'Where did the writer read a book?', th: 'ผู้เขียนอ่านหนังสือที่ไหน' },
					choices: [
						{ en: 'At home', th: 'ที่บ้าน' },
						{ en: 'At a café', th: 'ที่ร้านกาแฟ' },
						{ en: 'At school', th: 'ที่โรงเรียน' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-18',
		level: 'N5',
		title: { en: 'On the phone', th: 'คุยโทรศัพท์' },
		goal: { en: 'Say what someone is doing now, describe states, and use もう and まだ.', th: 'บอกว่ากำลังทำอะไรอยู่ บอกสภาพที่เป็นอยู่ และใช้ もう กับ まだ' },
		kanji: ['電', '話'],
		words: [
			{ reading: 'でんわ', kanji: '電話', gloss: { en: 'telephone; phone call', th: 'โทรศัพท์' }, kind: 'word' },
			{ reading: 'でんしゃ', kanji: '電車', gloss: { en: 'train', th: 'รถไฟ' }, kind: 'word' },
			{ reading: 'でんき', kanji: '電気', gloss: { en: 'electricity; light', th: 'ไฟฟ้า; ไฟ' }, kind: 'word' },
			{ reading: 'はなす', kanji: '話す', gloss: { en: 'to speak; to talk', th: 'พูด; คุย' }, kind: 'word' },
			{ reading: 'でんわばんごう', kanji: '電話番号', gloss: { en: 'phone number', th: 'เบอร์โทรศัพท์' }, kind: 'word' },
			{ reading: 'すむ', kanji: '住む', gloss: { en: 'to live (somewhere)', th: 'อาศัยอยู่' }, kind: 'word' },
			{ reading: 'はたらく', kanji: '働く', gloss: { en: 'to work', th: 'ทำงาน' }, kind: 'word' },
			{ reading: 'しる', kanji: '知る', gloss: { en: 'to know', th: 'รู้' }, kind: 'word' },
			{ reading: 'けっこん', kanji: '結婚', gloss: { en: 'marriage', th: 'การแต่งงาน' }, kind: 'word' },
			{ reading: 'おしえる', kanji: '教える', gloss: { en: 'to teach; to tell', th: 'สอน; บอก' }, kind: 'word' },
			{ reading: 'もう', gloss: { en: 'already; yet', th: 'แล้ว' }, kind: 'word' },
			{ reading: 'まだ', gloss: { en: 'still; not yet', th: 'ยัง' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-te-iru',
				pattern: '〜ています（now）',
				formation: 'V-て います',
				meaning: { en: 'is doing (right now)', th: 'กำลัง … อยู่' },
				note: {
					en: 'ています says an action is going on now. Ask 何をしていますか (what are you doing?).',
					th: 'ています บอกว่าการกระทำกำลังเกิดขึ้นอยู่ ถามว่า 何をしていますか (กำลังทำอะไรอยู่)'
				},
				examples: [
					{ ja: '今、ごはんを食べています。', en: 'I’m eating right now.', th: 'ตอนนี้กำลังกินข้าวอยู่' },
					{ ja: '母は電話で話しています。', en: 'My mother is talking on the phone.', th: 'แม่กำลังคุยโทรศัพท์อยู่' },
					{ ja: '「何をしていますか。」「本を読んでいます。」', en: '“What are you doing?” “I’m reading a book.”', th: '“กำลังทำอะไรอยู่” “กำลังอ่านหนังสือ”' },
					{ ja: '外は雨がふっています。', en: 'It’s raining outside.', th: 'ข้างนอกฝนกำลังตก' },
					{ ja: '子どもたちは外であそんでいます。', en: 'The children are playing outside.', th: 'เด็ก ๆ กำลังเล่นอยู่ข้างนอก' }
				]
			},
			{
				id: 'n5-te-iru-state',
				pattern: '〜ています（state）',
				formation: 'すんでいます, はたらいています, けっこんしています, しっています',
				meaning: { en: 'a state that continues: lives in, works at, is married, knows', th: 'สภาพที่ยังคงอยู่: อาศัยอยู่ ทำงานที่ แต่งงานแล้ว รู้' },
				note: {
					en: 'Some verbs use ています for a lasting state, not an action. しる is special: “I know” is しっています, but “I don’t know” is しりません.',
					th: 'กริยาบางตัวใช้ ています บอกสภาพที่ยังคงอยู่ ไม่ใช่การกระทำ คำว่า しる เป็นข้อยกเว้น “รู้” พูดว่า しっています แต่ “ไม่รู้” พูดว่า しりません'
				},
				examples: [
					{ ja: 'わたしは今、日本にすんでいます。', en: 'I live in Japan now.', th: 'ตอนนี้ฉันอาศัยอยู่ที่ญี่ปุ่น' },
					{ ja: 'あにはびょういんではたらいています。', en: 'My older brother works at a hospital.', th: 'พี่ชายทำงานที่โรงพยาบาล' },
					{ ja: '山田さんはけっこんしています。', en: 'Mr Yamada is married.', th: 'คุณยามาดะแต่งงานแล้ว' },
					{ ja: '「田中さんの電話ばんごうをしっていますか。」「いいえ、しりません。」', en: '“Do you know Ms Tanaka’s number?” “No, I don’t.”', th: '“รู้เบอร์โทรของคุณทานากะไหม” “ไม่รู้”' },
					{ ja: 'あねは大学で日本語をおしえています。', en: 'My older sister teaches Japanese at a university.', th: 'พี่สาวสอนภาษาญี่ปุ่นที่มหาวิทยาลัย' }
				]
			},
			{
				id: 'n5-mou-mada',
				pattern: 'もう・まだ',
				formation: 'もう V-ました / まだです / まだ V-ていません',
				meaning: { en: 'already; yet / not yet; still', th: '… แล้ว / ยัง …' },
				note: {
					en: 'もう with a past verb means “already”. The short answer “not yet” is いいえ、まだです. まだ with ています means “still”.',
					th: 'もう กับกริยารูปอดีตแปลว่า “… แล้ว” คำตอบสั้น ๆ ว่า “ยัง” คือ いいえ、まだです ส่วน まだ กับ ています แปลว่า “ยัง … อยู่”'
				},
				examples: [
					{ ja: '「もうひるごはんを食べましたか。」「いいえ、まだです。」', en: '“Have you had lunch yet?” “No, not yet.”', th: '“กินข้าวกลางวันแล้วหรือยัง” “ยังเลย”' },
					{ ja: 'もう九時ですよ。', en: 'It’s already nine, you know.', th: 'เก้าโมงแล้วนะ' },
					{ ja: '電車はまだ来ません。', en: 'The train still hasn’t come.', th: 'รถไฟยังไม่มา' },
					{ ja: 'しゅくだいはもうおわりました。', en: 'I’ve already finished my homework.', th: 'การบ้านเสร็จแล้ว' },
					{ ja: 'まだ雨がふっていますか。', en: 'Is it still raining?', th: 'ฝนยังตกอยู่ไหม' }
				]
			}
		],
		reading: {
			title: { en: 'A phone call', th: 'โทรศัพท์คุยกัน' },
			lines: [
				{ ja: 'ナリン：もしもし、リンさん。今、何をしていますか。', en: 'Narin: Hello, Lin. What are you doing now?', th: 'นาริน: ฮัลโหล ลิน ตอนนี้ทำอะไรอยู่' },
				{ ja: 'リン：今、電車の中にいます。友だちのうちへ行きます。', en: 'Lin: I’m on the train now. I’m going to a friend’s house.', th: 'ลิน: ตอนนี้อยู่บนรถไฟ กำลังไปบ้านเพื่อน' },
				{ ja: 'ナリン：そうですか。もうひるごはんを食べましたか。', en: 'Narin: I see. Have you had lunch yet?', th: 'นาริน: อย่างนั้นเหรอ กินข้าวกลางวันแล้วหรือยัง' },
				{ ja: 'リン：いいえ、まだです。', en: 'Lin: No, not yet.', th: 'ลิน: ยังเลย' },
				{ ja: 'ナリン：じゃあ、一時にえきのきっさてんであいませんか。', en: 'Narin: Then shall we meet at the café in the station at one?', th: 'นาริน: งั้นบ่ายโมงเจอกันที่ร้านกาแฟในสถานีไหม' }
			],
			questions: [
				{
					q: { en: 'Where is Lin?', th: 'ลินอยู่ที่ไหน' },
					choices: [
						{ en: 'On the train', th: 'บนรถไฟ' },
						{ en: 'At a friend’s house', th: 'ที่บ้านเพื่อน' },
						{ en: 'At a café', th: 'ที่ร้านกาแฟ' }
					],
					answer: 0
				},
				{
					q: { en: 'Has Lin had lunch?', th: 'ลินกินข้าวกลางวันแล้วหรือยัง' },
					choices: [
						{ en: 'Yes, already', th: 'กินแล้ว' },
						{ en: 'Not yet', th: 'ยังไม่ได้กิน' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-19',
		level: 'N5',
		title: { en: 'Rules at the library', th: 'กฎของห้องสมุด' },
		goal: { en: 'Ask for permission, say what is not allowed, and say why you go somewhere.', th: 'ขออนุญาต บอกสิ่งที่ห้ามทำ และบอกว่าไปที่ไหนเพื่อทำอะไร' },
		kanji: ['書', '読', '聞'],
		words: [
			{ reading: 'かく', kanji: '書く', gloss: { en: 'to write', th: 'เขียน' }, kind: 'word' },
			{ reading: 'きく', kanji: '聞く', gloss: { en: 'to listen; to ask', th: 'ฟัง; ถาม' }, kind: 'word' },
			{ reading: 'どくしょ', kanji: '読書', gloss: { en: 'reading (books)', th: 'การอ่านหนังสือ' }, kind: 'word' },
			{ reading: 'しんぶん', kanji: '新聞', gloss: { en: 'newspaper', th: 'หนังสือพิมพ์' }, kind: 'word' },
			{ reading: 'としょかん', kanji: '図書館', gloss: { en: 'library', th: 'ห้องสมุด' }, kind: 'word' },
			{ reading: 'てがみ', kanji: '手紙', gloss: { en: 'letter', th: 'จดหมาย' }, kind: 'word' },
			{ reading: 'ざっし', kanji: '雑誌', gloss: { en: 'magazine', th: 'นิตยสาร' }, kind: 'word' },
			{ reading: 'おんがく', kanji: '音楽', gloss: { en: 'music', th: 'ดนตรี' }, kind: 'word' },
			{ reading: 'かんじ', kanji: '漢字', gloss: { en: 'kanji', th: 'คันจิ; ตัวอักษรจีน' }, kind: 'word' },
			{ reading: 'えんぴつ', kanji: '鉛筆', gloss: { en: 'pencil', th: 'ดินสอ' }, kind: 'word' },
			{ reading: 'ことば', kanji: '言葉', gloss: { en: 'word; language', th: 'คำ; ภาษา' }, kind: 'word' },
			{ reading: 'かりる', kanji: '借りる', gloss: { en: 'to borrow', th: 'ยืม' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-te-mo-ii',
				pattern: '〜てもいいです',
				formation: 'V-て も いいです(か)',
				meaning: { en: 'you may …; may I …?', th: '… ได้; … ได้ไหม' },
				note: {
					en: 'Ask permission with てもいいですか. Say yes with はい、どうぞ or ええ、いいですよ. A soft no is すみません、ちょっと…',
					th: 'ขออนุญาตด้วย てもいいですか ตอบรับว่า はい、どうぞ หรือ ええ、いいですよ ปฏิเสธอย่างนุ่มนวลว่า すみません、ちょっと…'
				},
				examples: [
					{ ja: '「この本を読んでもいいですか。」「はい、どうぞ。」', en: '“May I read this book?” “Yes, go ahead.”', th: '“อ่านหนังสือเล่มนี้ได้ไหม” “ได้เลย เชิญ”' },
					{ ja: 'えんぴつで書いてもいいです。', en: 'You may write in pencil.', th: 'เขียนด้วยดินสอได้' },
					{ ja: '「まどをあけてもいいですか。」「ええ、いいですよ。」', en: '“May I open the window?” “Sure.”', th: '“เปิดหน้าต่างได้ไหม” “ได้สิ”' },
					{ ja: 'えいごで書いてもいいですか。', en: 'May I write in English?', th: 'เขียนเป็นภาษาอังกฤษได้ไหม' },
					{ ja: '明日は休んでもいいです。', en: 'You can take tomorrow off.', th: 'พรุ่งนี้หยุดได้' }
				]
			},
			{
				id: 'n5-te-wa-ikenai',
				pattern: '〜てはいけません',
				formation: 'V-て は いけません',
				meaning: { en: 'you must not …', th: 'ห้าม …' },
				note: {
					en: 'A strong “no”, for rules and signs. Said to a person face to face it can sound harsh, so in conversation people often just say すみません、ちょっと…',
					th: 'เป็นการห้ามที่หนักแน่น ใช้กับกฎและป้าย ถ้าพูดกับคนตรง ๆ อาจฟังดูแรง ในบทสนทนาจึงมักพูดแค่ すみません、ちょっと…'
				},
				examples: [
					{ ja: 'としょかんで電話をしてはいけません。', en: 'You must not make phone calls in the library.', th: 'ห้ามโทรศัพท์ในห้องสมุด' },
					{ ja: 'ここで食べてはいけません。', en: 'You must not eat here.', th: 'ห้ามกินอาหารที่นี่' },
					{ ja: 'テストでじしょを見てはいけません。', en: 'You must not look at a dictionary in the test.', th: 'ห้ามเปิดพจนานุกรมระหว่างสอบ' },
					{ ja: 'このペンで書いてはいけません。', en: 'You must not write with this pen.', th: 'ห้ามเขียนด้วยปากกาด้ามนี้' },
					{ ja: '「ここに入ってもいいですか。」「いいえ、入ってはいけません。」', en: '“May I go in here?” “No, you mustn’t.”', th: '“เข้าไปตรงนี้ได้ไหม” “ไม่ได้ ห้ามเข้า”' }
				]
			},
			{
				id: 'n5-ni-iku',
				pattern: '〜に行きます（purpose）',
				formation: 'V-ます stem + に 行きます / 来ます / かえります',
				meaning: { en: 'go (come) to do …', th: 'ไป (มา) เพื่อ …' },
				note: {
					en: 'Take the ます off and add に: 読みます → 読みに行きます. With する nouns you can drop する: べんきょうに来ました.',
					th: 'ตัด ます ออกแล้วเติม に เช่น 読みます → 読みに行きます ถ้าเป็นคำนามที่ใช้กับ する ตัด する ได้ เช่น べんきょうに来ました'
				},
				examples: [
					{ ja: 'としょかんへ本を読みに行きます。', en: 'I’m going to the library to read.', th: 'ไปห้องสมุดเพื่ออ่านหนังสือ' },
					{ ja: '日本へ日本語をべんきょうしに来ました。', en: 'I came to Japan to study Japanese.', th: 'มาญี่ปุ่นเพื่อเรียนภาษาญี่ปุ่น' },
					{ ja: '友だちのうちへあそびに行きます。', en: 'I’m going over to a friend’s house.', th: 'ไปเที่ยวบ้านเพื่อน' },
					{ ja: 'デパートへくつをかいに行きました。', en: 'I went to the department store to buy shoes.', th: 'ไปห้างเพื่อซื้อรองเท้า' },
					{ ja: '「何をしに行きますか。」「えいがを見に行きます。」', en: '“What are you going there for?” “To see a movie.”', th: '“ไปทำอะไร” “ไปดูหนัง”' }
				]
			}
		],
		reading: {
			title: { en: 'Library rules', th: 'กฎของห้องสมุด' },
			lines: [
				{ ja: 'としょかんの中で食べてはいけません。', en: 'You must not eat in the library.', th: 'ห้ามกินอาหารในห้องสมุด' },
				{ ja: '電話で話してはいけません。', en: 'You must not talk on the phone.', th: 'ห้ามคุยโทรศัพท์' },
				{ ja: '本は十四日かりてもいいです。', en: 'You may borrow books for fourteen days.', th: 'ยืมหนังสือได้สิบสี่วัน' },
				{ ja: 'しんぶんやざっしは、ここで読んでください。', en: 'Please read newspapers and magazines here.', th: 'กรุณาอ่านหนังสือพิมพ์และนิตยสารที่นี่' },
				{ ja: '本は入口でかえしてください。', en: 'Please return books at the entrance.', th: 'กรุณาคืนหนังสือที่ทางเข้า' }
			],
			questions: [
				{
					q: { en: 'How long can you borrow a book?', th: 'ยืมหนังสือได้นานเท่าไร' },
					choices: [
						{ en: 'Four days', th: 'สี่วัน' },
						{ en: 'Ten days', th: 'สิบวัน' },
						{ en: 'Fourteen days', th: 'สิบสี่วัน' }
					],
					answer: 2
				},
				{
					q: { en: 'Where should you read newspapers?', th: 'ควรอ่านหนังสือพิมพ์ที่ไหน' },
					choices: [
						{ en: 'At home', th: 'ที่บ้าน' },
						{ en: 'In the library', th: 'ในห้องสมุด' },
						{ en: 'At the entrance', th: 'ที่ทางเข้า' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-20',
		level: 'N5',
		title: { en: 'Talking with friends', th: 'คุยกับเพื่อน' },
		goal: { en: 'Use the casual dictionary and ない forms, and ask someone not to do something.', th: 'ใช้รูปพจนานุกรมและรูป ない แบบกันเอง และขอร้องไม่ให้ทำบางอย่าง' },
		kanji: ['上', '下'],
		words: [
			{ reading: 'した', kanji: '下', gloss: { en: 'under; below', th: 'ใต้; ข้างล่าง' }, kind: 'word' },
			{ reading: 'くつした', kanji: '靴下', gloss: { en: 'socks', th: 'ถุงเท้า' }, kind: 'word' },
			{ reading: 'ちかてつ', kanji: '地下鉄', gloss: { en: 'subway; underground', th: 'รถไฟใต้ดิน' }, kind: 'word' },
			{ reading: 'のぼる', kanji: '登る', gloss: { en: 'to climb', th: 'ปีน; ขึ้น (เขา)' }, kind: 'word' },
			{ reading: 'おりる', kanji: '降りる', gloss: { en: 'to get off; to go down', th: 'ลง (จากรถ)' }, kind: 'word' },
			{ reading: 'かいだん', kanji: '階段', gloss: { en: 'stairs', th: 'บันได' }, kind: 'word' },
			{ reading: 'エレベーター', gloss: { en: 'lift; elevator', th: 'ลิฟต์' }, kind: 'word' },
			{ reading: 'つかう', kanji: '使う', gloss: { en: 'to use', th: 'ใช้' }, kind: 'word' },
			{ reading: 'わかる', kanji: '分かる', gloss: { en: 'to understand', th: 'เข้าใจ' }, kind: 'word' },
			{ reading: 'いう', kanji: '言う', gloss: { en: 'to say', th: 'พูด; บอก' }, kind: 'word' },
			{ reading: 'まつ', kanji: '待つ', gloss: { en: 'to wait', th: 'รอ' }, kind: 'word' },
			{ reading: 'わすれる', kanji: '忘れる', gloss: { en: 'to forget', th: 'ลืม' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-plain-dict',
				pattern: 'dictionary form',
				formation: 'group 1: 行きます → 行く, 話します → 話す / group 2: 食べます → 食べる / します → する, 来ます → くる',
				meaning: { en: 'the plain (casual) form of a verb', th: 'รูปธรรมดา (แบบกันเอง) ของกริยา' },
				note: {
					en: 'Friends and family talk in plain form. It is also the form dictionaries use and the one many patterns build on, like 前に in the next unit. Group 1: move the sound before ます from the い-row to the う-row (き → く). Group 2: drop ます, add る.',
					th: 'เพื่อนและครอบครัวคุยกันด้วยรูปธรรมดา ซึ่งเป็นรูปที่พจนานุกรมใช้และเป็นฐานของหลายรูปประโยค เช่น 前に ในบทหน้า กลุ่ม 1: เปลี่ยนเสียงหน้า ます จากแถว い เป็นแถว う (き → く) กลุ่ม 2: ตัด ます แล้วเติม る'
				},
				examples: [
					{ ja: '明日、学校に行く？', en: 'Are you going to school tomorrow?', th: 'พรุ่งนี้ไปโรงเรียนไหม' },
					{ ja: 'うん、行く。', en: 'Yeah, I am.', th: 'อืม ไป' },
					{ ja: '毎日、日本語をべんきょうする。', en: 'I study Japanese every day.', th: 'เรียนภาษาญี่ปุ่นทุกวัน' },
					{ ja: '何を食べる？', en: 'What are you going to eat?', th: 'จะกินอะไร' },
					{ ja: '日よう日に山にのぼる。', en: 'I’m climbing a mountain on Sunday.', th: 'วันอาทิตย์จะปีนเขา' }
				]
			},
			{
				id: 'n5-plain-nai',
				pattern: 'ない form',
				formation: 'group 1: 行く → 行かない, 話す → 話さない, かう → かわない / group 2: 食べる → 食べない / する → しない, くる → こない, ある → ない',
				meaning: { en: 'the plain negative: don’t; won’t', th: 'รูปปฏิเสธแบบธรรมดา: ไม่ …' },
				note: {
					en: 'Group 1 verbs move the last sound to the あ-row and add ない. Verbs ending in う become わない, not あない: かう → かわない. ある has its own negative: ない.',
					th: 'กริยากลุ่ม 1 เปลี่ยนเสียงท้ายเป็นแถว あ แล้วเติม ない กริยาที่ลงท้ายด้วย う กลายเป็น わない ไม่ใช่ あない เช่น かう → かわない ส่วน ある มีรูปปฏิเสธเฉพาะคือ ない'
				},
				examples: [
					{ ja: '今日は学校に行かない。', en: 'I’m not going to school today.', th: 'วันนี้ไม่ไปโรงเรียน' },
					{ ja: 'にくは食べない。', en: 'I don’t eat meat.', th: 'ไม่กินเนื้อ' },
					{ ja: '「テレビ、見る？」「ううん、見ない。」', en: '“Want to watch TV?” “Nah, I won’t.”', th: '“ดูทีวีไหม” “ไม่ดู”' },
					{ ja: '日よう日は何もしない。', en: 'On Sundays I don’t do anything.', th: 'วันอาทิตย์ไม่ทำอะไรเลย' },
					{ ja: 'お金がない。', en: 'I have no money.', th: 'ไม่มีเงิน' }
				]
			},
			{
				id: 'n5-nai-de-kudasai',
				pattern: '〜ないでください',
				formation: 'V-ない で ください',
				meaning: { en: 'please don’t …', th: 'กรุณาอย่า …' },
				note: {
					en: 'The polite way to ask someone not to do something. Between friends, ないで alone is enough: わすれないで.',
					th: 'เป็นวิธีขอร้องอย่างสุภาพไม่ให้ทำบางอย่าง ถ้าพูดกับเพื่อน ใช้แค่ ないで ก็พอ เช่น わすれないで'
				},
				examples: [
					{ ja: 'ここでたばこをすわないでください。', en: 'Please don’t smoke here.', th: 'กรุณาอย่าสูบบุหรี่ที่นี่' },
					{ ja: 'わすれないでください。', en: 'Please don’t forget.', th: 'อย่าลืมนะ' },
					{ ja: 'エレベーターをつかわないでください。', en: 'Please don’t use the lift.', th: 'กรุณาอย่าใช้ลิฟต์' },
					{ ja: 'しんぱいしないでください。', en: 'Please don’t worry.', th: 'ไม่ต้องเป็นห่วงนะ' },
					{ ja: 'まだ電車をおりないでください。', en: 'Please don’t get off the train yet.', th: 'อย่าเพิ่งลงจากรถไฟนะ' }
				]
			}
		],
		reading: {
			title: { en: 'Messages between friends', th: 'ข้อความระหว่างเพื่อน' },
			lines: [
				{ ja: 'ナリン：明日、山にのぼる？', en: 'Narin: Are you climbing the mountain tomorrow?', th: 'นาริน: พรุ่งนี้จะปีนเขาไหม' },
				{ ja: 'リン：うん、のぼる。ナリンも来る？', en: 'Lin: Yeah, I am. Are you coming too, Narin?', th: 'ลิน: อืม ปีน นารินจะมาด้วยไหม' },
				{ ja: 'ナリン：ううん、行かない。しゅくだいがあるから。', en: 'Narin: No, I’m not going. I’ve got homework.', th: 'นาริน: ไม่ไปอะ มีการบ้าน' },
				{ ja: 'リン：そう。じゃあ、山の上でしゃしんをとるね。', en: 'Lin: OK. Then I’ll take photos at the top.', th: 'ลิน: อย่างนั้นเหรอ งั้นจะถ่ายรูปบนยอดเขามาให้นะ' },
				{ ja: 'ナリン：ありがとう。気をつけてね。', en: 'Narin: Thanks. Take care.', th: 'นาริน: ขอบใจนะ ระวังตัวด้วย' }
			],
			questions: [
				{
					q: { en: 'Is Lin going to climb the mountain?', th: 'ลินจะปีนเขาไหม' },
					choices: [
						{ en: 'Yes', th: 'ปีน' },
						{ en: 'No', th: 'ไม่ปีน' }
					],
					answer: 0
				},
				{
					q: { en: 'Why isn’t Narin going?', th: 'ทำไมนารินไม่ไป' },
					choices: [
						{ en: 'She has homework.', th: 'เพราะมีการบ้าน' },
						{ en: 'It will rain.', th: 'เพราะฝนจะตก' },
						{ en: 'She has no money.', th: 'เพราะไม่มีเงิน' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-21',
		level: 'N5',
		title: { en: 'Before and after', th: 'ก่อนและหลัง' },
		goal: { en: 'Use the casual past and say what you do before and after something.', th: 'ใช้รูปอดีตแบบกันเอง และบอกว่าทำอะไรก่อนและหลังอีกสิ่งหนึ่ง' },
		kanji: ['後', '間'],
		words: [
			{ reading: 'あと', kanji: '後', gloss: { en: 'after; later', th: 'หลัง; ทีหลัง' }, kind: 'word' },
			{ reading: 'うしろ', kanji: '後ろ', gloss: { en: 'behind; the back', th: 'ข้างหลัง' }, kind: 'word' },
			{ reading: 'まえ', kanji: '前', gloss: { en: 'before; in front; ago', th: 'ก่อน; ข้างหน้า; ที่แล้ว' }, kind: 'word' },
			{ reading: 'あいだ', kanji: '間', gloss: { en: 'between; during', th: 'ระหว่าง' }, kind: 'word' },
			{ reading: 'にんげん', kanji: '人間', gloss: { en: 'human being', th: 'มนุษย์' }, kind: 'word' },
			{ reading: 'あさごはん', kanji: '朝ご飯', gloss: { en: 'breakfast', th: 'อาหารเช้า' }, kind: 'word' },
			{ reading: 'ばんごはん', kanji: '晩ご飯', gloss: { en: 'dinner', th: 'อาหารเย็น' }, kind: 'word' },
			{ reading: 'さんぽ', kanji: '散歩', gloss: { en: 'a walk', th: 'การเดินเล่น' }, kind: 'word' },
			{ reading: 'あらう', kanji: '洗う', gloss: { en: 'to wash', th: 'ล้าง' }, kind: 'word' },
			{ reading: 'みがく', kanji: '磨く', gloss: { en: 'to brush; to polish', th: 'แปรง; ขัด' }, kind: 'word' },
			{ reading: 'ときどき', kanji: '時々', gloss: { en: 'sometimes', th: 'บางครั้ง' }, kind: 'word' },
			{ reading: 'シャワー', gloss: { en: 'shower', th: 'ฝักบัว; การอาบน้ำฝักบัว' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-plain-ta',
				pattern: 'た form',
				formation: 'て → た, で → だ: 食べた, 行った, 読んだ, した, 来た (きた)',
				meaning: { en: 'the plain past: did', th: 'รูปอดีตแบบธรรมดา: … แล้ว; ได้ …' },
				note: {
					en: 'Make it from the て-form: て becomes た and で becomes だ. The plain past negative is なかった: 行かなかった.',
					th: 'สร้างจากรูป て โดยเปลี่ยน て เป็น た และ で เป็น だ รูปอดีตปฏิเสธแบบธรรมดาคือ なかった เช่น 行かなかった'
				},
				examples: [
					{ ja: 'きのう、えいがを見た。', en: 'I saw a movie yesterday.', th: 'เมื่อวานดูหนัง' },
					{ ja: 'もうごはん食べた？', en: 'Have you eaten yet?', th: 'กินข้าวหรือยัง' },
					{ ja: '先月、日本に行った。', en: 'I went to Japan last month.', th: 'เดือนที่แล้วไปญี่ปุ่นมา' },
					{ ja: '「しゅくだい、した？」「うん、した。」', en: '“Did you do your homework?” “Yeah.”', th: '“ทำการบ้านหรือยัง” “ทำแล้ว”' },
					{ ja: 'きのうは学校に行かなかった。', en: 'I didn’t go to school yesterday.', th: 'เมื่อวานไม่ได้ไปโรงเรียน' }
				]
			},
			{
				id: 'n5-mae-ni',
				pattern: '〜前に',
				formation: 'V-る / N の + 前に',
				meaning: { en: 'before …; … ago', th: 'ก่อน …; … ที่แล้ว' },
				note: {
					en: 'The verb before 前に is always in dictionary form, even when the sentence is about the past. After a length of time, 前に means “ago”: 三年前に.',
					th: 'กริยาหน้า 前に เป็นรูปพจนานุกรมเสมอ แม้ประโยคจะพูดถึงอดีตก็ตาม ถ้าอยู่หลังช่วงเวลา 前に แปลว่า “… ที่แล้ว” เช่น 三年前に'
				},
				examples: [
					{ ja: 'ねる前に、はをみがきます。', en: 'I brush my teeth before bed.', th: 'แปรงฟันก่อนนอน' },
					{ ja: 'ごはんを食べる前に、手をあらいます。', en: 'I wash my hands before eating.', th: 'ล้างมือก่อนกินข้าว' },
					{ ja: 'じゅぎょうの前に、トイレに行きます。', en: 'I go to the toilet before class.', th: 'เข้าห้องน้ำก่อนเข้าเรียน' },
					{ ja: '日本へ行く前に、日本語をべんきょうしました。', en: 'I studied Japanese before going to Japan.', th: 'เรียนภาษาญี่ปุ่นก่อนไปญี่ปุ่น' },
					{ ja: '三年前に大学に入りました。', en: 'I started university three years ago.', th: 'เข้ามหาวิทยาลัยเมื่อสามปีที่แล้ว' }
				]
			},
			{
				id: 'n5-ato-de',
				pattern: '〜後で',
				formation: 'V-た / N の + 後で',
				meaning: { en: 'after …; later', th: 'หลังจาก …; ทีหลัง' },
				note: {
					en: 'The verb before 後で is in た-form. 後で on its own means “later”: 後で電話します.',
					th: 'กริยาหน้า 後で อยู่ในรูป た ส่วน 後で ที่ใช้เดี่ยว ๆ แปลว่า “ทีหลัง” เช่น 後で電話します'
				},
				examples: [
					{ ja: 'ごはんを食べた後で、さんぽします。', en: 'After eating, I go for a walk.', th: 'หลังกินข้าวแล้วไปเดินเล่น' },
					{ ja: 'じゅぎょうの後で、としょかんへ行きます。', en: 'After class I go to the library.', th: 'หลังเลิกเรียนไปห้องสมุด' },
					{ ja: 'シャワーをあびた後で、ねました。', en: 'I went to bed after a shower.', th: 'อาบน้ำเสร็จแล้วก็เข้านอน' },
					{ ja: 'しごとの後で、のみに行きませんか。', en: 'Would you like to go for a drink after work?', th: 'เลิกงานแล้วไปดื่มกันไหม' },
					{ ja: '後で電話します。', en: 'I’ll call you later.', th: 'เดี๋ยวจะโทรไปทีหลัง' }
				]
			}
		],
		reading: {
			title: { en: 'My mornings', th: 'ตอนเช้าของฉัน' },
			lines: [
				{ ja: 'わたしは毎あさ六時におきます。', en: 'I get up at six every morning.', th: 'ฉันตื่นนอนตอนหกโมงทุกเช้า' },
				{ ja: 'おきた後で、川のそばをさんぽします。', en: 'After getting up, I take a walk by the river.', th: 'หลังตื่นนอนจะไปเดินเล่นริมแม่น้ำ' },
				{ ja: 'さんぽの後で、シャワーをあびます。', en: 'After the walk, I take a shower.', th: 'หลังเดินเล่นแล้วอาบน้ำ' },
				{ ja: '学校に行く前に、あさごはんを食べます。', en: 'Before going to school, I have breakfast.', th: 'ก่อนไปโรงเรียนกินอาหารเช้า' },
				{ ja: 'でも、きのうは七時におきましたから、さんぽしませんでした。', en: 'But yesterday I got up at seven, so I didn’t take a walk.', th: 'แต่เมื่อวานตื่นเจ็ดโมง เลยไม่ได้ไปเดินเล่น' }
			],
			questions: [
				{
					q: { en: 'What does the writer do right after getting up?', th: 'ผู้เขียนทำอะไรหลังตื่นนอน' },
					choices: [
						{ en: 'Takes a walk', th: 'ไปเดินเล่น' },
						{ en: 'Has breakfast', th: 'กินอาหารเช้า' },
						{ en: 'Takes a shower', th: 'อาบน้ำ' }
					],
					answer: 0
				},
				{
					q: { en: 'Why didn’t the writer walk yesterday?', th: 'ทำไมเมื่อวานผู้เขียนไม่ได้ไปเดินเล่น' },
					choices: [
						{ en: 'It rained.', th: 'เพราะฝนตก' },
						{ en: 'They got up late.', th: 'เพราะตื่นสาย' },
						{ en: 'They went to school early.', th: 'เพราะไปโรงเรียนเช้า' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-22',
		level: 'N5',
		title: { en: 'When I was a child', th: 'ตอนเป็นเด็ก' },
		goal: { en: 'Say when something happened, how long it lasted, and what you understand or can do.', th: 'บอกว่าเกิดขึ้นตอนไหน นานเท่าไร และเข้าใจหรือทำอะไรได้บ้าง' },
		kanji: ['中'],
		words: [
			{ reading: 'なか', kanji: '中', gloss: { en: 'inside; middle', th: 'ข้างใน; ตรงกลาง' }, kind: 'word' },
			{ reading: 'ちゅうがっこう', kanji: '中学校', gloss: { en: 'junior high school', th: 'โรงเรียนมัธยมต้น' }, kind: 'word' },
			{ reading: 'ちゅうごく', kanji: '中国', gloss: { en: 'China', th: 'ประเทศจีน' }, kind: 'word' },
			{ reading: 'しょうがっこう', kanji: '小学校', gloss: { en: 'primary school', th: 'โรงเรียนประถม' }, kind: 'word' },
			{ reading: 'とき', kanji: '時', gloss: { en: 'time; when', th: 'เวลา; ตอนที่' }, kind: 'word' },
			{ reading: 'むかし', kanji: '昔', gloss: { en: 'long ago; the old days', th: 'สมัยก่อน' }, kind: 'word' },
			{ reading: 'はる', kanji: '春', gloss: { en: 'spring', th: 'ฤดูใบไม้ผลิ' }, kind: 'word' },
			{ reading: 'なつ', kanji: '夏', gloss: { en: 'summer', th: 'ฤดูร้อน' }, kind: 'word' },
			{ reading: 'あき', kanji: '秋', gloss: { en: 'autumn', th: 'ฤดูใบไม้ร่วง' }, kind: 'word' },
			{ reading: 'ふゆ', kanji: '冬', gloss: { en: 'winter', th: 'ฤดูหนาว' }, kind: 'word' },
			{ reading: 'ならう', kanji: '習う', gloss: { en: 'to learn (from someone)', th: 'เรียน (จากผู้สอน)' }, kind: 'word' },
			{ reading: 'できる', kanji: '出来る', gloss: { en: 'can do; to be able', th: 'ทำได้' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-toki',
				pattern: '〜とき',
				formation: 'N の / A-な な / A-い / V plain + とき',
				meaning: { en: 'when …; at the time of …', th: 'ตอนที่ …; เมื่อ …' },
				note: {
					en: 'Join とき the way you join a noun: 子どものとき, ひまなとき, さむいとき, 行ったとき.',
					th: 'เชื่อม とき เหมือนเชื่อมกับคำนาม เช่น 子どものとき, ひまなとき, さむいとき, 行ったとき'
				},
				examples: [
					{ ja: '子どものとき、ピアノをならいました。', en: 'I learned the piano when I was a child.', th: 'ตอนเป็นเด็กเคยเรียนเปียโน' },
					{ ja: 'ひまなとき、本を読みます。', en: 'I read when I have free time.', th: 'ตอนว่างจะอ่านหนังสือ' },
					{ ja: 'さむいとき、あたたかいおちゃをのみます。', en: 'When it’s cold, I drink hot tea.', th: 'ตอนอากาศหนาวจะดื่มชาร้อน' },
					{ ja: '日本に行ったとき、すしを食べました。', en: 'When I went to Japan, I ate sushi.', th: 'ตอนไปญี่ปุ่นได้กินซูชิ' },
					{ ja: '中学校のとき、テニスをしていました。', en: 'In junior high school I played tennis.', th: 'ตอนเรียนมัธยมต้นเคยเล่นเทนนิส' }
				]
			},
			{
				id: 'n5-jikan',
				pattern: '〜時間・〜か月・〜年（ぐらい）',
				formation: 'length of time (+ ぐらい) V',
				meaning: { en: 'for (a length of time); about …', th: 'เป็นเวลา …; ประมาณ …' },
				note: {
					en: 'A length of time takes no particle: 二時間べんきょうします. ぐらい after it means “about”. Ask with どのぐらい.',
					th: 'ช่วงเวลาไม่ต้องใส่คำช่วย เช่น 二時間べんきょうします เติม ぐらい ข้างหลังแปลว่า “ประมาณ” ถามด้วย どのぐらい'
				},
				examples: [
					{ ja: '毎日、二時間ぐらい日本語をべんきょうします。', en: 'I study Japanese for about two hours every day.', th: 'ทุกวันเรียนภาษาญี่ปุ่นประมาณสองชั่วโมง' },
					{ ja: '中国に三年いました。', en: 'I was in China for three years.', th: 'เคยอยู่ประเทศจีนสามปี' },
					{ ja: '「えきまでどのぐらいかかりますか。」「じゅっぷんぐらいです。」', en: '“How long does it take to the station?” “About ten minutes.”', th: '“ไปสถานีใช้เวลาเท่าไร” “ประมาณสิบนาที”' },
					{ ja: 'なつ休みは一か月です。', en: 'The summer holiday is one month long.', th: 'ปิดเทอมฤดูร้อนหนึ่งเดือน' },
					{ ja: 'きのうは八時間ねました。', en: 'I slept for eight hours last night.', th: 'เมื่อคืนนอนแปดชั่วโมง' }
				]
			},
			{
				id: 'n5-wakaru',
				pattern: '〜がわかります・〜ができます',
				formation: 'N が わかります / できます',
				meaning: { en: 'understand N / can do N', th: 'เข้าใจ N / ทำ N ได้' },
				note: {
					en: 'What you understand or can do takes が, not を. わかりました means “I see” or “got it”.',
					th: 'สิ่งที่เข้าใจหรือทำได้ใช้คำช่วย が ไม่ใช่ を ส่วน わかりました แปลว่า “เข้าใจแล้ว” หรือ “รับทราบ”'
				},
				examples: [
					{ ja: '日本語がすこしわかります。', en: 'I understand a little Japanese.', th: 'เข้าใจภาษาญี่ปุ่นนิดหน่อย' },
					{ ja: '「わかりましたか。」「はい、わかりました。」', en: '“Did you understand?” “Yes, I did.”', th: '“เข้าใจไหม” “เข้าใจแล้ว”' },
					{ ja: 'この字がわかりません。', en: 'I don’t know this character.', th: 'ไม่เข้าใจตัวอักษรตัวนี้' },
					{ ja: '中国語ができます。', en: 'I can speak Chinese.', th: 'พูดภาษาจีนได้' },
					{ ja: 'リンさんはピアノができます。', en: 'Lin can play the piano.', th: 'คุณลินเล่นเปียโนได้' }
				]
			}
		],
		reading: {
			title: { en: 'When I was a child', th: 'ตอนฉันเป็นเด็ก' },
			lines: [
				{ ja: '子どものとき、わたしは中国にいました。', en: 'When I was a child, I lived in China.', th: 'ตอนเป็นเด็ก ฉันอยู่ที่ประเทศจีน' },
				{ ja: '中国で小学校に入りました。', en: 'I started primary school in China.', th: 'เข้าโรงเรียนประถมที่ประเทศจีน' },
				{ ja: 'そのとき、中国語をならいました。', en: 'That’s when I learned Chinese.', th: 'ตอนนั้นได้เรียนภาษาจีน' },
				{ ja: '今も中国語がすこしわかります。', en: 'I still understand a little Chinese now.', th: 'ตอนนี้ก็ยังเข้าใจภาษาจีนอยู่นิดหน่อย' },
				{ ja: '中学校のとき、日本に来ました。日本に十年います。', en: 'I came to Japan in junior high school. I’ve been in Japan for ten years.', th: 'ตอนมัธยมต้นย้ายมาญี่ปุ่น อยู่ญี่ปุ่นมาสิบปีแล้ว' }
			],
			questions: [
				{
					q: { en: 'Where did the writer live as a child?', th: 'ตอนเป็นเด็กผู้เขียนอยู่ที่ไหน' },
					choices: [
						{ en: 'Japan', th: 'ญี่ปุ่น' },
						{ en: 'China', th: 'จีน' },
						{ en: 'Thailand', th: 'ไทย' }
					],
					answer: 1
				},
				{
					q: { en: 'When did the writer come to Japan?', th: 'ผู้เขียนมาญี่ปุ่นตอนไหน' },
					choices: [
						{ en: 'In primary school', th: 'ตอนเรียนประถม' },
						{ en: 'In junior high school', th: 'ตอนเรียนมัธยมต้น' },
						{ en: 'At university', th: 'ตอนเรียนมหาวิทยาลัย' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-23',
		level: 'N5',
		title: { en: 'Comparing things', th: 'การเปรียบเทียบ' },
		goal: { en: 'Compare two things and say which one is the most.', th: 'เปรียบเทียบสองสิ่ง และบอกว่าสิ่งไหน … ที่สุด' },
		kanji: ['山', '川'],
		words: [
			{ reading: 'やま', kanji: '山', gloss: { en: 'mountain', th: 'ภูเขา' }, kind: 'word' },
			{ reading: 'かわ', kanji: '川', gloss: { en: 'river', th: 'แม่น้ำ' }, kind: 'word' },
			{ reading: 'うみ', kanji: '海', gloss: { en: 'sea', th: 'ทะเล' }, kind: 'word' },
			{ reading: 'しま', kanji: '島', gloss: { en: 'island', th: 'เกาะ' }, kind: 'word' },
			{ reading: 'ふじさん', kanji: '富士山', gloss: { en: 'Mount Fuji', th: 'ภูเขาไฟฟูจิ' }, kind: 'word' },
			{ reading: 'みずうみ', kanji: '湖', gloss: { en: 'lake', th: 'ทะเลสาบ' }, kind: 'word' },
			{ reading: 'いちばん', kanji: '一番', gloss: { en: 'the most; number one', th: 'ที่สุด; อันดับหนึ่ง' }, kind: 'word' },
			{ reading: 'ほう', kanji: '方', gloss: { en: 'side; (the one that is) more', th: 'ฝ่าย; ทาง (ที่ … กว่า)' }, kind: 'word' },
			{ reading: 'どちら', gloss: { en: 'which (of two)', th: 'อันไหน (ในสองอย่าง)' }, kind: 'word' },
			{ reading: 'せかい', kanji: '世界', gloss: { en: 'the world', th: 'โลก' }, kind: 'word' },
			{ reading: 'ひくい', kanji: '低い', gloss: { en: 'low; short (height)', th: 'ต่ำ; เตี้ย' }, kind: 'word' },
			{ reading: 'けしき', kanji: '景色', gloss: { en: 'scenery; view', th: 'ทิวทัศน์' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-yori',
				pattern: '〜より',
				formation: 'A は B より adjective',
				meaning: { en: 'A is more … than B', th: 'A … กว่า B' },
				note: {
					en: 'より means “than” and comes after the thing you compare with. The adjective itself does not change: 高い can mean “taller”.',
					th: 'より แปลว่า “กว่า” และวางหลังสิ่งที่นำมาเทียบ คุณศัพท์ไม่ต้องเปลี่ยนรูป 高い ก็แปลว่า “สูงกว่า” ได้'
				},
				examples: [
					{ ja: '日本は中国より小さいです。', en: 'Japan is smaller than China.', th: 'ญี่ปุ่นเล็กกว่าจีน' },
					{ ja: '山田さんは田中さんよりせが高いです。', en: 'Mr Yamada is taller than Ms Tanaka.', th: 'คุณยามาดะตัวสูงกว่าคุณทานากะ' },
					{ ja: '今日はきのうよりさむいです。', en: 'Today is colder than yesterday.', th: 'วันนี้หนาวกว่าเมื่อวาน' },
					{ ja: 'バスは電車より安いです。', en: 'The bus is cheaper than the train.', th: 'รถบัสถูกกว่ารถไฟ' },
					{ ja: 'この川はあの川より長いです。', en: 'This river is longer than that one.', th: 'แม่น้ำสายนี้ยาวกว่าสายนั้น' }
				]
			},
			{
				id: 'n5-dochira',
				pattern: 'どちらが〜・〜のほうが',
				formation: 'A と B と どちらが … ですか / B の ほうが …',
				meaning: { en: 'which is more …, A or B? / B is more …', th: 'A กับ B อันไหน … กว่า / B … กว่า' },
				note: {
					en: 'どちら asks about two choices. Answer with のほうが. If both are fine, say どちらもいいです or どちらでもいいです.',
					th: 'どちら ใช้ถามเมื่อมีสองตัวเลือก ตอบด้วย のほうが ถ้าได้ทั้งสองอย่างให้พูดว่า どちらもいいです หรือ どちらでもいいです'
				},
				examples: [
					{ ja: '山と海と、どちらが好きですか。', en: 'Which do you like better, the mountains or the sea?', th: 'ภูเขากับทะเล ชอบอันไหนมากกว่า' },
					{ ja: '海のほうが好きです。', en: 'I like the sea better.', th: 'ชอบทะเลมากกว่า' },
					{ ja: '「バスと電車と、どちらがはやいですか。」「電車のほうがはやいです。」', en: '“Which is faster, the bus or the train?” “The train.”', th: '“รถบัสกับรถไฟ อันไหนเร็วกว่า” “รถไฟเร็วกว่า”' },
					{ ja: '「コーヒーとおちゃと、どちらがいいですか。」「どちらでもいいです。」', en: '“Coffee or tea?” “Either is fine.”', th: '“กาแฟกับชา เอาอะไรดี” “อะไรก็ได้”' },
					{ ja: '東口より西口のほうがちかいです。', en: 'The west exit is closer than the east exit.', th: 'ทางออกฝั่งตะวันตกใกล้กว่าฝั่งตะวันออก' }
				]
			},
			{
				id: 'n5-ichiban',
				pattern: '〜の中で〜が一番',
				formation: 'group の中で / で + N が 一番 adjective',
				meaning: { en: 'N is the most … (of a group)', th: 'N … ที่สุด (ในกลุ่ม)' },
				note: {
					en: 'Use 一番 for three or more things. Ask with 何, どこ, だれ or いつ + が一番: 何が一番好きですか.',
					th: 'ใช้ 一番 เมื่อเปรียบเทียบตั้งแต่สามสิ่งขึ้นไป ถามด้วย 何, どこ, だれ หรือ いつ ตามด้วย が一番 เช่น 何が一番好きですか'
				},
				examples: [
					{ ja: '日本で一番高い山はふじ山です。', en: 'The highest mountain in Japan is Mount Fuji.', th: 'ภูเขาที่สูงที่สุดในญี่ปุ่นคือภูเขาไฟฟูจิ' },
					{ ja: 'くだものの中で、りんごが一番好きです。', en: 'Of all fruit, I like apples best.', th: 'ในบรรดาผลไม้ ชอบแอปเปิลที่สุด' },
					{ ja: 'クラスの中で、だれが一番せが高いですか。', en: 'Who is the tallest in the class?', th: 'ในห้องเรียน ใครตัวสูงที่สุด' },
					{ ja: '一年で八月が一番あついです。', en: 'August is the hottest month of the year.', th: 'ในหนึ่งปี เดือนสิงหาคมร้อนที่สุด' },
					{ ja: 'せかいで一番長い川は何ですか。', en: 'What is the longest river in the world?', th: 'แม่น้ำที่ยาวที่สุดในโลกคืออะไร' }
				]
			}
		],
		reading: {
			title: { en: 'Mountains and rivers of Japan', th: 'ภูเขาและแม่น้ำของญี่ปุ่น' },
			lines: [
				{ ja: '日本には山がたくさんあります。', en: 'Japan has a lot of mountains.', th: 'ญี่ปุ่นมีภูเขาเยอะมาก' },
				{ ja: '一番高い山はふじ山です。三千七百七十六メートルです。', en: 'The highest is Mount Fuji. It is 3,776 metres.', th: 'ภูเขาที่สูงที่สุดคือภูเขาไฟฟูจิ สูงสามพันเจ็ดร้อยเจ็ดสิบหกเมตร' },
				{ ja: '日本の川は、タイの川よりみじかいです。', en: 'Japan’s rivers are shorter than Thailand’s.', th: 'แม่น้ำของญี่ปุ่นสั้นกว่าแม่น้ำของไทย' },
				{ ja: '日本で一番長い川は、しなの川です。', en: 'The longest river in Japan is the Shinano River.', th: 'แม่น้ำที่ยาวที่สุดในญี่ปุ่นคือแม่น้ำชินาโนะ' },
				{ ja: 'わたしは山より海のほうが好きです。', en: 'I like the sea better than the mountains.', th: 'ฉันชอบทะเลมากกว่าภูเขา' }
			],
			questions: [
				{
					q: { en: 'How high is Mount Fuji?', th: 'ภูเขาไฟฟูจิสูงเท่าไร' },
					choices: [
						{ en: '3,776 metres', th: '3,776 เมตร' },
						{ en: '7,776 metres', th: '7,776 เมตร' },
						{ en: '376 metres', th: '376 เมตร' }
					],
					answer: 0
				},
				{
					q: { en: 'Which does the writer like better?', th: 'ผู้เขียนชอบอะไรมากกว่า' },
					choices: [
						{ en: 'The mountains', th: 'ภูเขา' },
						{ en: 'The sea', th: 'ทะเล' },
						{ en: 'Rivers', th: 'แม่น้ำ' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-24',
		level: 'N5',
		title: { en: 'Colours and changes', th: 'สีและการเปลี่ยนแปลง' },
		goal: { en: 'Say how things change, join adjectives and describe how you do something.', th: 'บอกว่าสิ่งต่าง ๆ เปลี่ยนไปอย่างไร เชื่อมคุณศัพท์ และบอกลักษณะการกระทำ' },
		kanji: ['白'],
		words: [
			{ reading: 'しろい', kanji: '白い', gloss: { en: 'white', th: 'ขาว' }, kind: 'word' },
			{ reading: 'しろ', kanji: '白', gloss: { en: 'white (the colour)', th: 'สีขาว' }, kind: 'word' },
			{ reading: 'くろい', kanji: '黒い', gloss: { en: 'black', th: 'ดำ' }, kind: 'word' },
			{ reading: 'あかい', kanji: '赤い', gloss: { en: 'red', th: 'แดง' }, kind: 'word' },
			{ reading: 'あおい', kanji: '青い', gloss: { en: 'blue', th: 'น้ำเงิน; ฟ้า' }, kind: 'word' },
			{ reading: 'きいろい', kanji: '黄色い', gloss: { en: 'yellow', th: 'เหลือง' }, kind: 'word' },
			{ reading: 'いろ', kanji: '色', gloss: { en: 'colour', th: 'สี' }, kind: 'word' },
			{ reading: 'みどり', kanji: '緑', gloss: { en: 'green', th: 'สีเขียว' }, kind: 'word' },
			{ reading: 'はやい', kanji: '早い', gloss: { en: 'early; quick', th: 'เช้า; เร็ว' }, kind: 'word' },
			{ reading: 'おそい', kanji: '遅い', gloss: { en: 'late; slow', th: 'สาย; ช้า' }, kind: 'word' },
			{ reading: 'ゆっくり', gloss: { en: 'slowly; take your time', th: 'ช้า ๆ' }, kind: 'word' },
			{ reading: 'すぐ', gloss: { en: 'right away; soon', th: 'ทันที; เดี๋ยวนี้' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-naru',
				pattern: '〜くなる・〜になる',
				formation: 'A-い → A-く なる / A-な, N + に なる',
				meaning: { en: 'become …; get …', th: 'กลายเป็น …; … ขึ้น' },
				note: {
					en: 'い-adjectives change い to く: さむい → さむくなる. な-adjectives and nouns add に: 上手になる, いしゃになる.',
					th: 'คุณศัพท์ い เปลี่ยน い เป็น く เช่น さむい → さむくなる คุณศัพท์ な และคำนามเติม に เช่น 上手になる, いしゃになる'
				},
				examples: [
					{ ja: 'さむくなりました。', en: 'It’s got cold.', th: 'อากาศหนาวขึ้นแล้ว' },
					{ ja: '外がくらくなりました。', en: 'It’s got dark outside.', th: 'ข้างนอกมืดแล้ว' },
					{ ja: '子どもは大きくなりました。', en: 'The children have grown.', th: 'ลูก ๆ โตขึ้นแล้ว' },
					{ ja: '日本語が上手になりました。', en: 'Your Japanese has got better.', th: 'ภาษาญี่ปุ่นเก่งขึ้นแล้ว' },
					{ ja: '来年、二十さいになります。', en: 'I’ll be twenty next year.', th: 'ปีหน้าจะอายุยี่สิบปี' }
				]
			},
			{
				id: 'n5-kute',
				pattern: '〜くて・〜で',
				formation: 'A-い → A-くて / A-な, N + で',
				meaning: { en: '… and … (joining adjectives or nouns)', th: '… และ … (เชื่อมคุณศัพท์หรือคำนาม)' },
				note: {
					en: 'Join descriptions with the て-form of adjectives: ひろい → ひろくて, しんせつ → しんせつで. いい becomes よくて.',
					th: 'เชื่อมคำบรรยายด้วยรูป て ของคุณศัพท์ เช่น ひろい → ひろくて, しんせつ → しんせつで ส่วน いい กลายเป็น よくて'
				},
				examples: [
					{ ja: 'このへやはひろくて、あかるいです。', en: 'This room is spacious and bright.', th: 'ห้องนี้กว้างและสว่าง' },
					{ ja: '山田さんはしんせつで、おもしろい人です。', en: 'Mr Yamada is kind and fun.', th: 'คุณยามาดะเป็นคนใจดีและตลก' },
					{ ja: 'このりんごは赤くて、おいしいです。', en: 'This apple is red and tasty.', th: 'แอปเปิลลูกนี้แดงและอร่อย' },
					{ ja: '白くて大きいいぬがいます。', en: 'There’s a big white dog.', th: 'มีหมาตัวใหญ่สีขาว' },
					{ ja: 'あには大学生で、いもうとは高校生です。', en: 'My brother is a university student and my sister is in high school.', th: 'พี่ชายเป็นนักศึกษามหาวิทยาลัย ส่วนน้องสาวเป็นนักเรียนมัธยมปลาย' }
				]
			},
			{
				id: 'n5-adverb',
				pattern: '〜く・〜に + verb',
				formation: 'A-い → A-く V / A-な → A-に V',
				meaning: { en: 'do something in an … way (adverbs)', th: 'ทำอย่าง … (กริยาวิเศษณ์)' },
				note: {
					en: 'Change い to く or な to に to say how you do something: はやくおきる (get up early), しずかに話す (speak quietly).',
					th: 'เปลี่ยน い เป็น く หรือ な เป็น に เพื่อบอกว่าทำอย่างไร เช่น はやくおきる (ตื่นเช้า) しずかに話す (พูดเบา ๆ)'
				},
				examples: [
					{ ja: '明日ははやくおきてください。', en: 'Please get up early tomorrow.', th: 'พรุ่งนี้ตื่นเช้านะ' },
					{ ja: 'としょかんではしずかに話してください。', en: 'Please speak quietly in the library.', th: 'ในห้องสมุดกรุณาพูดเบา ๆ' },
					{ ja: '字をきれいに書いてください。', en: 'Please write the characters neatly.', th: 'กรุณาเขียนตัวอักษรให้สวย' },
					{ ja: '名前を大きく書きました。', en: 'I wrote my name in big letters.', th: 'เขียนชื่อตัวใหญ่' },
					{ ja: '父はいつもおそくかえります。', en: 'My father always comes home late.', th: 'พ่อกลับบ้านดึกเสมอ' }
				]
			}
		],
		reading: {
			title: { en: 'Autumn in the mountains', th: 'ฤดูใบไม้ร่วงบนภูเขา' },
			lines: [
				{ ja: '十月になりました。', en: 'It’s October now.', th: 'เข้าเดือนตุลาคมแล้ว' },
				{ ja: '山の木が赤くなりました。', en: 'The trees on the mountain have turned red.', th: 'ต้นไม้บนภูเขากลายเป็นสีแดงแล้ว' },
				{ ja: '天気がよくて、すずしいです。', en: 'The weather is nice and cool.', th: 'อากาศดีและเย็นสบาย' },
				{ ja: '山の上は白くなりました。雪です。', en: 'The top of the mountain has turned white. It’s snow.', th: 'ยอดเขากลายเป็นสีขาวแล้ว เป็นหิมะ' },
				{ ja: '今年もきれいなあきになりましたね。', en: 'It’s turned into a beautiful autumn again this year.', th: 'ปีนี้ก็เป็นฤดูใบไม้ร่วงที่สวยงามอีกแล้วนะ' }
			],
			questions: [
				{
					q: { en: 'What colour have the trees turned?', th: 'ต้นไม้กลายเป็นสีอะไร' },
					choices: [
						{ en: 'Red', th: 'สีแดง' },
						{ en: 'Yellow', th: 'สีเหลือง' },
						{ en: 'White', th: 'สีขาว' }
					],
					answer: 0
				},
				{
					q: { en: 'Why is the top of the mountain white?', th: 'ทำไมยอดเขาเป็นสีขาว' },
					choices: [
						{ en: 'Because of clouds', th: 'เพราะมีเมฆ' },
						{ en: 'Because of snow', th: 'เพราะมีหิมะ' },
						{ en: 'Because of white flowers', th: 'เพราะมีดอกไม้สีขาว' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-25',
		level: 'N5',
		title: { en: 'Getting around', th: 'การเดินทาง' },
		goal: { en: 'Say how you travel, get on and off, and ask how to do something.', th: 'บอกว่าเดินทางด้วยอะไร ขึ้นและลงรถ และถามวิธีทำสิ่งต่าง ๆ' },
		kanji: ['車'],
		words: [
			{ reading: 'じてんしゃ', kanji: '自転車', gloss: { en: 'bicycle', th: 'จักรยาน' }, kind: 'word' },
			{ reading: 'じどうしゃ', kanji: '自動車', gloss: { en: 'car; automobile', th: 'รถยนต์' }, kind: 'word' },
			{ reading: 'ちゅうしゃじょう', kanji: '駐車場', gloss: { en: 'car park', th: 'ที่จอดรถ' }, kind: 'word' },
			{ reading: 'バス', gloss: { en: 'bus', th: 'รถบัส' }, kind: 'word' },
			{ reading: 'タクシー', gloss: { en: 'taxi', th: 'แท็กซี่' }, kind: 'word' },
			{ reading: 'ひこうき', kanji: '飛行機', gloss: { en: 'aeroplane', th: 'เครื่องบิน' }, kind: 'word' },
			{ reading: 'くうこう', kanji: '空港', gloss: { en: 'airport', th: 'สนามบิน' }, kind: 'word' },
			{ reading: 'のる', kanji: '乗る', gloss: { en: 'to ride; to get on', th: 'ขึ้น (รถ); นั่ง (ยานพาหนะ)' }, kind: 'word' },
			{ reading: 'ちかい', kanji: '近い', gloss: { en: 'near; close', th: 'ใกล้' }, kind: 'word' },
			{ reading: 'とおい', kanji: '遠い', gloss: { en: 'far', th: 'ไกล' }, kind: 'word' },
			{ reading: 'きっぷ', kanji: '切符', gloss: { en: 'ticket', th: 'ตั๋ว' }, kind: 'word' },
			{ reading: 'どうやって', gloss: { en: 'how; in what way', th: 'อย่างไร; ด้วยวิธีไหน' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-de-means',
				pattern: '〜で（means）',
				formation: 'N で V',
				meaning: { en: 'by; with; in (a means, tool or language)', th: 'ด้วย; โดย; เป็น (วิธี เครื่องมือ หรือภาษา)' },
				note: {
					en: 'で marks how you do something: by bus, with chopsticks, in Japanese. On foot is あるいて, without で.',
					th: 'で บอกวิธีทำ เช่น ด้วยรถบัส ด้วยตะเกียบ เป็นภาษาญี่ปุ่น ส่วนการเดินไปใช้ あるいて โดยไม่มี で'
				},
				examples: [
					{ ja: 'バスで学校へ行きます。', en: 'I go to school by bus.', th: 'ไปโรงเรียนด้วยรถบัส' },
					{ ja: 'じてんしゃでえきまで行きます。', en: 'I go to the station by bicycle.', th: 'ไปสถานีด้วยจักรยาน' },
					{ ja: 'はしで食べます。', en: 'I eat with chopsticks.', th: 'กินด้วยตะเกียบ' },
					{ ja: '日本語で話してください。', en: 'Please speak in Japanese.', th: 'กรุณาพูดเป็นภาษาญี่ปุ่น' },
					{ ja: 'ひこうきでタイへかえります。', en: 'I’m flying back to Thailand.', th: 'กลับไทยด้วยเครื่องบิน' }
				]
			},
			{
				id: 'n5-ni-noru',
				pattern: '〜にのる・〜をおりる',
				formation: 'vehicle に のる / vehicle を おりる',
				meaning: { en: 'get on / get off (a vehicle)', th: 'ขึ้น / ลง (ยานพาหนะ)' },
				note: {
					en: 'You get on to a vehicle with に and get off it with を: 電車にのる, 電車をおりる. The station where you get off takes で.',
					th: 'ขึ้นรถใช้ に ลงรถใช้ を เช่น 電車にのる, 電車をおりる ส่วนสถานีที่ลงใช้ で'
				},
				examples: [
					{ ja: '電車にのります。', en: 'I get on the train.', th: 'ขึ้นรถไฟ' },
					{ ja: 'タクシーにのりましょう。', en: 'Let’s take a taxi.', th: 'นั่งแท็กซี่กันเถอะ' },
					{ ja: '毎日バスにのって、学校へ行きます。', en: 'Every day I take the bus to school.', th: 'ทุกวันนั่งรถบัสไปโรงเรียน' },
					{ ja: 'つぎのえきで電車をおります。', en: 'I get off the train at the next station.', th: 'ลงรถไฟที่สถานีหน้า' },
					{ ja: '子どものとき、はじめてひこうきにのりました。', en: 'I flew for the first time as a child.', th: 'ขึ้นเครื่องบินครั้งแรกตอนเป็นเด็ก' }
				]
			},
			{
				id: 'n5-douyatte',
				pattern: 'どうやって',
				formation: 'どうやって V-ますか',
				meaning: { en: 'how (by what method)?', th: '… อย่างไร (ด้วยวิธีไหน)' },
				note: {
					en: 'どうやって asks for the way or method. Answer with で (バスで) or a て-form (あるいて).',
					th: 'どうやって ใช้ถามวิธีการ ตอบด้วย で (バスで) หรือรูป て (あるいて)'
				},
				examples: [
					{ ja: '「くうこうまでどうやって行きますか。」「バスで行きます。」', en: '“How do you get to the airport?” “By bus.”', th: '“ไปสนามบินอย่างไร” “ไปด้วยรถบัส”' },
					{ ja: 'このきかいはどうやってつかいますか。', en: 'How do you use this machine?', th: 'เครื่องนี้ใช้อย่างไร' },
					{ ja: '「えきまでどうやって来ましたか。」「あるいて来ました。」', en: '“How did you get to the station?” “I walked.”', th: '“มาสถานีอย่างไร” “เดินมา”' },
					{ ja: 'この字はどうやって書きますか。', en: 'How do you write this character?', th: 'ตัวอักษรนี้เขียนอย่างไร' },
					{ ja: '電車のきっぷはどうやってかいますか。', en: 'How do I buy a train ticket?', th: 'ซื้อตั๋วรถไฟอย่างไร' }
				]
			}
		],
		reading: {
			title: { en: 'Going home to Thailand', th: 'กลับบ้านที่ไทย' },
			lines: [
				{ ja: '明日、タイへかえります。', en: 'Tomorrow I’m going home to Thailand.', th: 'พรุ่งนี้จะกลับไทย' },
				{ ja: 'うちからえきまで、じてんしゃで行きます。', en: 'I’ll cycle from home to the station.', th: 'จากบ้านไปสถานีจะไปด้วยจักรยาน' },
				{ ja: 'えきから電車にのって、くうこうへ行きます。', en: 'From the station I’ll take the train to the airport.', th: 'จากสถานีนั่งรถไฟไปสนามบิน' },
				{ ja: '電車で一時間ぐらいかかります。', en: 'It takes about an hour by train.', th: 'นั่งรถไฟประมาณหนึ่งชั่วโมง' },
				{ ja: 'くうこうからタイまで、ひこうきで六時間です。', en: 'From the airport to Thailand is six hours by plane.', th: 'จากสนามบินถึงไทยใช้เวลาหกชั่วโมงด้วยเครื่องบิน' }
			],
			questions: [
				{
					q: { en: 'How does the writer get to the station?', th: 'ผู้เขียนไปสถานีด้วยอะไร' },
					choices: [
						{ en: 'By bus', th: 'รถบัส' },
						{ en: 'By bicycle', th: 'จักรยาน' },
						{ en: 'On foot', th: 'เดินไป' }
					],
					answer: 1
				},
				{
					q: { en: 'How long is the train to the airport?', th: 'นั่งรถไฟไปสนามบินใช้เวลาเท่าไร' },
					choices: [
						{ en: 'About an hour', th: 'ประมาณหนึ่งชั่วโมง' },
						{ en: 'Six hours', th: 'หกชั่วโมง' },
						{ en: 'Ten minutes', th: 'สิบนาที' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-26',
		level: 'N5',
		title: { en: 'What I want to do', th: 'สิ่งที่อยากทำ' },
		goal: { en: 'Say what you want to do, ask and answer “why”, and say “nothing” or “nobody”.', th: 'บอกสิ่งที่อยากทำ ถามและตอบว่า “ทำไม” และพูดว่า “ไม่มีอะไร” หรือ “ไม่มีใคร”' },
		kanji: ['本'],
		words: [
			{ reading: 'ほんとう', kanji: '本当', gloss: { en: 'truth; really', th: 'จริง; ความจริง' }, kind: 'word' },
			{ reading: 'にほん', kanji: '日本', gloss: { en: 'Japan', th: 'ประเทศญี่ปุ่น' }, kind: 'word' },
			{ reading: 'ほんや', kanji: '本屋', gloss: { en: 'bookshop', th: 'ร้านหนังสือ' }, kind: 'word' },
			{ reading: 'ほんだな', kanji: '本棚', gloss: { en: 'bookshelf', th: 'ชั้นหนังสือ' }, kind: 'word' },
			{ reading: 'りょこう', kanji: '旅行', gloss: { en: 'trip; travel', th: 'การท่องเที่ยว' }, kind: 'word' },
			{ reading: 'しゃしん', kanji: '写真', gloss: { en: 'photo', th: 'รูปถ่าย' }, kind: 'word' },
			{ reading: 'ゆめ', kanji: '夢', gloss: { en: 'dream', th: 'ความฝัน' }, kind: 'word' },
			{ reading: 'しょうらい', kanji: '将来', gloss: { en: 'the future', th: 'อนาคต' }, kind: 'word' },
			{ reading: 'がいこく', kanji: '外国', gloss: { en: 'foreign country', th: 'ต่างประเทศ' }, kind: 'word' },
			{ reading: 'りゅうがく', kanji: '留学', gloss: { en: 'studying abroad', th: 'การไปเรียนต่างประเทศ' }, kind: 'word' },
			{ reading: 'どうして', gloss: { en: 'why', th: 'ทำไม' }, kind: 'word' },
			{ reading: 'なぜ', gloss: { en: 'why (more formal)', th: 'ทำไม (ทางการกว่า)' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-tai',
				pattern: '〜たいです',
				formation: 'V-ます stem + たいです',
				meaning: { en: 'I want to …', th: 'อยาก …' },
				note: {
					en: 'たい is for what you yourself want to do. It works like an い-adjective: 行きたくないです (I don’t want to go). For other people’s wishes you will learn たがっている at N4.',
					th: 'たい ใช้บอกสิ่งที่ตัวเองอยากทำ ผันเหมือนคุณศัพท์ い เช่น 行きたくないです (ไม่อยากไป) ถ้าพูดถึงความต้องการของคนอื่นจะได้เรียน たがっている ในระดับ N4'
				},
				examples: [
					{ ja: '日本へ行きたいです。', en: 'I want to go to Japan.', th: 'อยากไปญี่ปุ่น' },
					{ ja: '何が食べたいですか。', en: 'What do you want to eat?', th: 'อยากกินอะไร' },
					{ ja: '今日は何もしたくないです。', en: 'I don’t want to do anything today.', th: 'วันนี้ไม่อยากทำอะไรเลย' },
					{ ja: 'しょうらい、先生になりたいです。', en: 'In the future I want to be a teacher.', th: 'ในอนาคตอยากเป็นครู' },
					{ ja: '日本の本屋で本をかいたいです。', en: 'I want to buy books at a Japanese bookshop.', th: 'อยากซื้อหนังสือที่ร้านหนังสือในญี่ปุ่น' }
				]
			},
			{
				id: 'n5-doushite',
				pattern: 'どうして・なぜ',
				formation: 'どうして …か。— …から。',
				meaning: { en: 'why? — because …', th: 'ทำไม — เพราะ …' },
				note: {
					en: 'どうして is the everyday word; なぜ sounds more formal or written. Answer with から at the end: …ですから.',
					th: 'どうして เป็นคำที่ใช้ทั่วไป ส่วน なぜ ฟังดูทางการหรือเป็นภาษาเขียนมากกว่า ตอบโดยลงท้ายด้วย から เช่น …ですから'
				},
				examples: [
					{ ja: 'どうして日本語をべんきょうしていますか。', en: 'Why are you studying Japanese?', th: 'ทำไมถึงเรียนภาษาญี่ปุ่น' },
					{ ja: '日本のアニメが好きですから。', en: 'Because I like Japanese anime.', th: 'เพราะชอบอนิเมะญี่ปุ่น' },
					{ ja: '「どうして休みましたか。」「かぜをひきましたから。」', en: '“Why were you off?” “Because I caught a cold.”', th: '“ทำไมถึงหยุด” “เพราะเป็นหวัด”' },
					{ ja: 'このりんごはなぜ高いですか。', en: 'Why are these apples expensive?', th: 'ทำไมแอปเปิลนี้ถึงแพง' },
					{ ja: 'どうして食べないの？', en: 'Why aren’t you eating?', th: 'ทำไมไม่กินล่ะ' }
				]
			},
			{
				id: 'n5-nanimo',
				pattern: '何も・だれも・どこへも + negative',
				formation: 'question word + も + negative',
				meaning: { en: 'nothing; nobody; nowhere', th: 'ไม่ … อะไรเลย; ไม่มีใคร; ไม่ไปไหนเลย' },
				note: {
					en: 'A question word with も and a negative verb means “not any”. With a place, keep the particle: どこへも, どこにも.',
					th: 'คำแสดงคำถามตามด้วย も และกริยาปฏิเสธ แปลว่า “ไม่ … เลย” ถ้าเป็นสถานที่ให้คงคำช่วยไว้ เช่น どこへも, どこにも'
				},
				examples: [
					{ ja: '今日は何も食べませんでした。', en: 'I didn’t eat anything today.', th: 'วันนี้ไม่ได้กินอะไรเลย' },
					{ ja: 'へやにはだれもいません。', en: 'There’s nobody in the room.', th: 'ในห้องไม่มีใครอยู่' },
					{ ja: '日よう日はどこへも行きませんでした。', en: 'I didn’t go anywhere on Sunday.', th: 'วันอาทิตย์ไม่ได้ไปไหนเลย' },
					{ ja: '「何かのみますか。」「いいえ、何もいりません。」', en: '“Would you like a drink?” “No, I don’t need anything.”', th: '“จะดื่มอะไรไหม” “ไม่ ไม่ต้องการอะไร”' },
					{ ja: 'そのことは、だれもしりません。', en: 'Nobody knows about that.', th: 'เรื่องนั้นไม่มีใครรู้' }
				]
			}
		],
		reading: {
			title: { en: 'My dream', th: 'ความฝันของฉัน' },
			lines: [
				{ ja: 'わたしは本が大好きです。', en: 'I love books.', th: 'ฉันชอบหนังสือมาก' },
				{ ja: 'しょうらい、日本の本屋ではたらきたいです。', en: 'In the future I want to work in a bookshop in Japan.', th: 'ในอนาคตอยากทำงานที่ร้านหนังสือในญี่ปุ่น' },
				{ ja: 'どうしてですか。日本の本屋は大きくて、おもしろいですから。', en: 'Why? Because Japanese bookshops are big and fun.', th: 'ทำไมน่ะเหรอ เพราะร้านหนังสือในญี่ปุ่นใหญ่และน่าสนใจ' },
				{ ja: '来年、日本へりゅうがくに行きたいです。', en: 'Next year I want to go to Japan to study.', th: 'ปีหน้าอยากไปเรียนต่อที่ญี่ปุ่น' },
				{ ja: 'でも、まだお金がありません。今はアルバイトをしています。', en: 'But I don’t have the money yet. I’m doing a part-time job now.', th: 'แต่ยังไม่มีเงิน ตอนนี้จึงทำงานพาร์ตไทม์อยู่' }
			],
			questions: [
				{
					q: { en: 'What does the writer want to do in the future?', th: 'ในอนาคตผู้เขียนอยากทำอะไร' },
					choices: [
						{ en: 'Work in a bookshop in Japan', th: 'ทำงานที่ร้านหนังสือในญี่ปุ่น' },
						{ en: 'Write books', th: 'เขียนหนังสือ' },
						{ en: 'Teach Japanese', th: 'สอนภาษาญี่ปุ่น' }
					],
					answer: 0
				},
				{
					q: { en: 'Why can’t the writer go to Japan yet?', th: 'ทำไมผู้เขียนยังไปญี่ปุ่นไม่ได้' },
					choices: [
						{ en: 'They can’t speak Japanese.', th: 'เพราะพูดภาษาญี่ปุ่นไม่ได้' },
						{ en: 'They don’t have the money yet.', th: 'เพราะยังไม่มีเงิน' },
						{ en: 'They don’t like Japan.', th: 'เพราะไม่ชอบญี่ปุ่น' }
					],
					answer: 1
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	},
	{
		id: 'n5-27',
		level: 'N5',
		title: { en: 'A summer festival', th: 'เทศกาลฤดูร้อน' },
		goal: { en: 'Tell a short story with それから, でも and だから, and use “something” and “not at all”.', th: 'เล่าเรื่องสั้น ๆ ด้วย それから でも และ だから และใช้คำว่า “อะไรสักอย่าง” และ “ไม่ … เลย”' },
		kanji: ['人'],
		words: [
			{ reading: 'おとな', kanji: '大人', gloss: { en: 'adult', th: 'ผู้ใหญ่' }, kind: 'word' },
			{ reading: 'にんき', kanji: '人気', gloss: { en: 'popularity; popular', th: 'ความนิยม; เป็นที่นิยม' }, kind: 'word' },
			{ reading: 'がいこくじん', kanji: '外国人', gloss: { en: 'foreigner', th: 'ชาวต่างชาติ' }, kind: 'word' },
			{ reading: 'みんな', kanji: '皆', gloss: { en: 'everyone', th: 'ทุกคน' }, kind: 'word' },
			{ reading: 'まつり', kanji: '祭り', gloss: { en: 'festival', th: 'เทศกาล; งานวัด' }, kind: 'word' },
			{ reading: 'はなび', kanji: '花火', gloss: { en: 'fireworks', th: 'ดอกไม้ไฟ' }, kind: 'word' },
			{ reading: 'こうえん', kanji: '公園', gloss: { en: 'park', th: 'สวนสาธารณะ' }, kind: 'word' },
			{ reading: 'たのしい', kanji: '楽しい', gloss: { en: 'fun; enjoyable', th: 'สนุก' }, kind: 'word' },
			{ reading: 'おもしろい', kanji: '面白い', gloss: { en: 'interesting; funny', th: 'น่าสนใจ; ตลก' }, kind: 'word' },
			{ reading: 'つかれる', kanji: '疲れる', gloss: { en: 'to get tired', th: 'เหนื่อย' }, kind: 'word' },
			{ reading: 'きもの', kanji: '着物', gloss: { en: 'kimono', th: 'กิโมโน' }, kind: 'word' },
			{ reading: 'ぜんぜん', kanji: '全然', gloss: { en: '(not) at all', th: '(ไม่) … เลย' }, kind: 'word' }
		],
		grammar: [
			{
				id: 'n5-zenzen',
				pattern: 'ぜんぜん〜ない',
				formation: 'ぜんぜん + negative',
				meaning: { en: 'not … at all', th: 'ไม่ … เลย' },
				note: {
					en: 'ぜんぜん with a negative is stronger than あまり: あまりわかりません (I don’t understand much), ぜんぜんわかりません (I don’t understand at all).',
					th: 'ぜんぜん กับรูปปฏิเสธมีน้ำหนักมากกว่า あまり เช่น あまりわかりません (ไม่ค่อยเข้าใจ) ぜんぜんわかりません (ไม่เข้าใจเลย)'
				},
				examples: [
					{ ja: '日本語がぜんぜんわかりません。', en: 'I don’t understand Japanese at all.', th: 'ไม่เข้าใจภาษาญี่ปุ่นเลย' },
					{ ja: 'きのうはぜんぜんねませんでした。', en: 'I didn’t sleep at all last night.', th: 'เมื่อคืนไม่ได้นอนเลย' },
					{ ja: 'このえいがはぜんぜんおもしろくなかったです。', en: 'This movie wasn’t interesting at all.', th: 'หนังเรื่องนี้ไม่สนุกเลย' },
					{ ja: '今日はぜんぜんさむくないです。', en: 'It isn’t cold at all today.', th: 'วันนี้ไม่หนาวเลย' },
					{ ja: '中国語はぜんぜんできません。', en: 'I can’t speak Chinese at all.', th: 'พูดภาษาจีนไม่ได้เลย' }
				]
			},
			{
				id: 'n5-dokoka',
				pattern: '何か・どこか・だれか',
				formation: 'question word + か',
				meaning: { en: 'something; somewhere; someone', th: 'อะไรสักอย่าง; ที่ไหนสักแห่ง; ใครสักคน' },
				note: {
					en: 'A question word + か means “some …”. Compare 何か (something) with 何も + negative (nothing, unit 26).',
					th: 'คำแสดงคำถามตามด้วย か แปลว่า “… สักอย่าง” เปรียบเทียบ 何か (อะไรสักอย่าง) กับ 何も + ปฏิเสธ (ไม่มีอะไรเลย บทที่ 26)'
				},
				examples: [
					{ ja: '何か食べませんか。', en: 'Shall we eat something?', th: 'กินอะไรสักหน่อยไหม' },
					{ ja: '休みにどこか行きますか。', en: 'Are you going anywhere for the holiday?', th: 'วันหยุดจะไปไหนไหม' },
					{ ja: 'だれか来ましたか。', en: 'Did someone come?', th: 'มีใครมาหรือเปล่า' },
					{ ja: '「何かかいましたか。」「いいえ、何もかいませんでした。」', en: '“Did you buy anything?” “No, nothing.”', th: '“ซื้ออะไรมาไหม” “ไม่ ไม่ได้ซื้ออะไรเลย”' },
					{ ja: 'いつか、いっしょに日本へ行きましょう。', en: 'Let’s go to Japan together some day.', th: 'สักวันไปญี่ปุ่นด้วยกันนะ' }
				]
			},
			{
				id: 'n5-sorekara',
				pattern: 'それから・でも・だから',
				formation: 'sentence 1。それから / でも / だから、sentence 2。',
				meaning: { en: 'and then / but / so (joining two sentences)', th: 'แล้วก็ / แต่ / ดังนั้น (เชื่อมสองประโยค)' },
				note: {
					en: 'These words start the second sentence. それから: and then. でも: but. だから: so, that’s why.',
					th: 'คำเหล่านี้ใช้ขึ้นต้นประโยคที่สอง それから: แล้วก็ でも: แต่ だから: ดังนั้น เพราะฉะนั้น'
				},
				examples: [
					{ ja: 'こうえんへ行きました。それから、えいがを見ました。', en: 'I went to the park. Then I saw a movie.', th: 'ไปสวนสาธารณะ แล้วก็ไปดูหนัง' },
					{ ja: '日本語はむずかしいです。でも、おもしろいです。', en: 'Japanese is hard. But it’s interesting.', th: 'ภาษาญี่ปุ่นยาก แต่ก็สนุก' },
					{ ja: '雨がふりました。だから、うちにいました。', en: 'It rained. So I stayed home.', th: 'ฝนตก ก็เลยอยู่บ้าน' },
					{ ja: 'シャワーをあびました。それから、学校へ行きました。', en: 'I had a shower. Then I went to school.', th: 'อาบน้ำ แล้วก็ไปโรงเรียน' },
					{ ja: '明日はテストです。だから、今日はべんきょうします。', en: 'There’s a test tomorrow. So I’ll study today.', th: 'พรุ่งนี้มีสอบ วันนี้จึงจะอ่านหนังสือ' }
				]
			}
		],
		reading: {
			title: { en: 'The summer festival', th: 'เทศกาลฤดูร้อน' },
			lines: [
				{ ja: 'きのう、友だちとなつまつりに行きました。', en: 'Yesterday I went to a summer festival with friends.', th: 'เมื่อวานไปงานเทศกาลฤดูร้อนกับเพื่อน' },
				{ ja: '人がたくさんいました。外国人もたくさんいました。', en: 'There were lots of people. There were lots of foreigners too.', th: 'มีคนเยอะมาก ชาวต่างชาติก็เยอะ' },
				{ ja: 'はじめに、やきそばを食べました。それから、はなびを見ました。', en: 'First we ate yakisoba. Then we watched the fireworks.', th: 'ตอนแรกกินยากิโซบะ แล้วก็ดูดอกไม้ไฟ' },
				{ ja: 'はなびはとてもきれいでした。でも、すこしつかれました。', en: 'The fireworks were very beautiful. But I got a little tired.', th: 'ดอกไม้ไฟสวยมาก แต่ก็เหนื่อยนิดหน่อย' },
				{ ja: 'とてもたのしかったです。だから、来年もまた行きたいです。', en: 'It was great fun. So I want to go again next year.', th: 'สนุกมาก เลยอยากไปอีกปีหน้า' }
			],
			questions: [
				{
					q: { en: 'What did they do after eating?', th: 'หลังกินอาหารแล้วทำอะไร' },
					choices: [
						{ en: 'Watched the fireworks', th: 'ดูดอกไม้ไฟ' },
						{ en: 'Went home', th: 'กลับบ้าน' },
						{ en: 'Bought a kimono', th: 'ซื้อกิโมโน' }
					],
					answer: 0
				},
				{
					q: { en: 'Why does the writer want to go again next year?', th: 'ทำไมผู้เขียนอยากไปอีกปีหน้า' },
					choices: [
						{ en: 'Because it was a lot of fun', th: 'เพราะสนุกมาก' },
						{ en: 'Because there were few people', th: 'เพราะคนน้อย' },
						{ en: 'Because the food was cheap', th: 'เพราะอาหารถูก' }
					],
					answer: 0
				}
			]
		},
		review: DRAFT,
		source: SOURCE
	}
];
