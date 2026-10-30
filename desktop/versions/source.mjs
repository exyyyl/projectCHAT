import { createHash } from "node:crypto";
import { open } from "node:fs/promises";

export const versionChannel = (version) =>
  version.includes("-") ? "beta" : "stable";
export const validVersion = (value) =>
  typeof value === "string" &&
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(value) &&
  value.length < 100;
export function compareVersions(left, right) {
  const parts = (version) => {
    const dash = version.indexOf("-");
    return [
      version
        .slice(0, dash < 0 ? undefined : dash)
        .split(".")
        .map(BigInt),
      dash < 0 ? null : version.slice(dash + 1).split("."),
    ];
  };
  const [a, ap] = parts(left),
    [b, bp] = parts(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  if (!ap || !bp) return ap === bp ? 0 : ap ? -1 : 1;
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] === undefined || bp[i] === undefined)
      return ap[i] === undefined ? -1 : 1;
    if (ap[i] === bp[i]) continue;
    const an = /^\d+$/u.test(ap[i]),
      bn = /^\d+$/u.test(bp[i]);
    if (an && bn) return BigInt(ap[i]) > BigInt(bp[i]) ? 1 : -1;
    if (an !== bn) return an ? -1 : 1;
    return ap[i] > bp[i] ? 1 : -1;
  }
  return 0;
}
export function validateDescriptor(value, { channel, platform, arch }) {
  if (
    !value ||
    value.schema !== 1 ||
    !validVersion(value.version) ||
    versionChannel(value.version) !== channel ||
    value.channel !== channel ||
    value.platform !== platform ||
    value.arch !== arch ||
    !/^[A-Za-z0-9._-]+\.zip$/u.test(value.archive || "") ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    value.size > 2 * 1024 ** 3 ||
    typeof value.sha512 !== "string" ||
    Buffer.from(value.sha512, "base64").length !== 64 ||
    Buffer.from(value.sha512, "base64").toString("base64") !== value.sha512
  )
    throw new Error("Некорректное описание версии.");
  return {
    schema: 1,
    channel,
    platform,
    arch,
    version: value.version,
    archive: value.archive,
    size: value.size,
    sha512: value.sha512,
  };
}
export function createVersionSource(
  updateUrl,
  { platform = process.platform, arch = process.arch, fetcher = fetch } = {},
) {
  const configured = new URL(updateUrl);
  if (
    configured.protocol !== "https:" ||
    configured.username ||
    configured.password
  )
    throw new Error("Источник версий должен использовать HTTPS.");
  const github =
    configured.hostname === "github.com" &&
    /^\/([^/]+)\/([^/]+)\/releases(?:\/|$)/u.exec(configured.pathname);
  const trusted = new Set([
    configured.hostname,
    ...(github
      ? [
          "api.github.com",
          "release-assets.githubusercontent.com",
          "objects.githubusercontent.com",
        ]
      : []),
  ]);
  async function request(input, timeout = 120000) {
    let url = new URL(input);
    for (let i = 0; i < 6; i++) {
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !trusted.has(url.hostname)
      )
        throw new Error("Недоверенный адрес загрузки версии.");
      const response = await fetcher(url.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "User-Agent": "Cue-Version-Manager",
          Accept: "application/json, application/octet-stream",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Неполное перенаправление.");
        await response.body?.cancel();
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(
          response.status === 404
            ? "Для этой ветки пока нет сборки с быстрым переключением."
            : `Не удалось скачать версию (${response.status}).`,
        );
      }
      return response;
    }
    throw new Error("Слишком много перенаправлений.");
  }
  async function json(url, maximum = 65536) {
    const response = await request(url);
    let size = 0,
      text = "";
    const decoder = new TextDecoder();
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maximum) throw new Error("Слишком большое описание версии.");
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  }
  return {
    async describe(channel) {
      if (!["stable", "beta"].includes(channel))
        throw new Error("Неизвестная ветка.");
      const name = `${channel}-${platform}-${arch}.json`;
      let manifestUrl;
      if (github) {
        const [_, owner, repo] = github;
        const releases = await json(
          `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`,
          8 * 1024 * 1024,
        );
        if (!Array.isArray(releases))
          throw new Error("Некорректный список релизов.");
        const release = releases.find(
          (item) =>
            !item.draft &&
            item.prerelease === (channel === "beta") &&
            item.assets?.some((asset) => asset.name === name),
        );
        const asset = release?.assets.find((asset) => asset.name === name);
        if (!asset)
          throw new Error(
            "Для этой ветки пока нет сборки с быстрым переключением.",
          );
        const parsed = new URL(asset.browser_download_url);
        if (
          parsed.origin !== "https://github.com" ||
          !parsed.pathname.startsWith(`/${owner}/${repo}/releases/download/`) ||
          parsed.pathname.split("/").at(-1) !== name
        )
          throw new Error("Недоверенное описание версии.");
        manifestUrl = parsed.href;
      } else
        manifestUrl = new URL(name, configured.href.replace(/\/?$/u, "/")).href;
      const descriptor = validateDescriptor(await json(manifestUrl), {
        channel,
        platform,
        arch,
      });
      return {
        ...descriptor,
        url: new URL(descriptor.archive, manifestUrl).href,
      };
    },
    async download(descriptor, filename, progress = () => {}) {
      const response = await request(descriptor.url, 1800000),
        file = await open(filename, "wx", 0o600),
        hash = createHash("sha512");
      let received = 0;
      try {
        for await (const chunk of response.body) {
          received += chunk.length;
          if (received > descriptor.size)
            throw new Error("Размер сборки не совпадает.");
          hash.update(chunk);
          await file.writeFile(chunk);
          progress(Math.floor((received / descriptor.size) * 100));
        }
        if (
          received !== descriptor.size ||
          hash.digest("base64") !== descriptor.sha512
        )
          throw new Error("Контрольная сумма сборки не совпадает.");
      } finally {
        await file.close();
      }
    },
  };
}
