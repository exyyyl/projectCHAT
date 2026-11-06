import test from 'node:test';
import assert from 'node:assert/strict';
import { profileMessageDays, viewerRoleLabels } from '../ui/panel/src/domain/chat-profile.ts';

test('viewer history groups local calendar days without changing message order or input', () => {
  const messages = [
    { id: 5, sentAt: new Date(2026,10,6,19,37).getTime() },
    { id: 4, sentAt: new Date(2026,10,6,0,1).getTime() },
    { id: 3, sentAt: new Date(2026,10,5,23,59).getTime() },
    { id: 2, sentAt: new Date(2026,10,5,12,0).getTime() },
    { id: 1, sentAt: new Date(2026,9,31,12,0).getTime() },
  ];
  const before = structuredClone(messages);
  const groups = profileMessageDays(messages);
  assert.deepEqual(groups.map(group=>group.messages.map(message=>message.id)), [[5,4],[3,2],[1]]);
  assert.deepEqual(groups.map(group=>new Date(group.day).getHours()), [0,0,0]);
  assert.deepEqual(messages,before);
  assert.deepEqual(profileMessageDays([]),[]);
});

test('viewer roles have readable Russian labels without dropping unknown roles', () => {
  assert.deepEqual(viewerRoleLabels(['viewer','moderator','subscriber','moderator','vip']),['Модератор','Подписчик','VIP']);
  assert.deepEqual(viewerRoleLabels(['viewer']),[]);
  assert.deepEqual(viewerRoleLabels(['broadcaster','custom-role']),['Стример','custom-role']);
});
