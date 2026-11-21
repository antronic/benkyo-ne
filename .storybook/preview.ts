import type { Preview } from '@storybook/svelte-vite';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
// The app's global CSS: tokens (lib/design/tokens.css), type, glass and layout helpers.
import '../src/app.css';
import './preview.css';

/** The widths the layout check and the visual review use (scripts/check-layout.mjs). */
const viewports = {
	phone: { name: 'Phone (390)', styles: { width: '390px', height: '844px' }, type: 'mobile' },
	ipad: { name: 'iPad (768)', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
	ipadWide: { name: 'iPad landscape (1024)', styles: { width: '1024px', height: '768px' }, type: 'tablet' },
	desktop: { name: 'Desktop (1280)', styles: { width: '1280px', height: '800px' }, type: 'desktop' }
};

const preview: Preview = {
	parameters: {
		layout: 'padded',
		viewport: { options: viewports },
		backgrounds: { disable: true },
		controls: { expanded: true, exclude: /^(data-sveltekit-|on[a-z]+$)/ },
		options: { storySort: { order: ['Foundations', 'Controls', 'Content', 'Feedback', 'Navigation', 'Data', 'Learning', 'Avatar', 'Pages'] } }
	},
	decorators: [
		// data-theme on <html> forces light or dark, exactly as in the app (tokens.css).
		withThemeByDataAttribute({ themes: { light: 'light', dark: 'dark' }, defaultTheme: 'light', attributeName: 'data-theme' })
	],
	tags: ['autodocs']
};
export default preview;
