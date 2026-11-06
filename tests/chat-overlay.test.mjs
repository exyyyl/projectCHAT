import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chatOverlayDefaults, visibleChatMessages, resolveChatOverlay, chatOverlayMotion } from '../public/chat-overlay-model.js';
import { initialState, applyCommand, validateStoredState, validateChatOverlay } from '../server/polls.mjs';
import { createStore } from '../server/store.mjs';

test('chat overlay settings migrate, persist, and import without importing live chat', async t => {
  const legacy = initialState(); delete legacy.chatOverlay;
  assert.deepEqual(validateStoredState(legacy).chatOverlay, chatOverlayDefaults);
  const directory = await mkdtemp(join(tmpdir(), 'cue-chat-overlay-'));
  const filename = join(directory, 'state.json');
  const store = await createStore(filename);
  await store.command({ type: 'chat-overlay-update', settings: { style: 'bubble', hideAfter: 45, animationDuration: 600, emoteProvider: '7tv' } });
  assert.equal(store.snapshot().chatOverlay.hideAfter, 45);
  assert.equal(store.snapshot().chatOverlay.fontSize, 24);
  const restored = await createStore(filename);
  assert.equal(restored.snapshot().chatOverlay.style, 'bubble');
  const current = restored.snapshot();
  await restored.command({ type: 'settings-import', draftRevision: current.draftRevision, settings: { schema: 1, app: 'Cue', draft: current.draft, presets: [], widget: current.widget, chatOverlay: current.chatOverlay } });
  assert.equal(restored.snapshot().chatOverlay.emoteProvider, '7tv');
  assert.doesNotMatch(await readFile(filename, 'utf8'), /viewerName|sentAt|accessToken/);
  await store.drain(); await restored.drain();
});

test('chat overlay validates bounded settings and never accepts CSS or HTML injection', () => {
  for (const settings of [{ fontSize: 200 }, { maxMessages: 0 }, { hideAfter: -1 }, { animationDuration: 50000 }, { textColor: 'url(https://evil.test)' }, { font: '<script>' }, { animation: 'javascript:' }, { opacity: NaN }, { enabled: 'true' }, { unexpected: 'x' }]) assert.throws(() => validateChatOverlay(settings));
  assert.throws(() => applyCommand(initialState(), { type: 'chat-overlay-update', settings: [] }));
  const zero = validateChatOverlay({ opacity: 0, radius: 0, hideAfter: 0, animation: 'none' });
  assert.equal(zero.opacity, 0); assert.equal(zero.radius, 0); assert.equal(zero.hideAfter, 0);
  assert.equal(zero.animation, 'slide');
});

test('new message animations survive updates, stored state and backup imports; legacy none migrates', () => {
  for (const animation of ['scale', 'side', 'turn', 'reveal', 'bounce']) {
    const state = applyCommand(initialState(), { type: 'chat-overlay-update', settings: { animation } }).state;
    assert.equal(validateStoredState(state).chatOverlay.animation, animation);
    const imported = applyCommand(initialState(), { type: 'settings-import', draftRevision: 0, settings: { schema: 1, app: 'Cue', draft: state.draft, presets: [], widget: state.widget, chatOverlay: state.chatOverlay } }).state;
    assert.equal(imported.chatOverlay.animation, animation);
  }
  const legacy = initialState();
  legacy.chatOverlay.animation = 'none';
  assert.equal(validateStoredState(legacy).chatOverlay.animation, 'slide');
  assert.equal(resolveChatOverlay({ animation: 'none' }).animation, 'slide');
});

test('message motion follows alignment, settles fully and removes movement for reduced motion', () => {
  const still = { x: 0, y: 0, scale: 1, rotation: 0, clipPath: 'inset(0% 0% 0% 0%)' };
  for (const animation of ['slide', 'fade', 'scale', 'side', 'turn', 'reveal', 'bounce']) {
    const settings = { ...chatOverlayDefaults, animation, animationDuration: 600 };
    const motion = chatOverlayMotion(settings);
    assert.deepEqual(motion.settled, still);
    assert.equal(motion.duration, 0.6);
    const reduced = chatOverlayMotion(settings, true);
    assert.deepEqual(reduced.enter, still);
    assert.deepEqual(reduced.exit, still);
    assert.equal(reduced.duration, 0);
  }
  assert.ok(chatOverlayMotion({ animation: 'side', alignment: 'left' }).enter.x < 0);
  assert.ok(chatOverlayMotion({ animation: 'side', alignment: 'right' }).enter.x > 0);
  assert.equal(chatOverlayMotion({ animation: 'side', alignment: 'right' }).origin, '100% 100%');
  assert.ok(chatOverlayMotion({ animation: 'scale' }).enter.scale < 1);
  assert.equal(chatOverlayMotion({ animation: 'scale' }).ease, 'back.out(1.7)');
  assert.ok(chatOverlayMotion({ animation: 'turn', alignment: 'left' }).enter.rotation < 0);
  assert.ok(chatOverlayMotion({ animation: 'turn', alignment: 'right' }).enter.rotation > 0);
  assert.notEqual(chatOverlayMotion({ animation: 'reveal' }).enter.clipPath, still.clipPath);
  assert.equal(chatOverlayMotion({ animation: 'bounce' }).ease, 'bounce.out');
  assert.deepEqual(chatOverlayMotion({ animation: 'fade' }).enter, still);
});

