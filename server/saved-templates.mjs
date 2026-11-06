import { PollError } from './polls.mjs';
import { validateContestSetup } from './contest.mjs';

const check = (condition, message) => { if (!condition) throw new PollError(message); };
export const templateKinds = ['contest', 'wheel', 'poll-widget', 'chat-widget', 'contest-widget'];
export function validateTemplateData(kind, data, validators) {
  check(templateKinds.includes(kind), 'Выберите раздел шаблона.');
  check(data && typeof data === 'object' && !Array.isArray(data), 'Некорректные настройки шаблона.');
  if (kind === 'contest') {
    check(['keyword', 'active', 'number'].includes(data.mode), 'Выберите режим конкурса.');
    const setup = validateContestSetup(data);
    return { ...setup, numberMin: setup.numberMin ?? 1, numberMax: setup.numberMax ?? 100 };
  }
  if (kind === 'wheel') {
    check(['list', 'number', 'yes-no'].includes(data.mode), 'Выберите режим рулетки.');
    check(typeof data.withoutRepeats === 'boolean', 'Некорректное правило повторов.');
    const minimum = String(data.minimum ?? '1').trim(), maximum = String(data.maximum ?? '100').trim();
    check(minimum.length <= 12 && maximum.length <= 12, 'Некорректный диапазон рулетки.');
    if (data.mode === 'number') {
      const min = Number(minimum), max = Number(maximum);
      check(minimum && maximum && Number.isInteger(min) && Number.isInteger(max) && Math.abs(min) <= 1_000_000 && Math.abs(max) <= 1_000_000 && min <= max && max - min < 10000, 'В диапазоне рулетки должно быть до 10 000 целых чисел от −1 000 000 до 1 000 000.');
    }
    check(Array.isArray(data.options) && data.options.length <= 40, 'В рулетке может быть до 40 вариантов.');
    const labels = new Set();
    const options = data.options.map((option, index) => {
      check(typeof option?.label === 'string' && option.label.trim().length > 0 && option.label.trim().length <= 120, 'Заполните варианты рулетки (до 120 символов).');
      const label = option.label.trim(), key = label.toLocaleLowerCase('ru');
      check(!labels.has(key), 'Варианты рулетки должны различаться.'); labels.add(key);
      return { id: String(index + 1), label };
    });
    check(data.mode !== 'list' || options.length >= 2, 'Добавьте хотя бы два варианта рулетки.');
    return { mode: data.mode, minimum, maximum, options, withoutRepeats: data.withoutRepeats };
  }
  const settings = validators[kind](data);
  if (kind !== 'poll-widget') delete settings.enabled;
  return settings;
}
export function validateTemplate(input, validators, metadata = {}) {
  check(typeof input?.name === 'string' && input.name.trim().length > 0 && input.name.trim().length <= 50, 'Название шаблона должно содержать от 1 до 50 символов.');
  return { ...metadata, name: input.name.trim(), kind: input.kind, data: validateTemplateData(input.kind, input.data, validators), pinned: input.pinned === true };
}
export function validateTemplateLibrary(value, validators) {
  check(Array.isArray(value) && value.length <= 100, 'Можно сохранить не больше 100 шаблонов новых разделов.');
  const ids = new Set();
  return value.map(item => {
    check(typeof item?.id === 'string' && item.id.length > 0 && !ids.has(item.id), 'Повреждены идентификаторы шаблонов.');
    ids.add(item.id);
    return validateTemplate(item, validators, { id: item.id, createdAt: Number.isFinite(item.createdAt) ? item.createdAt : 0, updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : 0 });
  });
}
