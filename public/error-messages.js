export function presentError(value, context = '') {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  const text = raw.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/u, '').replace(/^Error:\s*/u, '').trim();
  if (/Invalid package|app\.asar|Сборка.*повреждена|SHA-?512|checksum|контрольн|распаков/iu.test(text)) return { title: 'Не удалось установить обновление', description: 'Скачайте сборку ещё раз. Если ошибка повторится, установите её с сайта Cue.' };
  if (/Client ID|тип Public|invalid_client/iu.test(text)) return { title: 'Не удалось подключить Twitch', description: 'Попробуйте ещё раз чуть позже. Если не поможет, отправьте журнал ошибок разработчику.' };
  if (/Twitch отклонил доступ|access token|unauthorized|invalid.*token/iu.test(text)) return { title: 'Нужно заново подключить Twitch', description: context === 'twitch' ? 'Нажмите «Подключить» и подтвердите вход в Twitch.' : 'Откройте настройки и подтвердите вход в аккаунт.' };
  if (/Нет связи|Failed to fetch|fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|network|timeout|timed out/iu.test(text)) return { title: 'Не удалось связаться с сервером', description: 'Проверьте интернет и попробуйте ещё раз.' };
  if (/ENOSPC|not enough space/iu.test(text)) return { title: 'Не хватает места на диске', description: 'Освободите немного места и повторите действие.' };
  if (/EACCES|EPERM|permission denied/iu.test(text)) return { title: 'Нет доступа к файлам приложения', description: 'Перезапустите Cue и попробуйте ещё раз. Если не поможет, отправьте журнал ошибок.' };
  const technical = /(?:Error|Exception|TypeError|ENOENT|ERR_[A-Z_]+|remote method|[A-Z]:\\|\/Users\/|\/home\/|file:\/\/|\n\s+at\s|node:internal|\.m?js:\d+:\d+)/u.test(text) || /\b(?:stack|client_id|http[s]?:\/\/)\b/u.test(text) || (/[A-Za-z]/u.test(text) && !/[А-Яа-яЁё]/u.test(text));
  if (technical || !text) return { title: context.includes('version') || context.includes('update') ? 'Не удалось обновить приложение' : 'Не удалось выполнить действие', description: 'Попробуйте ещё раз. Если ошибка повторится, отправьте журнал из настроек.' };
  return { title: text.slice(0, 240), description: '' };
}
