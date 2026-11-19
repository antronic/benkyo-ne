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
			{ reading: 'あれ', gloss: { en: 'that over there', th: 'โน่น (ไกลจากทั้งคู่)' }, kind: 'word' },
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
			{ reading: 'いくら', gloss: { en: 'how much', th: 'เท่าไร' }, kind: 'word' },
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
	}
];
