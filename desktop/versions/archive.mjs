import { createWriteStream } from "node:fs";
import { chmod, mkdir, readFile, realpath, symlink } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

export const inside = (root, path) => {
  const value = relative(resolve(root), resolve(path));
  return (
    value !== "" &&
    value !== ".." &&
    !value.startsWith(`..${sep}`) &&
    !isAbsolute(value)
  );
};
export function archivePath(root, name) {
  if (
    typeof name !== "string" ||
    /[\\:\x00-\x1f]/u.test(name) ||
    name.startsWith("/") ||
    name
      .split("/")
      .some(
        (part) =>
          part === ".." ||
          part === "." ||
          /[. ]$/u.test(part) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part),
      )
  )
    throw new Error("Небезопасный путь в архиве.");
  const target = resolve(root, name);
  if (!inside(root, target))
    throw new Error("Архив выходит за пределы папки версии.");
  return target;
}
export async function extractRuntime(
  filename,
  destination,
  { platform = process.platform } = {},
) {
  const zip = await yauzl.openPromise(filename, {
    lazyEntries: true,
    strictFileNames: true,
    validateEntrySizes: true,
  });
  const names = new Set(),
    links = [];
  let total = 0,
    count = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      if (++count > 100000 || (total += entry.uncompressedSize) > 6 * 1024 ** 3)
        throw new Error("Архив версии слишком большой.");
      const target = archivePath(destination, entry.fileName);
      const key = ["win32", "darwin"].includes(platform)
        ? target.toLowerCase()
        : target;
      if (names.has(key)) throw new Error("Повторяющийся путь в архиве.");
      names.add(key);
      const mode = entry.externalFileAttributes >>> 16;
      const type = mode & 0o170000;
      if (type && ![0o100000, 0o040000, 0o120000].includes(type))
        throw new Error("Недопустимый тип файла в архиве.");
      if (entry.fileName.endsWith("/")) {
        if (type === 0o120000) throw new Error("Некорректная ссылка в архиве.");
        await mkdir(target, { recursive: true });
        continue;
      }
      if (type === 0o120000) {
        if (platform !== "darwin" || entry.uncompressedSize > 4096)
          throw new Error("Недопустимая ссылка в архиве.");
        const stream = await zip.openReadStreamPromise(entry);
        const parts = [];
        for await (const chunk of stream) parts.push(chunk);
        const link = Buffer.concat(parts).toString("utf8");
        if (
          !link ||
          isAbsolute(link) ||
          /[\\\x00]/u.test(link) ||
          !inside(destination, resolve(dirname(target), link))
        )
          throw new Error("Ссылка выходит за пределы версии.");
        links.push({ target, link });
        continue;
      }
      await mkdir(dirname(target), { recursive: true });
      await pipeline(
        await zip.openReadStreamPromise(entry),
        createWriteStream(target, { flags: "wx", mode: 0o600 }),
      );
      if (platform !== "win32")
        await chmod(target, mode & 0o111 ? 0o755 : 0o644);
    }
    // Links are created last: extraction never writes through archive symlinks.
    for (const { target } of links)
      if (
        links.some(
          (other) => other.target !== target && inside(other.target, target),
        )
      )
        throw new Error("Ссылка находится внутри другой ссылки.");
    for (const { target, link } of links) {
      await mkdir(dirname(target), { recursive: true });
      await symlink(link, target);
    }
    const actualRoot = await realpath(destination);
    for (const { target } of links)
      if (!inside(actualRoot, await realpath(target)))
        throw new Error("Ссылка выходит за пределы версии.");
  } finally {
    zip.close();
  }
}

export const runtimeExecutable = (platform) =>
  platform === "darwin" ? "Cue.app/Contents/MacOS/Cue" : "Cue.exe";
export const runtimeResources = (platform) =>
  platform === "darwin" ? "Cue.app/Contents/Resources" : "resources";
export async function verifyRuntime(directory, descriptor) {
  const resources = resolve(directory, runtimeResources(descriptor.platform));
  const marker = JSON.parse(
    await readFile(resolve(resources, "cue-runtime.json"), "utf8"),
  );
  if (
    marker.schema !== 1 ||
    marker.appId !== "ru.projectchat.app" ||
    marker.version !== descriptor.version ||
    marker.platform !== descriptor.platform ||
    marker.arch !== descriptor.arch
  )
    throw new Error("Сборка не соответствует описанию версии.");
  const { lstat } = await import("node:fs/promises");
  const actualRoot = await realpath(directory);
  for (const file of [
    runtimeExecutable(descriptor.platform),
    runtimeResources(descriptor.platform) + "/app.asar",
  ]) {
    const path = resolve(directory, file),
      actual = await realpath(path);
    if (
      !inside(actualRoot, actual) ||
      !(await lstat(path)).isFile() ||
      (await lstat(path)).size === 0
    )
      throw new Error("Сборка приложения повреждена.");
  }
  return resolve(directory, runtimeExecutable(descriptor.platform));
}
