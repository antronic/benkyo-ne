/**
 * Token names grouped for the /design catalog. The values live in tokens.css;
 * the catalog reads them back with getComputedStyle so this list never has to
 * repeat them.
 */
export const colorGroups: { name: string; tokens: { name: string; use: string }[] }[] = [
	{
		name: 'Surfaces',
		tokens: [
			{ name: '--color-bg', use: 'Page background (washi / sumi)' },
			{ name: '--color-bg-2', use: 'Solid fallback for glass' },
			{ name: '--color-surface', use: 'Glass card' },
			{ name: '--color-surface-strong', use: 'Glass field, sheet' },
			{ name: '--color-fill', use: 'Tracks, pressed rows' },
			{ name: '--color-border', use: 'Hairlines' }
		]
	},
	{
		name: 'Text',
		tokens: [
			{ name: '--color-text', use: 'Primary text' },
			{ name: '--color-text-2', use: 'Secondary, captions' },
			{ name: '--color-text-3', use: 'Eyebrows, placeholders' }
		]
	},
	{
		name: 'Brand and status',
		tokens: [
			{ name: '--color-accent', use: '朱 Vermilion: main actions' },
			{ name: '--color-info', use: '藍 Indigo: links, focus, selected' },
			{ name: '--color-violet', use: '菫 Violet: words, AI' },
			{ name: '--color-success', use: '抹茶 Matcha: correct, on' },
			{ name: '--color-warning', use: '山吹 Yamabuki: due, caution' },
			{ name: '--color-danger', use: '紅 Beni: errors, destructive' }
		]
	}
];

export const textStyles = [
	{ name: 'Large title', cls: 'large-title', token: '--text-large-title', size: '34' },
	{ name: 'Title 1', cls: 'title-1', token: '--text-title-1', size: '28' },
	{ name: 'Title 2', cls: 'title-2', token: '--text-title-2', size: '22' },
	{ name: 'Title 3', cls: 'title-3', token: '--text-title-3', size: '20' },
	{ name: 'Headline', cls: 'headline', token: '--text-body', size: '17 semibold' },
	{ name: 'Body', cls: '', token: '--text-body', size: '17' },
	{ name: 'Callout', cls: 'callout', token: '--text-callout', size: '16' },
	{ name: 'Subhead', cls: 'subhead', token: '--text-subhead', size: '15' },
	{ name: 'Footnote', cls: 'footnote', token: '--text-footnote', size: '13' },
	{ name: 'Caption', cls: 'caption', token: '--text-caption', size: '12' },
	{ name: 'Eyebrow', cls: 'eyebrow', token: '--text-footnote', size: '13 caps' }
] as const;

export const spaceTokens = ['--space-1', '--space-1h', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8', '--space-10', '--space-12'];

export const radiusTokens = ['--radius-xs', '--radius-sm', '--radius-md', '--radius-control', '--radius-card', '--radius-sheet', '--radius-pill'];

export const motionTokens = [
	{ name: '--ease-spring', use: 'Presses, morphs' },
	{ name: '--ease-spring-bouncy', use: 'Switch knob, success pops' },
	{ name: '--ease-out', use: 'Page transitions, shakes' }
];
