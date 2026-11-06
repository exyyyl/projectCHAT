import { nativeFs } from "./native-fs.mjs";
const {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} = nativeFs.promises;
import { basename, isAbsolute, join, resolve } from "node:path";
import {
  extractRuntime,
  inside,
  runtimeExecutable,
  verifyRuntime,
} from "./archive.mjs";
import {
  compareVersions,
  staleBetaCode,
  validVersion,
  versionChannel,
} from "./source.mjs";

const channels = ["stable", "beta"];
const channel = (value) => {
  if (!channels.includes(value))
    throw new Error("Неизвестная ветка приложения.");
  return value;
};
export function versionDataDirectory(userData, branch) {
  return join(userData, branch === "beta" ? "app-data-beta" : "app-data");
}
export async function seedBetaData(userData) {
  const destination = versionDataDirectory(userData, "beta");
  try {
    await lstat(destination);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const staging = await mkdtemp(join(userData, ".beta-data-"));
  try {
    try {
      await cp(versionDataDirectory(userData, "stable"), staging, {
        recursive: true,
        errorOnExist: false,
        filter: (path) =>
          !path.endsWith("twitch.json") && !path.endsWith("-shm"),
      });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await rename(staging, destination);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export function createVersionManager({
  root,
  currentVersion,
  executable,
  platform = process.platform,
  arch = process.arch,
  isPackaged,
  source,
  emit = () => {},
  extract = extractRuntime,
  verify = verifyRuntime,
}) {
  const currentChannel = versionChannel(currentVersion);
  const supported = isPackaged && ["win32", "darwin"].includes(platform);
  let file = join(root, "versions.json");
  let registry = { schema: 1, active: null, installed: {}, pending: null },
    busy = false;
  let state = {
    supported,
    currentChannel,
    currentVersion,
    phase: !isPackaged ? "development" : !supported ? "unsupported" : "idle",
    target: null,
    progress: 0,
    message: "",
    available: {},
    errors: {},
    notices: {},
  };
  const currentPointer = () =>
    inside(join(root, "slots"), executable)
      ? { kind: "bundle", channel: currentChannel, version: currentVersion }
      : {
          kind: "installed",
          channel: currentChannel,
          version: currentVersion,
          executable,
        };
  let currentRecord = currentPointer();
  const same = (a, b) =>
    a?.kind === b?.kind &&
    a?.channel === b?.channel &&
    a?.version === b?.version &&
    (a?.kind !== "installed" ||
      resolve(a.executable) === resolve(b.executable));
  function normalize(record) {
    if (
      !record ||
      !channels.includes(record.channel) ||
      !validVersion(record.version) ||
      versionChannel(record.version) !== record.channel
    )
      return null;
    if (record.kind === "bundle")
      return {
        kind: "bundle",
        channel: record.channel,
        version: record.version,
      };
    if (
      record.kind === "installed" &&
      typeof record.executable === "string" &&
      isAbsolute(record.executable) &&
      basename(record.executable) ===
        (platform === "darwin" ? "Cue" : "Cue.exe")
    )
      return {
        kind: "installed",
        channel: record.channel,
        version: record.version,
        executable: record.executable,
      };
    return null;
  }
  const directory = (record) =>
    join(root, "slots", `${record.version}-${platform}-${arch}`);
  async function resolveRecord(record) {
    record = normalize(record);
    if (!record) throw new Error("Версия не найдена.");
    if (record.kind === "installed") {
      const stat = await lstat(record.executable);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error("Установленная версия недоступна.");
      return record.executable;
    }
    return verify(directory(record), { ...record, platform, arch });
  }
  async function save() {
    await mkdir(root, { recursive: true });
    await writeFile(file + ".tmp", JSON.stringify(registry, null, 2), {
      mode: 0o600,
    });
    await rename(file + ".tmp", file);
  }
  const snapshot = () => ({
    ...structuredClone(state),
    slots: Object.fromEntries(
      channels.map((key) => [
        key,
        {
          installedVersion: registry.installed[key]?.version || null,
          availableVersion: state.available[key]?.version || null,
          updateAvailable:
            !!state.available[key] &&
            (!registry.installed[key] ||
              compareVersions(
                state.available[key].version,
                registry.installed[key].version,
              ) > 0),
          current: registry.installed[key]
            ? same(registry.installed[key], currentRecord)
            : false,
        },
      ]),
    ),
  });
  const publish = (patch) => {
    state = { ...state, ...patch };
    const value = snapshot();
    emit(value);
    return value;
  };
  async function operation(phase, target, fn) {
    if (!supported)
      throw new Error(
        "Переключение версий доступно в установленном приложении Windows или macOS.",
      );
    if (busy) throw new Error("Дождитесь завершения текущей операции.");
    busy = true;
    publish({ phase, target, message: "", progress: 0 });
    try {
      return await fn();
    } catch (error) {
      publish({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подготовить версию.",
      });
      throw error;
    } finally {
      busy = false;
    }
  }
  return {
    snapshot,
    async initialize() {
      if (!supported) return null;
      await mkdir(root, { recursive: true });
      root = await realpath(root);
      executable = await realpath(executable);
      file = join(root, "versions.json");
      currentRecord = currentPointer();
      const canonical = async (value) => {
        const record = normalize(value);
        if (record?.kind === "installed")
          record.executable = await realpath(record.executable);
        return record;
      };
      try {
        const saved = JSON.parse(await readFile(file, "utf8"));
        if (saved.schema === 1) {
          registry.active = await canonical(saved.active).catch(() => null);
          for (const key of channels) {
            const value = await canonical(saved.installed?.[key]).catch(
              () => null,
            );
            if (value?.channel === key) registry.installed[key] = value;
          }
          const previous = await canonical(saved.pending?.previous).catch(
            () => null,
          );
          if (previous)
            registry.pending = {
              previous,
              attempts: saved.pending.attempts === 1 ? 1 : 0,
            };
        }
      } catch (error) {
        if (error.code !== "ENOENT")
          state.message = "Список локальных версий восстановлен.";
      }
      const refresh = (record) =>
        record?.kind === "installed" &&
        resolve(record.executable) === resolve(executable)
          ? currentRecord
          : record;
      registry.active = refresh(registry.active);
      if (registry.pending)
        registry.pending.previous = refresh(registry.pending.previous);
      for (const key of channels) {
        if (registry.installed[key]) {
          registry.installed[key] = refresh(registry.installed[key]);
          try {
            await resolveRecord(registry.installed[key]);
          } catch {
            delete registry.installed[key];
          }
        }
      }
      if (!registry.installed[currentChannel])
        registry.installed[currentChannel] = currentRecord;
      if (!registry.active) registry.active = currentRecord;
      if (registry.pending?.attempts === 1) {
        registry.active = registry.pending.previous;
        registry.pending = null;
        state.message =
          "Предыдущая версия не завершила запуск. Выполнен возврат.";
      }
      let target;
      try {
        target = await resolveRecord(registry.active);
      } catch {
        registry.active = currentRecord;
        registry.pending = null;
        target = executable;
        state.message = "Выбранная версия недоступна. Запущена текущая копия.";
      }
      if (resolve(target) !== resolve(executable)) {
        registry.pending ??= { previous: currentRecord, attempts: 0 };
        await save();
        return target;
      }
      if (registry.pending) registry.pending.attempts = 1;
      await save();
      return null;
    },
    async markHealthy() {
      if (!supported) return;
      if (registry.pending) {
        registry.pending = null;
        await save();
      }
      publish({ phase: "idle" });
    },
    async check() {
      return operation("checking", null, async () => {
        if (!source) throw new Error("Источник версий ещё не настроен.");
        const available = {},
          errors = {},
          notices = {};
        for (const key of channels) {
          try {
            available[key] = await source.describe(key);
          } catch (error) {
            // No newer beta is an expected state, not a failure.
            if (error.code === staleBetaCode) notices[key] = error.message;
            else errors[key] = error.message;
          }
        }
        publish({ phase: "idle", available, errors, notices, target: null });
        return snapshot();
      });
    },
    async download(branch) {
      channel(branch);
      return operation("downloading", branch, async () => {
        if (!source) throw new Error("Источник версий ещё не настроен.");
        const descriptor = await source.describe(branch);
        // Descriptor belongs to the trusted source, never the renderer.
        if (
          !validVersion(descriptor.version) ||
          descriptor.channel !== branch ||
          descriptor.platform !== platform ||
          descriptor.arch !== arch
        )
          throw new Error("Сборка не подходит для этого компьютера.");
        const record = {
          kind: "bundle",
          channel: branch,
          version: descriptor.version,
        };
        const destination = directory(record);
        try {
          await resolveRecord(record);
          registry.installed[branch] = record;
          await save();
          return publish({
            phase: "idle",
            target: null,
            progress: 100,
            available: { ...state.available, [branch]: descriptor },
          });
        } catch {
          /* No verified local bundle yet. */
        }
        await mkdir(join(root, "slots"), { recursive: true });
        const staging = await mkdtemp(join(root, ".download-"));
        try {
          const archive = join(staging, "runtime.zip"),
            unpacked = join(staging, "app");
          await mkdir(unpacked);
          await source.download(descriptor, archive, (value) => {
            const progress = Math.min(99, value);
            if (progress !== state.progress) publish({ progress });
          });
          publish({ phase: "unpacking" });
          await extract(archive, unpacked, { platform });
          await verify(unpacked, descriptor);
          // An interrupted/corrupt inactive bundle can be replaced; never overwrite the running executable.
          if (inside(destination, executable))
            throw new Error("Нельзя заменить запущенную сборку.");
          await rm(destination, { recursive: true, force: true });
          await rename(unpacked, destination);
          registry.installed[branch] = record;
          await save();
          return publish({
            phase: "idle",
            target: null,
            progress: 100,
            available: { ...state.available, [branch]: descriptor },
          });
        } finally {
          await rm(staging, { recursive: true, force: true });
        }
      });
    },
    async activate(branch) {
      channel(branch);
      return operation("restarting", branch, async () => {
        const record = registry.installed[branch];
        if (!record) throw new Error("Сначала скачайте выбранную версию.");
        const target = await resolveRecord(record);
        if (same(record, currentRecord)) {
          publish({ phase: "idle", target: null });
          return null;
        }
        registry.pending = { previous: currentRecord, attempts: 0 };
        registry.active = record;
        await save();
        return target;
      });
    },
  };
}
