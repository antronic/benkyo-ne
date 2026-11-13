import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			// Static SPA: every route is rendered on the client, so the app shell
			// can be precached by the service worker and run fully offline.
			adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html' })
		})
	],
	test: {
		include: ['src/**/*.test.ts', 'worker/**/*.test.ts']
	}
});
