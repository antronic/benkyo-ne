// Storybook stand-in for $app/navigation: stories never leave the canvas.
export async function goto(url: string | URL): Promise<void> {
	console.info('[storybook] goto', String(url));
}
export async function invalidateAll(): Promise<void> {}
export function beforeNavigate(): void {}
export function afterNavigate(): void {}
export function onNavigate(): void {}
