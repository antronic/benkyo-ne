/**
 * Onboarding copy in English and Thai.
 *
 * Kept next to the questionnaire so it works before and after the app-wide
 * interface language lands (src/lib/i18n, PR #8). Once that is merged these
 * can move into en.ts / th.ts.
 */
import type { Goal, Level, Minutes } from './plan.ts';
import type { JlptLevel } from '#lib/content/levels/types.ts';
import type { Course } from '#lib/content/courses.ts';

export type Lang = 'en' | 'th';

interface Strings {
	eyebrow: string;
	skip: string;
	back: string;
	next: string;
	langLabel: string;
	goalQ: string;
	goalHint: string;
	goals: Record<Goal, string>;
	levelQ: string;
	levelHint: string;
	levels: Record<Level, { title: string; caption: string }>;
	jlptQ: string;
	jlptHint: string;
	jlpt: Record<JlptLevel, { name: string; meaning: string }>;
	minutesQ: string;
	minutesHint: string;
	minutes: Record<Minutes, { title: string; caption: string }>;
	recommended: string;
	planEyebrow: string;
	planTitle: string;
	planHint: string;
	start: string;
	change: string;
	steps: {
		lesson: string;
		lessonCaption: string;
		placement: Record<'hiragana' | 'katakana', string>;
		placementCaption: string;
		course: (course: Course['id']) => string;
		courseCaption: string;
		daily: (min: number) => string;
		dailyCaption: (n: number) => string;
		level: (jlpt: JlptLevel) => string;
		levelCaption: string;
		levelSoon: (jlpt: JlptLevel) => string;
		everyday: string;
		everydayCaption: string;
		dailyCaptionEveryday: string;
	};
	card: {
		title: string;
		perDay: (min: number) => string;
		adjust: string;
		hide: string;
		done: string;
		nudgeTitle: string;
		nudgeCaption: string;
		nudgeGo: string;
	};
}

const COURSE_EN: Record<Course['id'], string> = { travel: 'Travel', friends: 'Make friends', japanglish: 'Japanglish' };
const COURSE_TH: Record<Course['id'], string> = { travel: 'เที่ยวญี่ปุ่น', friends: 'หาเพื่อนใหม่', japanglish: 'คำทับศัพท์' };

