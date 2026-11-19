/** Types for scripts/check-ui.mjs (used by src/lib/ui/kit.test.ts). */
export type Problem = { file: string; line: number; rule: 'raw-control' | 'adhoc-class' | 'loading-state' | 'kit-export' | 'kit-catalog' | 'spin-box'; message: string };
export function lintComponent(text: string, file?: string): Problem[];
export function kitCoverage(root?: string): Problem[];
export function lintSpin(text: string, file?: string): Problem[];
