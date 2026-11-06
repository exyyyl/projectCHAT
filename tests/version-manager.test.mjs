import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createVersionManager,
  seedBetaData,
  versionDataDirectory,
} from "../desktop/versions/manager.mjs";
import {
  createVersionSource,
  validateDescriptor,
} from "../desktop/versions/source.mjs";
import { archivePath, extractRuntime } from "../desktop/versions/archive.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const files = [],
    directory = [];
  let offset = 0;
  for (const { name, text, mode = 0o100644 } of entries) {
    const data = Buffer.from(text),
      filename = Buffer.from(name),
      crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    files.push(local, filename, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(0x314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28);
    central.writeUInt32LE((mode * 65536) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    directory.push(central, filename);
    offset += local.length + filename.length + data.length;
  }
  const dir = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, dir, end]);
}
function runtime(version, channel) {
  const bytes = zip([
    { name: "Cue.exe", text: "test executable" },
    { name: "resources/app.asar", text: "test asar" },
    {
      name: "resources/cue-runtime.json",
      text: JSON.stringify({
        schema: 1,
        appId: "ru.projectchat.app",
        platform: "win32",
        arch: "x64",
        version,
      }),
    },
  ]);
  return {
    bytes,
    descriptor: {
      schema: 1,
      channel,
      version,
      platform: "win32",
      arch: "x64",
      archive: `Cue-${version}.zip`,
      size: bytes.length,
      sha512: createHash("sha512").update(bytes).digest("base64"),
    },
  };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "cue-versions-")),
    exe = join(root, "installed", "Cue.exe");
  await mkdir(join(root, "installed"));
  await writeFile(exe, "installed");
  const artifacts = {
    stable: runtime("1.1.0", "stable"),
    beta: runtime("1.2.0-beta.1", "beta"),
  };
  let requests = 0;
  const source = createVersionSource("https://updates.example.test/releases", {
    platform: "win32",
    arch: "x64",
    fetcher: async (url) => {
      requests++;
      for (const [key, item] of Object.entries(artifacts)) {
        if (url.endsWith(`/${key}-win32-x64.json`))
          return new Response(JSON.stringify(item.descriptor));
        if (url.endsWith("/" + item.descriptor.archive))
          return new Response(item.bytes);
      }
      return new Response("", { status: 404 });
    },
  });
  const options = {
    root: join(root, "versions"),
    currentVersion: "1.0.0",
    executable: exe,
    platform: "win32",
    arch: "x64",
    isPackaged: true,
    source,
  };
  return {
    root,
    exe,
    artifacts,
    options,
    get requests() {
      return requests;
    },
  };
}

test("download both branches once; switching to beta and older stable needs no installer or network", async () => {
  const f = await fixture(),
    manager = createVersionManager(f.options);
  assert.equal(await manager.initialize(), null);
  await manager.markHealthy();
  await manager.check();
  assert.equal(manager.snapshot().slots.beta.availableVersion, "1.2.0-beta.1");
  await manager.download("beta");
  await manager.download("stable");
  const requests = f.requests;
  const betaExe = await manager.activate("beta");
  assert.match(betaExe, /1\.2\.0-beta\.1/);
  const offline = {
    describe: () => {
      throw new Error("offline");
    },
    download: () => {
      throw new Error("offline");
    },
  };
  const beta = createVersionManager({
    ...f.options,
    source: offline,
    currentVersion: "1.2.0-beta.1",
    executable: betaExe,
  });
  assert.equal(await beta.initialize(), null);
  await beta.markHealthy();
  assert.equal(beta.snapshot().currentChannel, "beta");
  const stableExe = await beta.activate("stable");
  assert.match(stableExe, /1\.1\.0/);
  const stable = createVersionManager({
    ...f.options,
    source: offline,
    currentVersion: "1.1.0",
    executable: stableExe,
  });
  assert.equal(await stable.initialize(), null);
  await stable.markHealthy();
  assert.equal(await stable.activate("beta"), betaExe);
  assert.equal(f.requests, requests);
});

test("an unconfirmed beta startup falls back to the previous stable executable", async () => {
  const f = await fixture(),
    manager = createVersionManager(f.options);
  await manager.initialize();
  await manager.download("beta");
  const target = await manager.activate("beta");
  const crashed = createVersionManager({
    ...f.options,
    currentVersion: "1.2.0-beta.1",
    executable: target,
  });
  assert.equal(await crashed.initialize(), null); // No healthy renderer acknowledgement.
  const reopened = createVersionManager(f.options);
  assert.equal(await reopened.initialize(), null);
  assert.equal(reopened.snapshot().slots.stable.current, true);
  assert.match(reopened.snapshot().message, /возврат/u);
});

test("normal shortcuts dispatch to the saved branch without changing the default installed version", async () => {
  const f = await fixture(),
    manager = createVersionManager(f.options);
  await manager.initialize();
  await manager.download("beta");
  const target = await manager.activate("beta");
  const running = createVersionManager({
    ...f.options,
    currentVersion: "1.2.0-beta.1",
    executable: target,
  });
  await running.initialize();
  await running.markHealthy();
  const launcher = createVersionManager(f.options);
  assert.equal(await launcher.initialize(), target);
});

