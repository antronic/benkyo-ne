/**
 * When the "More below" button (ScrollMore.svelte) shows. Pure, so it is tested on its own.
 *
 * It shows while more than `minLeft` px of the page is still below the visible area. The bar is
 * the larger of 200px and 40% of the screen, so a screen that is only a little taller than the
 * window, or the last stretch of a long one, does not get the button.
 */
export function leftBelow(scrollTop: number, viewHeight: number, pageHeight: number): number {
	return Math.max(0, pageHeight - (scrollTop + viewHeight));
}

export function minLeft(viewHeight: number): number {
	return Math.max(200, Math.round(viewHeight * 0.4));
}

export function showMore(scrollTop: number, viewHeight: number, pageHeight: number): boolean {
	return leftBelow(scrollTop, viewHeight, pageHeight) > minLeft(viewHeight);
}
