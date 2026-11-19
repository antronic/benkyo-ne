/**
 * Control sizes shared by Button, TextField and Select, so a field and its
 * action line up. FieldRow sets the size for everything inside it.
 *   sm 36px · md 44px (minimum touch target) · lg 50px
 */
import { getContext, setContext } from 'svelte';

export type ControlSize = 'sm' | 'md' | 'lg';
const KEY = Symbol('ui-control-size');

export function provideControlSize(get: () => ControlSize) {
	setContext(KEY, get);
}

/** The size from the nearest FieldRow, if any. */
export function inheritedControlSize(): ControlSize | undefined {
	return getContext<(() => ControlSize) | undefined>(KEY)?.();
}