test("corrupt archives never replace the registered branch and retry removes staging data", async () => {
  const f = await fixture();
  f.artifacts.beta.descriptor.sha512 = Buffer.alloc(64, 1).toString("base64");
  const manager = createVersionManager(f.options);
  await manager.initialize();
  await assert.rejects(manager.download("beta"), /сумма/u);
  assert.equal(manager.snapshot().slots.beta.installedVersion, null);
  assert.equal(
    (await readdir(f.options.root)).some((name) =>
      name.startsWith(".download-"),
    ),
    false,
  );
  await assert.rejects(manager.activate("beta"), /Сначала скачайте/u);
  await assert.rejects(manager.download("../bad"), /ветка/u);
});

test("archive extractor rejects traversal, symlinks outside the bundle, alias parents and special file types", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cue-version-zip-"));
  for (const name of [
    "../escape",
    "/absolute",
    "C:/file",
    "file:stream",
    "NUL",
    "a/../escape",
    "a\\evil",
  ])
    assert.throws(() => archivePath(directory, name));
  for (const entries of [
    [{ name: "a", text: "../../escape", mode: 0o120777 }],
    [
      { name: "a", text: "b", mode: 0o120777 },
      { name: "a/c", text: "../z", mode: 0o120777 },
    ],
    [{ name: "pipe", text: "x", mode: 0o010644 }],
    [
      { name: "x", text: "x" },
      { name: "X", text: "y" },
    ],
  ]) {
    const folder = await mkdtemp(join(directory, "case-")),
      archive = join(folder, "test.zip"),
      out = join(folder, "out");
    await mkdir(out);
    await writeFile(archive, zip(entries));
    await assert.rejects(extractRuntime(archive, out, { platform: "darwin" }));
  }
  const folder = await mkdtemp(join(directory, "safe-"));
  await mkdir(join(folder, "out"));
  await writeFile(
    join(folder, "test.zip"),
    zip([
      { name: "Versions/A/lib", text: "library" },
      { name: "Versions/Current", text: "A", mode: 0o120777 },
    ]),
  );
  await extractRuntime(join(folder, "test.zip"), join(folder, "out"), {
    platform: "darwin",
  });
  assert.equal(
    await readFile(join(folder, "out/Versions/Current/lib"), "utf8"),
    "library",
  );
});

test("release descriptors, redirect origins and architecture are validated before installation", async () => {
  const item = runtime("1.2.0-beta.1", "beta");
  for (const patch of [
    { channel: "stable" },
    { platform: "darwin" },
    { arch: "arm64" },
    { archive: "../x.zip" },
    { sha512: "abc" },
    { version: "../../x" },
    { size: 0 },
  ])
    assert.throws(() =>
      validateDescriptor(
        { ...item.descriptor, ...patch },
        { channel: "beta", platform: "win32", arch: "x64" },
      ),
    );
  const source = createVersionSource("https://updates.test", {
    platform: "win32",
    arch: "x64",
    fetcher: async () =>
      new Response("", {
        status: 302,
        headers: { Location: "https://evil.test/app.zip" },
      }),
  });
  await assert.rejects(source.describe("beta"), /Недоверенный/u);
  assert.throws(() => createVersionSource("http://updates.test"), /HTTPS/u);
});

test("beta gets a one-time separate snapshot; stable data and credentials stay independent", async () => {
  const root = await mkdtemp(join(tmpdir(), "cue-version-data-"));
  await mkdir(versionDataDirectory(root, "stable"));
  await writeFile(join(root, "app-data/state.json"), "stable");
  await writeFile(join(root, "app-data/twitch.json"), "private");
  await seedBetaData(root);
  assert.equal(
    await readFile(join(root, "app-data-beta/state.json"), "utf8"),
    "stable",
  );
  await writeFile(join(root, "app-data-beta/state.json"), "beta");
  await seedBetaData(root);
  assert.equal(
    await readFile(join(root, "app-data/state.json"), "utf8"),
    "stable",
  );
  assert.equal(
    await readFile(join(root, "app-data-beta/state.json"), "utf8"),
    "beta",
  );
  await assert.rejects(readFile(join(root, "app-data-beta/twitch.json")), {
    code: "ENOENT",
  });
});

test("development does not download or launch packaged versions", async () => {
  const f = await fixture(),
    manager = createVersionManager({ ...f.options, isPackaged: false });
  assert.equal(await manager.initialize(), null);
  assert.equal(manager.snapshot().supported, false);
  await assert.rejects(manager.download("beta"), /установленном/u);
  assert.equal(f.requests, 0);
});

