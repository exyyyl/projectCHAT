import test from 'node:test';
import assert from 'node:assert/strict';
import { createToastStore } from '../ui/panel/src/domain/toasts.ts';

function fixture() {
  let time = 0;
  let id = 0;
  const tasks = new Map();
  const store = createToastStore({
    schedule(callback, delay) {
      tasks.set(++id, { callback, at: time + delay });
      return id;
    },
    cancel(id) { tasks.delete(id); },
  });
  return { store, tasks, advance(ms) {
    time += ms;
    for (const [id, task] of [...tasks]) if (task.at <= time) {
      tasks.delete(id);
      task.callback();
    }
  } };
}

test('rapid repeated notifications share one item, increment its counter and restart expiry', () => {
  const f = fixture();
  f.store.show({ message: 'Добавьте слово.', tone: 'error', duration: 1000 });
  const id = f.store.snapshot()[0].id;
  f.advance(900);
  f.store.show({ message: 'Добавьте слово.', tone: 'error', duration: 1000 });
  f.store.show({ message: 'Добавьте слово.', tone: 'error', duration: 1000 });
  assert.deepEqual(f.store.snapshot().map(item => [item.id, item.count]), [[id, 3]]);
  assert.equal(f.tasks.size, 1);
  f.advance(900);
  assert.equal(f.store.snapshot().length, 1);
  f.advance(100);
  assert.equal(f.store.snapshot()[0].leaving, true);
  f.advance(450);
  assert.equal(f.store.snapshot().length, 0);
});

test('different notification tones stay separate; eviction and dismissal cancel timers', () => {
  const f = fixture();
  f.store.show('Сообщение');
  f.store.show({ message: 'Сообщение', tone: 'error' });
  assert.equal(f.store.snapshot().length, 2);
  f.store.show('Третье');
  f.store.show('Четвёртое');
  assert.equal(f.store.snapshot().length, 3);
  assert.equal(f.tasks.size, 3);
  f.store.dismiss(f.store.snapshot()[0].id);
  f.store.finishDismiss(f.store.snapshot()[0].id);
  assert.equal(f.tasks.size, 2);
  f.store.dispose();
  assert.equal(f.tasks.size, 0);
});

test('a repeated toast during exit reverses dismissal and ignores the old animation completion', () => {
  const f = fixture();
  f.store.show('Ошибка');
  const id = f.store.snapshot()[0].id;
  f.store.dismiss(id);
  assert.equal(f.store.snapshot()[0].leaving, true);
  f.store.show('Ошибка');
  f.store.finishDismiss(id);
  assert.equal(f.store.snapshot()[0].leaving, false);
  assert.equal(f.store.snapshot()[0].count, 2);
  assert.equal(f.tasks.size, 1);
});