test('overlay hides old messages, bounds floods, excludes activities and supports permanent display', () => {
  const now = 1_000_000;
  const messages = Array.from({ length: 200 }, (_, id) => ({ id, sentAt: now - (199 - id) * 1000, kind: 'message' }));
  messages.push({ id: 200, sentAt: now, kind: 'activity' });
  const visible = visibleChatMessages(messages, { ...chatOverlayDefaults, maxMessages: 7, hideAfter: 20 }, now);
  assert.deepEqual(visible.map(item => item.id), [193, 194, 195, 196, 197, 198, 199]);
  assert.equal(visibleChatMessages(messages, { ...chatOverlayDefaults, hideAfter: 20 }, now + 21_000).length, 0);
  assert.equal(visibleChatMessages(messages, { ...chatOverlayDefaults, hideAfter: 0 }, now + 1_000_000).length, 7);
});

test('ready-made chat looks are valid and preserve output, timing and emote preferences', async () => {
  const { chatOverlayPresets } = await import('../public/chat-overlay-model.js');
  let state = initialState();
  state = applyCommand(state, { type: 'chat-overlay-update', settings: { enabled: false, hideAfter: 57, maxMessages: 12, emoteProvider: '7tv', animation: 'fade', showBadges: false, alignment: 'right' } }).state;
  for (const preset of chatOverlayPresets) {
    const next = applyCommand(state, { type: 'chat-overlay-update', settings: preset.settings }).state.chatOverlay;
    assert.equal(next.enabled, false, preset.id);
    assert.equal(next.hideAfter, 57, preset.id);
    assert.equal(next.maxMessages, 12, preset.id);
    assert.equal(next.emoteProvider, '7tv', preset.id);
    assert.equal(next.animation, 'fade', preset.id);
    assert.equal(next.showBadges, false, preset.id);
    assert.equal(next.alignment, 'right', preset.id);
    assert.equal(next.style, preset.settings.style);
  }
});

test('look selection survives manual size changes and shared preview styles preserve transparent backgrounds', async () => {
  const { chatOverlayPresets, matchingChatOverlayPreset, chatOverlayStyle } = await import('../public/chat-overlay-model.js');
  for (const preset of chatOverlayPresets) {
    const settings = { ...chatOverlayDefaults, ...preset.settings };
    assert.equal(matchingChatOverlayPreset(settings)?.id, preset.id);
    assert.equal(matchingChatOverlayPreset({ ...settings, fontSize: 29 })?.id, preset.id);
  }
  assert.equal(matchingChatOverlayPreset({ ...chatOverlayDefaults, backgroundColor: '#123456' }), null);
  assert.equal(chatOverlayStyle({ ...chatOverlayDefaults, opacity: 0 })['--chat-background'], '#14141600');
});

test('local preview samples cover maximum-width edge cases with valid native emote spans', async () => {
  const { createChatPreviewMessage, chatPreviewSamples } = await import('../ui/panel/src/domain/chat-preview.ts');
  for (const [kind] of chatPreviewSamples) {
    const message = createChatPreviewMessage(1, kind, 1234);
    assert.equal(message.sentAt, 1234);
    assert.equal(message.kind, 'message');
    assert.match(message.viewerId, /^demo:/);
    assert.ok(message.text.length <= 500, kind);
    for (const span of message.emotes) {
      assert.equal(message.text.slice(span.start, span.end), 'Kappa');
      assert.equal(span.id, '25');
    }
  }
  assert.equal(createChatPreviewMessage(1, 'word').text.length, 500);
  assert.doesNotMatch(createChatPreviewMessage(1, 'word').text, /\s/);
  assert.ok(createChatPreviewMessage(1, 'long').text.length > 300);
  assert.equal(createChatPreviewMessage(1, 'long').viewerName, 'peachysoul');
  assert.equal(createChatPreviewMessage(1, 'emotes').emotes.length, 40);
});

test('moderated messages disappear from OBS instead of resurfacing from the archive', () => {
  const messages = [{ id: 1, sentAt: 1000 }, { id: 2, sentAt: 2000, deleted: true }];
  assert.deepEqual(visibleChatMessages(messages, { ...chatOverlayDefaults, hideAfter: 0 }, 3000).map(item => item.id), [1]);
});