test("downloading an update does not activate it on normal quit; upgraded base executables refresh metadata", async () => {
  const f = await fixture(),
    manager = createVersionManager(f.options);
  await manager.initialize();
  await manager.download("stable");
  const unchanged = createVersionManager(f.options);
  assert.equal(await unchanged.initialize(), null);
  assert.equal(unchanged.snapshot().currentVersion, "1.0.0");
  const fresh = await fixture(),
    before = createVersionManager(fresh.options);
  await before.initialize();
  const upgraded = createVersionManager({
    ...fresh.options,
    currentVersion: "1.3.0",
  });
  assert.equal(await upgraded.initialize(), null);
  assert.equal(upgraded.snapshot().slots.stable.installedVersion, "1.3.0");
  assert.equal(upgraded.snapshot().slots.stable.current, true);
});

test("beta source uses published prereleases and never selects drafts or a different repository", async () => {
  const item = runtime("1.2.0-beta.1", "beta");
  const url =
    "https://github.com/owner/Cue/releases/download/v1.2.0-beta.1/beta-win32-x64.json";
  const source = createVersionSource(
    "https://github.com/owner/Cue/releases/latest/download",
    {
      platform: "win32",
      arch: "x64",
      fetcher: async (input) => {
        if (input.startsWith("https://api.github.com/"))
          return new Response(
            JSON.stringify([
              {
                draft: true,
                prerelease: true,
                assets: [
                  {
                    name: "beta-win32-x64.json",
                    browser_download_url: "https://evil.test/draft",
                  },
                ],
              },
              {
                draft: false,
                prerelease: false,
                assets: [
                  {
                    name: "beta-win32-x64.json",
                    browser_download_url: "https://evil.test/stable",
                  },
                ],
              },
              {
                draft: false,
                prerelease: true,
                assets: [
                  { name: "beta-win32-x64.json", browser_download_url: url },
                ],
              },
            ]),
          );
        assert.equal(input, url);
        return new Response(JSON.stringify(item.descriptor));
      },
    },
  );
  assert.equal((await source.describe("beta")).version, "1.2.0-beta.1");
});

test("beta is hidden as stale once a stable release is not older than it", async () => {
  const source = (betaVersion) => {
    const item = runtime(betaVersion, "beta");
    const url = `https://github.com/owner/Cue/releases/download/v${betaVersion}/beta-win32-x64.json`;
    return createVersionSource(
      "https://github.com/owner/Cue/releases/latest/download",
      {
        platform: "win32",
        arch: "x64",
        fetcher: async (input) => {
          if (input.startsWith("https://api.github.com/"))
            return new Response(
              JSON.stringify([
                { draft: true, prerelease: false, tag_name: "v9.9.9", assets: [] },
                { draft: false, prerelease: false, tag_name: "v0.8.3", assets: [] },
                { draft: false, prerelease: false, tag_name: "v0.8.2", assets: [] },
                {
                  draft: false,
                  prerelease: true,
                  tag_name: `v${betaVersion}`,
                  assets: [
                    { name: "beta-win32-x64.json", browser_download_url: url },
                  ],
                },
              ]),
            );
          return new Response(JSON.stringify(item.descriptor));
        },
      },
    );
  };
  await assert.rejects(source("0.8.3-beta.3").describe("beta"), (error) => {
    assert.equal(error.code, "STALE_BETA");
    assert.equal(error.stableVersion, "0.8.3");
    return true;
  });
  assert.equal((await source("0.8.4-beta.1").describe("beta")).version, "0.8.4-beta.1");
});

test("a stale beta becomes a notice, not an error, when checking versions", async () => {
  const f = await fixture();
  f.artifacts.beta = runtime("1.1.0-beta.4", "beta");
  const manager = createVersionManager(f.options);
  await manager.initialize();
  await manager.markHealthy();
  await manager.check();
  const snapshot = manager.snapshot();
  assert.equal(snapshot.slots.beta.availableVersion, null);
  assert.equal(snapshot.errors.beta, undefined);
  assert.match(snapshot.notices.beta, /стабильная 1\.1\.0/u);
  assert.equal(snapshot.slots.stable.availableVersion, "1.1.0");
});

test("release packaging writes the runtime checksum manifest consumed by the client", async () => {
  const { writeRuntimeManifest } =
    await import("../scripts/write-runtime-manifest.mjs");
  const directory = await mkdtemp(join(tmpdir(), "cue-version-release-")),
    item = runtime("1.2.0-beta.1", "beta");
  await writeFile(join(directory, "Cue-Setup-1.2.0-beta.1.zip"), item.bytes);
  const path = await writeRuntimeManifest({
    directory,
    version: "1.2.0-beta.1",
    platform: "win32",
    arch: "x64",
  });
  const descriptor = JSON.parse(await readFile(path, "utf8"));
  assert.equal(descriptor.sha512, item.descriptor.sha512);
  assert.equal(descriptor.size, item.bytes.length);
  assert.equal(descriptor.channel, "beta");
  validateDescriptor(descriptor, {
    channel: "beta",
    platform: "win32",
    arch: "x64",
  });
});
