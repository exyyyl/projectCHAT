import { watch as watchFiles } from 'node:fs';

const sourcePattern = /\.(?:cjs|js|json|mjs)$/u;

export const shouldReloadDesktop = filename =>
  typeof filename === 'string' && sourcePattern.test(filename);

export function watchDesktopSources({
  directories,
  onReload,
  watch = watchFiles,
  later = setTimeout,
  cancel = clearTimeout,
  delay = 140,
}) {
  let timer = null;
  let closed = false;
  const watchers = directories.map(directory => watch(directory, { recursive: true }, (_event, filename) => {
    const changed = filename?.toString();
    if (closed || !shouldReloadDesktop(changed)) return;
    cancel(timer);
    timer = later(() => {
      timer = null;
      if (!closed) onReload(changed);
    }, delay);
  }));

  return () => {
    closed = true;
    cancel(timer);
    for (const watcher of watchers) watcher.close();
  };
}
