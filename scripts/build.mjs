import { cp, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const panel = spawnSync('npm', ['run', 'build:panel'], { stdio: 'inherit' });
if (panel.status !== 0) process.exit(panel.status || 1);
const check = spawnSync(process.execPath, ['scripts/check.mjs'], { stdio: 'inherit' });
if (check.status !== 0) process.exit(check.status || 1);
await mkdir('dist', { recursive: true });
for (const path of ['server', 'public', 'package.json', 'README.md', 'Start-Windows.cmd', 'Start-macOS.command']) {
  await cp(path, `dist/${path}`, { recursive: true });
}
console.log('Готово: dist/ — переносимая папка исходной версии (нужен Node.js 22+). Данные в сборку не включены.');
