import test from 'node:test';
import assert from 'node:assert/strict';
import { trackPointerSwipe } from '../ui/panel/src/domain/swipe-tracker.ts';
function pointer(type, id = 7, x = 0) { const event = new Event(type); Object.assign(event, { pointerId: id, clientX: x, clientY: 0 }); return event; }
function fixture() {
  const target = new EventTarget(), moves = [], releases = [], cancellations = [];
  const stop = trackPointerSwipe(target, 7, { move: event => moves.push(event.clientX), release: event => releases.push(event.clientX), cancel: () => cancellations.push(true) });
  return { target, moves, releases, cancellations, stop };
}
test('a swipe continues after handle and row capture loss until its pointer is released', () => {
  const f = fixture();
  f.target.dispatchEvent(pointer('pointermove',7,30));
  f.target.dispatchEvent(pointer('lostpointercapture',7));
  f.target.dispatchEvent(pointer('pointermove',7,300));
  f.target.dispatchEvent(pointer('lostpointercapture',7));
  f.target.dispatchEvent(pointer('pointerup',7,320));
  f.target.dispatchEvent(pointer('pointerup',7,400));
  f.target.dispatchEvent(pointer('pointermove',7,500));
  assert.deepEqual(f.moves,[30,300]);
  assert.deepEqual(f.releases,[320]);
  assert.deepEqual(f.cancellations,[]);
});
test('unrelated pointer release and cancellation cannot interrupt the active gesture', () => {
  const f = fixture();
  for (const type of ['pointermove','pointerup','pointercancel']) f.target.dispatchEvent(pointer(type,8,100));
  f.target.dispatchEvent(pointer('pointerup',7,300));
  assert.deepEqual(f.releases,[300]);
  assert.deepEqual(f.moves,[]);
  assert.deepEqual(f.cancellations,[]);
});
test('real pointer cancellation or window blur aborts without release and removes listeners', () => {
  for (const type of ['pointercancel','blur']) {
    const f = fixture();
    f.target.dispatchEvent(pointer(type,7));
    f.target.dispatchEvent(pointer('pointerup',7,300));
    f.target.dispatchEvent(pointer('pointermove',7,500));
    assert.deepEqual(f.cancellations,[true]);
    assert.deepEqual(f.releases,[]);
    assert.deepEqual(f.moves,[]);
  }
});
test('unmount cleanup is idempotent and leaves no active callbacks', () => {
  const f=fixture(); f.stop(); f.stop();
  for (const type of ['pointermove','pointerup','pointercancel','blur']) f.target.dispatchEvent(pointer(type));
  assert.deepEqual([f.moves,f.releases,f.cancellations],[[],[],[]]);
});

test('a focused child blurring during pointerdown does not look like leaving the window', () => {
  const f = fixture();
  const event = new Event('blur');
  Object.defineProperty(event,'target',{value:new EventTarget()});
  f.target.dispatchEvent(event);
  f.target.dispatchEvent(pointer('pointerup',7,300));
  assert.deepEqual(f.cancellations,[]);
  assert.deepEqual(f.releases,[300]);
});
