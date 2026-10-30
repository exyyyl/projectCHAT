import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contestOverlayDefaults, publicContest, contestPresentation } from '../public/contest-overlay-model.js';
import { initialState, applyCommand, validateStoredState, validateContestOverlay } from '../server/polls.mjs';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';

test('contest appearance migrates, persists and rejects untrusted CSS and unbounded input', async () => {
  const old=initialState();delete old.contestOverlay;
  assert.deepEqual(validateStoredState(old).contestOverlay,contestOverlayDefaults);
  for (const invalid of [{width:100},{fontSize:200},{opacity:101},{radius:-1},{enabled:'yes'},{accentColor:'url(javascript:1)'},{textColor:'red'},{extra:'x'},[]]) assert.throws(()=>validateContestOverlay(invalid));
  const filename=join(await mkdtemp(join(tmpdir(),'cue-contest-look-')),'state.json');
  const store=await createStore(filename);
  await store.command({type:'contest-overlay-update',settings:{enabled:false,opacity:0,radius:0,width:700}});
  const restored=await createStore(filename);
  assert.equal(restored.snapshot().contestOverlay.width,700);
  assert.equal(restored.snapshot().contestOverlay.enabled,false);
  assert.equal(restored.snapshot().contestOverlay.opacity,0);
  const state=initialState();
  const imported=applyCommand(state,{type:'settings-import',draftRevision:0,settings:{schema:1,app:'Cue',draft:state.draft,presets:[],widget:state.widget,contestOverlay:restored.snapshot().contestOverlay}}).state;
  assert.deepEqual(imported.contestOverlay,restored.snapshot().contestOverlay);
  await store.drain();await restored.drain();
});

test('broadcast projection excludes private participant data and the hidden target',()=>{
  const source={id:'contest',status:'collecting',mode:'number',keyword:'',numberMin:1,numberMax:100,winningNumber:42,deadline:10000,drawnAt:0,participants:Array.from({length:20},(_,i)=>({id:`private-${i}`,name:`Viewer ${i}`,message:'private message',roles:['subscriber'],eligible:i!==19})),winner:null,winnerMessages:['private chat'],broadcasterId:'private-channel'};
  const projected=publicContest(source);
  assert.equal(projected.winningNumber,null);
  assert.equal(projected.participantCount,19);
  assert.equal(projected.recentNames.length,8);
  assert.doesNotMatch(JSON.stringify(projected),/private-|private message|subscriber|winnerMessages/);
  assert.equal(publicContest({...source,status:'ready'}).winningNumber,42);
  assert.equal(publicContest(null),null);
});

test('draw animation settles on the server winner and rerolls restart independently',()=>{
  const source={id:'a',status:'winner',mode:'keyword',deadline:10000,drawnAt:10000,recentNames:['Alice','Bob'],winner:{name:'Bob'}};
  assert.equal(contestPresentation(source,10000).phase,'drawing');
  assert.equal(contestPresentation(source,12400).phase,'winner');
  assert.equal(contestPresentation(source,12500).name,'Bob');
  assert.equal(contestPresentation({...source,drawnAt:20000,winner:{name:'Alice'}},20100).phase,'drawing');
  assert.equal(contestPresentation({...source,mode:'number'},10100).phase,'winner');
  assert.equal(contestPresentation({...source,status:'collecting',winner:null},20000).seconds,0);
});

test('contest OBS feed updates through collection, winner, settings and reconnect without private chat', {timeout:10000}, async t=>{
  const app=await createApp({dataDir:await mkdtemp(join(tmpdir(),'cue-contest-feed-'))});
  const url=await app.listen(0);
  const abort=new AbortController();
  t.after(async()=>{abort.abort();await app.close()});
  const response=await fetch(url+'/api/contest/overlay/events',{signal:abort.signal});
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  const reader=response.body.getReader();let buffer='';
  async function next() {
    while(true) {
      const end=buffer.indexOf('\n\n');
      if(end>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=event.match(/^data: (.*)$/m);if(data)return JSON.parse(data[1]);continue}
      const result=await reader.read();assert.equal(result.done,false);buffer+=new TextDecoder().decode(result.value);
    }
  }
  assert.equal((await next()).contest,null);
  const start=await fetch(url+'/api/contest',{method:'POST',headers:{'Content-Type':'application/json','X-Poll-Client':'panel'},body:JSON.stringify({type:'start',setup:{mode:'keyword',keyword:'go',duration:60,source:'test'}})});
  assert.equal(start.status,200);
  const started=(await next()).contest;
  await app.contest.command({type:'demo',contestId:started.id});
  const collected=await next();assert.equal(collected.contest.participantCount,1);
  assert.doesNotMatch(JSON.stringify(collected),/messageId|winnerMessages|accessToken|broadcasterId|eligible|roles/);
  await app.contest.command({type:'draw',contestId:started.id});
  const winner=await next();assert.equal(winner.contest.status,'winner');assert.ok(winner.contest.winner.name);
  await app.store.command({type:'contest-overlay-update',settings:{enabled:false}});
  assert.equal((await next()).settings.enabled,false);
  const reconnect=await fetch(url+'/api/contest/overlay/events',{signal:abort.signal});
  const snapshot=new TextDecoder().decode((await reconnect.body.getReader().read()).value);
  assert.match(snapshot,/"enabled":false/);assert.ok(snapshot.includes(winner.contest.winner.name));
  abort.abort();
});
