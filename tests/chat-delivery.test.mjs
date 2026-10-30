import test from 'node:test';
import assert from 'node:assert/strict';
import { failedChatMessage, mergeChatFeed, outgoingChatMessage } from '../ui/panel/src/domain/chat-delivery.ts';

const author = { userId: '123', displayName: 'Streamer', login: 'streamer' };
const styled = { id: 1, viewerId: 'twitch:123', viewerName: 'Streamer', viewerLogin: 'streamer', kind: 'message', activityType: '', roles: ['moderator'], badges: [{ setId: 'broadcaster', id: '1' }, { setId: 'subscriber', id: '6' }], nameColor: '#9146FF', cheerBits: 0, text: 'Earlier', sentAt: 1000 };
const pending = (text = 'Hello', key = 'local-1', at = 2000) => outgoingChatMessage([styled], author, text, key, at);
const delivered = { ...styled, id: 2, text: 'Hello', sentAt: 2200 };

test('an optimistic row starts with the current author badges and color, and acknowledgement keeps its React key', () => {
  const local = pending();
  assert.deepEqual(local.badges, styled.badges);
  assert.equal(local.nameColor, styled.nameColor);
  assert.equal(local.delivery, 'sending');
  const result = mergeChatFeed([styled, local], [{ ...delivered, badges: [], nameColor: '' }], { confirmedKey: local.localKey });
  assert.equal(result.length, 2);
  assert.equal(result[1].localKey, local.localKey);
  assert.equal(result[1].delivery, undefined);
  assert.deepEqual(result[1].badges, styled.badges);
  assert.equal(result[1].nameColor, styled.nameColor);
});

test('EventSub before HTTP and duplicate notifications do not duplicate a pending row or consume the next identical send', () => {
  const first = pending(); const second = pending('Hello', 'local-2', 2100);
  let feed = mergeChatFeed([styled, first, second], [delivered], { echo: true });
  assert.equal(feed.length, 3);
  assert.equal(feed[1].localKey, 'local-1');
  assert.equal(feed[2].delivery, 'sending');
  feed = mergeChatFeed(feed, [delivered], { echo: true });
  assert.equal(feed[2].delivery, 'sending');
  feed = mergeChatFeed(feed, [delivered], { confirmedKey: 'local-1' });
  assert.equal(feed.length, 3);
  feed = mergeChatFeed(feed, [{ ...delivered, id: 3 }], { confirmedKey: 'local-2' });
  assert.deepEqual(feed.map(item => item.localKey), [undefined, 'local-1', 'local-2']);
  assert.equal(feed.every(item => !item.delivery), true);
});

test('a history refresh does not mistake an earlier identical message for a new send', () => {
  const feed = mergeChatFeed([pending('Earlier')], [styled]);
  assert.equal(feed.length, 2);
  assert.equal(feed[1].delivery, 'sending');
});

test('a failed send keeps its body and styling, and a late confirmation resolves failure without an automatic resend', () => {
  let feed = failedChatMessage([pending()], 'local-1', 'No connection');
  assert.equal(feed[0].delivery, 'failed');
  assert.equal(feed[0].text, 'Hello');
  assert.deepEqual(feed[0].badges, styled.badges);
  feed = mergeChatFeed(feed, [delivered], { echo: true });
  assert.equal(feed[0].delivery, undefined);
  assert.equal(feed[0].deliveryError, undefined);
  assert.deepEqual(failedChatMessage(feed, 'local-1', 'HTTP timed out'), feed);
});

test('moderation and later enrichment retain the original deleted text and local identity', () => {
  let feed = mergeChatFeed([pending()], [delivered], { confirmedKey: 'local-1' });
  feed = mergeChatFeed(feed, [{ ...delivered, deleted: true }]);
  feed = mergeChatFeed(feed, [{ ...delivered, badges: [], nameColor: '' }]);
  assert.equal(feed[0].deleted, true);
  assert.equal(feed[0].text, 'Hello');
  assert.equal(feed[0].localKey, 'local-1');
  assert.deepEqual(feed[0].badges, styled.badges);
});
