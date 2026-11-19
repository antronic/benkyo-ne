/**
 * Today's greeting: a Japanese greeting for the large title and the
 * interface-language line under it, by the learner's local hour, with their
 * first name when we know it (the account name from sign-up).
 */
export type GreetingKey = 'home.morning' | 'home.afternoon' | 'home.evening';

export function greetingFor(hour: number): { jp: string; key: GreetingKey } {
	if (hour >= 4 && hour < 11) return { jp: 'おはよう', key: 'home.morning' };
	if (hour >= 11 && hour < 18) return { jp: 'こんにちは', key: 'home.afternoon' };
	return { jp: 'こんばんは', key: 'home.evening' };
}

/** First word of a display name, trimmed to fit a greeting ('' when there is none). */
export function greetName(name: string | null | undefined): string {
	const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
	return first.length > 20 ? first.slice(0, 19) + '…' : first;
}
