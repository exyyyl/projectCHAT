import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const code = stripTypeScriptTypes(await readFile(new URL('../ui/panel/src/domain/chat-moderation.ts', import.meta.url), 'utf8'));
const { swipeModeration } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('swipe duration grows monotonically through all steps on narrow and wide messages', () => {
  for (const width of [270, 390, 800]) {
    const choices = Array.from({ length: Math.ceil(width) + 1 }, (_, distance) => swipeModeration(distance, width)).filter(value => value.ready);
    assert.deepEqual([...new Set(choices.map(value => value.duration ?? Infinity))], [60, 300, 600, 3600, 86400, 604800, 1209600, Infinity]);
    assert.equal(choices.at(-1).action, 'ban');
    assert.ok(choices.findIndex(value => value.action === 'ban') > 80);
    assert.equal(swipeModeration(20, width).ready, false);
    assert.equal(swipeModeration(-20, width).ready, false);
    assert.equal(swipeModeration(-120, width).action, 'delete');
    assert.equal(swipeModeration(-120, width).ready, true);
    assert.equal(swipeModeration(0, width).ready, false);
    assert.equal(swipeModeration(90, width).action, 'timeout');
  }
});

const { releaseModerationSwipe, moderationRejection } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('own-message timeout and ban attempts explain refusal instead of disappearing', () => {
  for (const distance of [40, 130, 500]) {
    const result = releaseModerationSwipe(distance, 600, {canDelete:true,canTimeout:false,isSelf:true});
    assert.equal(result.rejection, 'Себя отстранить нельзя');
    assert.equal(result.hint, 'Себя отстранить нельзя');
  }
  assert.equal(moderationRejection('ban', {canDelete:true,canTimeout:true,isSelf:true}), 'Себя отстранить нельзя');
  assert.equal(releaseModerationSwipe(-130,600,{canDelete:true,canTimeout:false,isSelf:true}).hint,null);
});

test('release has an explicit outcome for incomplete swipes, missing permissions and valid choices', () => {
  const allowed = {canDelete:true,canTimeout:true,isSelf:false};
  for (const distance of [-50,50]) {
    const result = releaseModerationSwipe(distance,600,allowed);
    assert.equal(result.choice.ready,false);
    assert.match(result.hint,/Потяните дальше/);
  }
  const ready = releaseModerationSwipe(300,600,allowed);
  assert.equal(ready.hint,null);
  assert.equal(ready.choice.duration,3600);
  assert.match(releaseModerationSwipe(300,600,{...allowed,canTimeout:false}).hint,/Нет прав/);
});
