/** Types for scripts/check-spacing.mjs (used by src/lib/design/spacing.test.ts). */
export type Step = [px: number, token: string];
export type Problem = { file: string; line: number; value: string; suggestion: string };
export const SCALE: Step[];
export function tokenFor(px: number): Step | null;
export function lintText(text: string, file?: string): { problems: Problem[]; fixed: string };
