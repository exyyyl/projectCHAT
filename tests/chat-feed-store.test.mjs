import test from "node:test";
import assert from "node:assert/strict";
import { createChatFeedStore } from "../ui/panel/src/domain/chat-feed-store.ts";
import {
  outgoingChatMessage,
  failedChatMessage,
  discardFailedChatMessage,
  mergeChatFeed,
} from "../ui/panel/src/domain/chat-delivery.ts";
const author = { userId: "123", displayName: "exyyyl", login: "exyyyl" };
const message = () => outgoingChatMessage([], author, "Keep me", "key-1", 1000);
const memory = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("outbox survives remount and restart, isolates accounts and never resends automatically", () => {
  const storage = memory(),
    store = createChatFeedStore(storage),
    channel = store.forChannel("123");
  channel.update([message()]);
  channel.update((items) => failedChatMessage(items, "key-1", "Offline"));
  assert.equal(store.forChannel("123").read().messages[0].text, "Keep me");
  const reopened = createChatFeedStore(storage);
  assert.equal(
    reopened.forChannel("123").read().messages[0].delivery,
    "failed",
  );
  assert.equal(
    reopened.forChannel("123").read().messages[0].deliveryError,
    "Offline",
  );
  assert.deepEqual(reopened.forChannel("456").read().messages, []);
  const interruptedStorage = memory();
  createChatFeedStore(interruptedStorage).forChannel("123").update([message()]);
  const interrupted = createChatFeedStore(interruptedStorage)
    .forChannel("123")
    .read().messages[0];
  assert.equal(interrupted.delivery, "failed");
  assert.match(interrupted.deliveryError, /не подтверждена/);
});

test("an acknowledgement after unmount updates the durable outbox and discard stays removed", () => {
  const storage = memory(),
    store = createChatFeedStore(storage),
    channel = store.forChannel("123");
  let notified = 0;
  const off = channel.subscribe(() => notified++);
  channel.update([message()]);
  off();
  const delivered = {
    ...message(),
    id: 77,
    delivery: undefined,
    localKey: undefined,
  };
  channel.update((items) =>
    mergeChatFeed(items, [delivered], { confirmedKey: "key-1" }),
  );
  assert.equal(notified, 1);
  assert.equal(channel.read().messages[0].delivery, undefined);
  assert.deepEqual(
    createChatFeedStore(storage).forChannel("123").read().messages,
    [],
  );
  channel.update(failedChatMessage([message()], "key-1", "Offline"));
  channel.update((items) => discardFailedChatMessage(items, "key-1"));
  assert.deepEqual(
    createChatFeedStore(storage).forChannel("123").read().messages,
    [],
  );
});

test("confirmed history is not serialized; unavailable storage keeps session data and reports failure", () => {
  let writes = 0;
  const store = createChatFeedStore({
    getItem: () => null,
    removeItem: () => {},
    setItem: () => {
      writes++;
      throw new Error("Quota");
    },
  });
  const channel = store.forChannel("123");
  channel.update([message()]);
  channel.update((items) => [
    ...items,
    { ...message(), id: 9, delivery: undefined, localKey: undefined },
  ]);
  assert.equal(writes, 1);
  assert.equal(channel.read().storageError, true);
  assert.equal(store.forChannel("123").read().messages.length, 2);
  const storage = memory();
  storage.setItem(
    "cue-chat-outbox:123",
    JSON.stringify({
      schema: 1,
      items: [{ ...message(), viewerId: "twitch:456" }, { text: "invalid" }],
    }),
  );
  const restored = createChatFeedStore(storage)
    .forChannel("123")
    .read().messages;
  assert.equal(restored.length, 1);
  assert.equal(restored[0].viewerId, "twitch:123");
});
