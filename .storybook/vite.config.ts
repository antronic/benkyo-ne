import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Plain Svelte for Storybook: the kit needs no SvelteKit routing. `#lib/*` resolves
// through the "imports" field in package.json; the few $app modules the kit reaches
// get small stand-ins in .storybook/app/.
export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			'$app/env': here('./app/env.ts'),
			'$app/navigation': here('./app/navigation.ts'),
			'$app/state': here('./app/state.svelte.ts')
		}
	}
});
