import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { validVersion, versionChannel } from "../desktop/versions/source.mjs";

export async function writeRuntimeManifest({
  directory = "release",
  version,
  platform,
  arch,
}) {
  if (
    !validVersion(version) ||
    !["win32", "darwin"].includes(platform) ||
    !["x64", "arm64"].includes(arch)
  )
    throw new Error("Некорректная платформа сборки.");
  const expected =
    platform === "win32"
      ? `Cue-Setup-${version}.zip`
      : `Cue-${version}-${arch}.zip`;
  const candidates = (await readdir(directory)).filter(
    (name) => name === expected,
  );
  if (candidates.length !== 1)
    throw new Error(
      "Ожидался один ZIP-архив приложения для текущей платформы.",
    );
  const archive = basename(candidates[0]),
    filename = join(directory, archive),
    hash = createHash("sha512");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  const channel = versionChannel(version);
  const descriptor = {
    schema: 1,
    channel,
    version,
    platform,
    arch,
    archive,
    size: (await stat(filename)).size,
    sha512: hash.digest("base64"),
  };
  const target = join(directory, `${channel}-${platform}-${arch}.json`);
  await writeFile(target, JSON.stringify(descriptor, null, 2) + "\n");
  return target;
}
