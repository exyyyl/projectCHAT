import { createRequire } from 'node:module';

// Electron's patched fs treats .asar as a virtual directory. Downloaded bundles
// must be written, checked and removed as ordinary files without a global noAsar flag.
const require = createRequire(import.meta.url);
export const nativeFs = require(process.versions.electron ? 'original-fs' : 'node:fs');