export const STRINGS: Record<Lang, Strings> = {
	en: {
		eyebrow: '3 quick taps',
		skip: 'Skip',
		back: 'Back',
		next: 'Next',
		langLabel: 'Language',
		goalQ: 'What brings you to Japanese?',
		goalHint: 'Pick any. We’ll suggest words that fit.',
		goals: {
			travel: 'Travel',
			anime: 'Anime, manga & games',
			people: 'Friends & family',
			food: 'Food & culture',
			work: 'Work or school',
			fun: 'Just for fun'
		},
		levelQ: 'How much do you know already?',
		levelHint: 'No test yet. This only picks where you start.',
		levels: {
			new: { title: 'I’m brand new', caption: 'Start from the first five letters' },
			some: { title: 'I know some kana', caption: 'A quick check skips what you know' },
			kana: { title: 'I can read hiragana & katakana', caption: 'Test out of the lessons, then practise' },
			daily: { title: 'I use Japanese every day', caption: 'Pick your level from a real sentence' }
		},
		jlptQ: 'Pick your level',
		jlptHint: 'Tap the hardest sentence you can read. No test: you can change it any time.',
		jlpt: {
			N5: { name: 'N5 · Beginner', meaning: 'This is my book.' },
			N4: { name: 'N4 · Basic', meaning: 'If it rains, I watch a film at home.' },
			N3: { name: 'N3 · Everyday and work', meaning: 'Could you share the meeting documents beforehand?' },
			N2: { name: 'N2 · Business', meaning: 'Sorry to trouble you when you’re busy, but please check it.' },
			N1: { name: 'N1 · Advanced', meaning: 'Regarding this matter, we regret that we must decline.' }
		},
		minutesQ: 'How much time a day?',
		minutesHint: 'You can change this any time in Settings.',
		minutes: {
			5: { title: '5 minutes', caption: 'Light: a few new kana, then reviews' },
			10: { title: '10 minutes', caption: 'Steady: about two lessons a day' },
			20: { title: '20 minutes', caption: 'Serious: three lessons a day' }
		},
		recommended: 'Recommended',
		planEyebrow: 'Your plan',
		planTitle: 'Here’s where you start',
		planHint: 'Reviews come back just before you’d forget, so short days add up.',
		start: 'Start learning',
		change: 'Change answers',
		steps: {
			lesson: 'Hiragana, five letters at a time',
			lessonCaption: 'Meet, trace, recognise, recall',
			placement: { hiragana: 'Test out of the hiragana you know', katakana: 'Then test out of katakana' },
			placementCaption: 'A short quiz with no hints, about 2 minutes',
			course: (c) => `${COURSE_EN[c]} words and phrases`,
			courseCaption: 'Picked from your answers',
			daily: (m) => `${m} minutes a day`,
			dailyCaption: (n) => `Up to ${n} new kana a day, plus reviews`,
			level: (j) => `Your level: ${j}`,
			levelCaption: 'Learn opens at your level with nothing locked. Test out of any unit you already know.',
			levelSoon: (j) => `${j} units are being written. Until then, everything in Learn is open.`,
			everyday: 'Your phrasebook and Writing helper',
			everydayCaption: 'Save words from photos, check messages before you send them',
			dailyCaptionEveryday: 'Short reviews of the words you meet'
		},
		card: {
			title: 'Your plan',
			perDay: (m) => `${m} min a day`,
			adjust: 'Adjust',
			hide: 'Hide',
			done: 'Done',
			nudgeTitle: 'Make Benkyo yours',
			nudgeCaption: 'Three taps to pick where you start and how much a day.',
			nudgeGo: 'Personalize'
		}
	},
	th: {
		eyebrow: 'แตะแค่ 3 ครั้ง',
		skip: 'ข้าม',
		back: 'ย้อนกลับ',
		next: 'ถัดไป',
		langLabel: 'ภาษา',
		goalQ: 'อยากเรียนภาษาญี่ปุ่นเพราะอะไร',
		goalHint: 'เลือกได้หลายข้อ เราจะแนะนำคำศัพท์ที่เข้ากับคุณ',
		goals: {
			travel: 'ท่องเที่ยว',
			anime: 'อนิเมะ มังงะ และเกม',
			people: 'เพื่อนและครอบครัว',
			food: 'อาหารและวัฒนธรรม',
			work: 'งานหรือการเรียน',
			fun: 'เรียนสนุก ๆ'
		},
		levelQ: 'ตอนนี้รู้ภาษาญี่ปุ่นแค่ไหนแล้ว',
		levelHint: 'ยังไม่ต้องสอบ แค่เลือกจุดเริ่มต้น',
		levels: {
			new: { title: 'เพิ่งเริ่มเลย', caption: 'เริ่มจากตัวอักษรห้าตัวแรก' },
			some: { title: 'รู้คานะบ้างแล้ว', caption: 'ทดสอบสั้น ๆ เพื่อข้ามสิ่งที่รู้แล้ว' },
			kana: { title: 'อ่านฮิรางานะและคาตากานะได้', caption: 'ทดสอบข้ามบทเรียน แล้วไปฝึกต่อ' },
			daily: { title: 'ใช้ภาษาญี่ปุ่นทุกวัน', caption: 'เลือกระดับจากประโยคจริง' }
		},
		jlptQ: 'เลือกระดับของคุณ',
		jlptHint: 'แตะประโยคที่ยากที่สุดที่อ่านออก ไม่ต้องสอบ เปลี่ยนได้ทุกเมื่อ',
		jlpt: {
			N5: { name: 'N5 · เริ่มต้น', meaning: 'นี่คือหนังสือของฉัน' },
			N4: { name: 'N4 · พื้นฐาน', meaning: 'ถ้าฝนตก จะดูหนังที่บ้าน' },
			N3: { name: 'N3 · ชีวิตประจำวันและงาน', meaning: 'ช่วยแชร์เอกสารประชุมล่วงหน้าได้ไหม' },
			N2: { name: 'N2 · ธุรกิจ', meaning: 'ขอโทษที่รบกวนขณะที่ยุ่ง แต่รบกวนช่วยตรวจด้วย' },
			N1: { name: 'N1 · ขั้นสูง', meaning: 'เรื่องนี้ เราเสียใจที่ต้องขอปฏิเสธ' }
		},
		minutesQ: 'อยากเรียนวันละกี่นาที',
		minutesHint: 'เปลี่ยนได้ทุกเมื่อในการตั้งค่า',
		minutes: {
			5: { title: '5 นาที', caption: 'สบาย ๆ: คานะใหม่ไม่กี่ตัว แล้วทบทวน' },
			10: { title: '10 นาที', caption: 'สม่ำเสมอ: ประมาณวันละสองบท' },
			20: { title: '20 นาที', caption: 'จริงจัง: วันละสามบท' }
		},
		recommended: 'แนะนำ',
		planEyebrow: 'แผนของคุณ',
		planTitle: 'เริ่มต้นตรงนี้',
		planHint: 'แอปจะให้ทบทวนก่อนที่คุณจะลืม วันละนิดก็ไปได้ไกล',
		start: 'เริ่มเรียน',
		change: 'แก้คำตอบ',
		steps: {
			lesson: 'ฮิรางานะ ทีละห้าตัว',
			lessonCaption: 'รู้จัก ลากเส้น จำหน้า นึกออก',
			placement: { hiragana: 'ทดสอบข้ามฮิรางานะที่รู้แล้ว', katakana: 'แล้วทดสอบข้ามคาตากานะ' },
			placementCaption: 'แบบทดสอบสั้น ๆ ไม่มีคำใบ้ ประมาณ 2 นาที',
			course: (c) => `คำศัพท์และวลี: ${COURSE_TH[c]}`,
			courseCaption: 'เลือกจากคำตอบของคุณ',
			daily: (m) => `วันละ ${m} นาที`,
			dailyCaption: (n) => `คานะใหม่ไม่เกินวันละ ${n} ตัว พร้อมทบทวน`,
			level: (j) => `ระดับของคุณ: ${j}`,
			levelCaption: 'หน้าเรียนเปิดที่ระดับของคุณ ไม่มีอะไรล็อก ทดสอบข้ามหน่วยที่รู้แล้วได้เลย',
			levelSoon: (j) => `บทเรียนระดับ ${j} กำลังเขียนอยู่ ระหว่างนี้ทุกอย่างในหน้าเรียนเปิดให้แล้ว`,
			everyday: 'สมุดวลีและผู้ช่วยเขียน',
			everydayCaption: 'เก็บคำจากรูป ตรวจข้อความก่อนส่ง',
			dailyCaptionEveryday: 'ทบทวนสั้น ๆ คำที่คุณเจอ'
		},
		card: {
			title: 'แผนของคุณ',
			perDay: (m) => `วันละ ${m} นาที`,
			adjust: 'ปรับ',
			hide: 'ซ่อน',
			done: 'เสร็จแล้ว',
			nudgeTitle: 'ปรับ Benkyo ให้เป็นของคุณ',
			nudgeCaption: 'แตะสามครั้งเพื่อเลือกจุดเริ่มต้นและเวลาต่อวัน',
			nudgeGo: 'ปรับแต่ง'
		}
	}
};
