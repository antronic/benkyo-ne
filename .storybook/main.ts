import type { StorybookConfig } from '@storybook/svelte-vite';

/**
 * Storybook for the Benkyo UI kit (src/lib/ui). Stories live next to the kit in
 * src/lib/ui/stories/ and `npm run lint:ui` fails when a kit component has none.
 * Built by `npm run build-storybook` into build/storybook/, served at /storybook/.
 * See docs/DESIGN-SYSTEM.md#storybook.
 */
const config: StorybookConfig = {
	stories: ['../src/lib/ui/stories/*.stories.svelte'],
	addons: ['@storybook/addon-svelte-csf', '@storybook/addon-docs', '@storybook/addon-themes'],
	framework: {
		name: '@storybook/svelte-vite',
		// The app's vite.config.ts runs SvelteKit; the kit only needs plain Svelte.
		options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } }
	},
	core: { disableTelemetry: true },
	docs: { defaultName: 'Docs' }
};
export default config;
