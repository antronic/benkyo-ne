/**
 * A pretend community API with made-up learners, for /design and screenshots.
 * Nothing leaves the page. `fakeCommunity({ joined: false })` starts without a
 * handle, so the first-share steps show.
 */
import type { CommunityApi } from './client.ts';
import { CommunityRequestError } from './client.ts';
import { GUIDELINES_VERSION, type Me, type Post, type Reply } from './contract.ts';

const DAY = 86_400_000;

export function fakeCommunity({ joined = true, empty = false, fail = false } = {}): CommunityApi {
	let me: Me = joined
		? { profile: { handle: 'you_learn', guidelinesVersion: GUIDELINES_VERSION, status: 'active' }, guidelinesVersion: GUIDELINES_VERSION, canPost: true }
		: { profile: null, guidelinesVersion: GUIDELINES_VERSION, canPost: false };
	let nextId = 100;
	const now = Date.now();
	const post = (id: number, handle: string, body: string, likes: number, replies: number, lang: Post['lang'], daysAgo: number): Post => ({
		id,
		type: 'note',
		subject: 'kanji:日',
		label: '日',
		body,
		lang,
		handle,
		mine: false,
		liked: false,
		likes,
		replies,
		status: 'published',
		createdAt: now - daysAgo * DAY,
		editedAt: null
	});
	let posts: Post[] = empty
		? []
		: [
				post(1, 'sakura_learns', 'Picture a window with the sun shining through it. 日 is the sun, and also a day: 日曜日 is Sunday.', 12, 2, 'en', 3),
				post(2, 'mai.th', 'จำง่าย ๆ ว่าเป็นหน้าต่างที่มีพระอาทิตย์ อ่านว่า にち หรือ ひ', 7, 0, 'th', 5),
				post(3, 'kenji_92', '日本 (にほん) literally means “origin of the sun”.', 4, 1, 'en', 9),
				post(4, 'ren_studies', 'Don’t mix it up with 目 (eye): 目 has two lines inside.', 2, 0, 'en', 12)
			];
	let mine: Post | null = null;
	const replies: Record<number, Reply[]> = {
		1: [
			{ id: 11, postId: 1, body: 'This helped a lot, thanks!', lang: 'en', handle: 'mai.th', mine: false, liked: false, likes: 1, status: 'published', createdAt: now - 2 * DAY },
			{ id: 12, postId: 1, body: 'And 月 is the moon, same idea.', lang: 'en', handle: 'kenji_92', mine: false, liked: false, likes: 0, status: 'published', createdAt: now - DAY }
		],
		3: [{ id: 13, postId: 3, body: 'So Japan is the land of the rising sun!', lang: 'en', handle: 'ren_studies', mine: false, liked: false, likes: 0, status: 'published', createdAt: now - 6 * DAY }]
	};
	const wait = <T>(v: T, ms = 450) => new Promise<T>((r) => setTimeout(() => r(v), ms));
	const failing = () => new Promise<never>((_, no) => setTimeout(() => no(new CommunityRequestError(0, 'network', 'network')), 450));

	return {
		communityMe: () => (fail ? failing() : wait(me)),
		setProfile: async (handle: string) => {
			me = { profile: { handle: handle.replace(/^@/, '').toLowerCase(), guidelinesVersion: GUIDELINES_VERSION, status: 'active' }, guidelinesVersion: GUIDELINES_VERSION, canPost: true };
			return wait(me);
		},
		subjectNotes: (subject: string) => (fail ? failing() : wait({ subject, posts, mine, total: posts.length })),
		shareNote: async (subject, label, body, lang) => {
			const id = mine?.id ?? nextId++;
			mine = { ...post(id, me.profile!.handle, body, 0, 0, lang, 0), subject, label, mine: true, editedAt: mine ? Date.now() : null };
			return wait(mine);
		},
		getThread: async (id: number) => wait({ post: posts.find((p) => p.id === id) ?? mine!, replies: replies[id] ?? [] }),
		deletePost: async () => {
			mine = null;
			return wait({ ok: true as const });
		},
		postReply: async (postId: number, body: string, lang) =>
			wait({ id: nextId++, postId, body, lang, handle: me.profile?.handle ?? 'you_learn', mine: true, liked: false, likes: 0, status: 'published' as const, createdAt: Date.now() }),
		deleteReply: async () => wait({ ok: true as const }),
		setLike: async (_kind, id: number, on: boolean) => {
			const p = posts.find((x) => x.id === id);
			if (p) posts = posts.map((x) => (x.id === id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x));
			return wait({ liked: on, likes: (p?.likes ?? 0) + (on ? 1 : -1) }, 250);
		},
		report: async () => wait({ ok: true as const }),
		block: async () => wait({ ok: true as const })
	} as CommunityApi;
}
