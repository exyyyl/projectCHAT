import test from 'node:test';
import assert from 'node:assert/strict';
import { availableDecisions, chooseDecision, decisionOptions, recordDecision, restoreDecisionState, numberRangeError } from '../ui/panel/src/domain/decision-wheel.ts';

const fixture = () => ({ options: [{ id: 'a', label: 'Minecraft' }, { id: 'b', label: 'Valorant' }, { id: 'c', label: 'Hollow Knight' }], excluded: [], history: [], withoutRepeats: true });

test('wheel ignores blank and duplicate options and draws only available choices', () => {
  const state = fixture();
  state.options.push({id:'d',label:' minecraft '}, {id:'e',label:' '});
  assert.equal(decisionOptions(state).length, 3);
  const winner = chooseDecision(state, () => 1);
  assert.equal(winner.id, 'b');
  const next = recordDecision(state, winner);
  assert.deepEqual(availableDecisions(next).map(option => option.id), ['a','c']);
  assert.equal(chooseDecision(next, () => 1).id, 'c');
  assert.deepEqual(next.history, ['Valorant']);
  assert.equal(chooseDecision({...next, excluded:['a','b','c']}), null);
  assert.equal(availableDecisions({...next, withoutRepeats:false}).length, 3);
});

test('uniform random draw rejects the biased Uint32 tail', () => {
  const words = [0xffffffff, 2];
  assert.equal(chooseDecision(fixture(), () => words.shift()).id, 'c');
  assert.equal(words.length, 0);
});

test('number mode includes both bounds, validates range and excludes selected numbers', () => {
  const state = {...fixture(), mode:'number', minimum:'-2', maximum:'2'};
  assert.deepEqual(decisionOptions(state).map(option => option.label), ['-2','-1','0','1','2']);
  const selected = chooseDecision(state, () => 2);
  assert.equal(selected.label, '0');
  assert.equal(availableDecisions(recordDecision(state,selected)).length, 4);
  assert.ok(numberRangeError('', '2'));
  assert.ok(numberRangeError('3', '2'));
  assert.ok(numberRangeError('1.5', '2'));
  assert.ok(numberRangeError('0', '10000'));
  assert.ok(numberRangeError('-1000001', '2'));
  assert.equal(decisionOptions({...state, minimum:'3',maximum:'2'}).length, 0);
});

test('yes/no mode works independently of list options and remembers its exclusions', () => {
  const state = {...fixture(), mode:'yes-no'};
  assert.deepEqual(decisionOptions(state).map(option => option.label), ['Да','Нет']);
  const next = recordDecision(state, chooseDecision(state, () => 0));
  assert.equal(chooseDecision(next, () => 0).label, 'Нет');
  assert.deepEqual(restoreDecisionState(next).excluded, ['answer:yes']);
});

test('saved wheel restores valid options, exclusions and history safely', () => {
  assert.deepEqual(restoreDecisionState(null).options, []);
  const state = restoreDecisionState({options:[{id:'a',label:'One'},{id:'a',label:'Duplicate'},null],excluded:['a','missing'],history:['One',5]});
  assert.deepEqual(state.options, [{id:'a',label:'One'}]);
  assert.deepEqual(state.excluded, ['a']);
  assert.deepEqual(state.history, ['One']);
});
