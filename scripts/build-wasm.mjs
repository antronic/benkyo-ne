// Builds wasm/stroke and copies the module to static/wasm/stroke.wasm.
// Needs: rustup target add wasm32-unknown-unknown
import { execSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';

execSync('cargo build --release --target wasm32-unknown-unknown', {
	cwd: new URL('../wasm/stroke', import.meta.url),
	stdio: 'inherit'
});
copyFileSync(
	new URL('../wasm/stroke/target/wasm32-unknown-unknown/release/stroke.wasm', import.meta.url),
	new URL('../static/wasm/stroke.wasm', import.meta.url)
);
console.log('static/wasm/stroke.wasm updated');
