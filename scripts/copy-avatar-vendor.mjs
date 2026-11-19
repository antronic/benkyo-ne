// Copies the files the avatar loads at run time (not bundled by Vite) into static/avatar/vendor/:
//   three.webgpu.min.js        Coreva Render's live 3D engine loads it from threeUrl (src/lib/avatar/render.ts)
//   mediapipe/*.{js,wasm}      the selfie reader's WebAssembly (src/lib/avatar/selfie.ts)
// The folder is git-ignored and rebuilt by `npm run build` and `npm run dev`. The service worker
// does not precache /avatar/ (src/service-worker/index.ts): each file is cached on first use.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = (name) => join(root, 'node_modules', name);
const out = join(root, 'static/avatar/vendor');
mkdirSync(join(out, 'mediapipe'), { recursive: true });

const three = mod('three');
copyFileSync(join(three, 'build/three.webgpu.min.js'), join(out, 'three.webgpu.min.js'));

const mp = join(mod('@mediapipe/tasks-vision'), 'wasm');
for (const f of readdirSync(mp)) if (f.startsWith('vision_wasm_internal.')) copyFileSync(join(mp, f), join(out, 'mediapipe', f));
console.log('avatar vendor files copied to static/avatar/vendor');
