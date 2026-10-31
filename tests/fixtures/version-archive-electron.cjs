const { app } = require('electron');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('original-fs').promises;
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');

(async () => {
  const destination = process.argv[2];
  app.setPath('userData', destination);
  try {
    const { extractRuntime, verifyRuntime } = await import(pathToFileURL(resolve(__dirname, '../../desktop/versions/archive.mjs')));
    await extractRuntime(resolve(__dirname, 'update-runtime.zip'), destination, { platform: 'win32' });
    await verifyRuntime(destination, { version: '0.8.3-beta.2', platform: 'win32', arch: 'x64' });
    const { createVersionManager } = await import(pathToFileURL(resolve(__dirname, '../../desktop/versions/manager.mjs')));
    const { createVersionSource } = await import(pathToFileURL(resolve(__dirname, '../../desktop/versions/source.mjs')));
    const bytes = await fs.readFile(resolve(__dirname, 'update-runtime.zip'));
    const descriptor = { schema:1, channel:'beta', version:'0.8.3-beta.2', platform:'win32', arch:'x64', archive:'Cue-Setup-0.8.3-beta.2.zip', size:bytes.length, sha512:createHash('sha512').update(bytes).digest('base64') };
    const source = createVersionSource('https://updates.example.test/releases', { platform:'win32', arch:'x64', fetcher:async url => url.endsWith('.json') ? new Response(JSON.stringify(descriptor)) : new Response(bytes) });
    const executable = resolve(destination, 'installed', 'Cue.exe');
    await fs.mkdir(resolve(destination, 'installed'));
    await fs.writeFile(executable, 'test executable');
    const manager = createVersionManager({ root:resolve(destination,'versions'), currentVersion:'0.8.2', executable, platform:'win32', arch:'x64', isPackaged:true, source });
    await manager.initialize();
    await manager.download('beta');
    assert.equal(manager.snapshot().slots.beta.installedVersion, '0.8.3-beta.2');
    assert.match(await manager.activate('beta'), /Cue\.exe$/);
    assert.equal((await fs.readdir(resolve(destination,'versions'))).some(name => name.startsWith('.download-')), false);
    // Cleanup must treat the archive as a file too, including after a failed download.
    await fs.rm(resolve(destination, 'resources'), { recursive: true });
    console.log('Electron ASAR extraction and validation passed');
    app.exit(0);
  } catch (error) {
    console.error(error.stack);
    app.exit(1);
  }
})();
