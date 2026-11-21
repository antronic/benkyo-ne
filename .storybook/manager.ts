import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

// Name the Storybook after the app; the link goes back to the in-app catalog.
addons.setConfig({
	theme: create({ base: 'light', brandTitle: 'Benkyo UI kit', brandUrl: '/design', brandTarget: '_self' })
});
