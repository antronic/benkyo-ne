// Storybook stand-in for $app/state: the page is always the story's own URL.
export const page = $state({
	url: new URL(location.href),
	params: {} as Record<string, string>,
	route: { id: null as string | null },
	status: 200,
	error: null,
	data: {} as Record<string, unknown>,
	state: {} as Record<string, unknown>,
	form: null
});
export const navigating = { from: null, to: null, type: null, willUnload: undefined, delta: undefined, complete: undefined };
export const updated = { current: false, check: async () => false };
