import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createErrorJournal, redactDiagnostic } from '../server/diagnostics.mjs';
import { presentError } from '../public/error-messages.js';
import { createApp } from '../server/app.mjs';

test('the journal redacts credentials, URL parameters and personal paths before saving and exporting', async () => {
  const file = join(await mkdtemp(join(tmpdir(), 'cue-errors-')), 'errors.json');
  const journal = await createErrorJournal(file, { version:'0.8.3-beta.3', home:'/Users/private-name' });
  const error = new Error('Invalid package C:\\Users\\private-name\\AppData\\app.asar /Users/private-name/app access_token=private-token Bearer private-bearer https://user:pass@example.com/path?secret=private-query email=private@example.com');
  for (let i = 0; i < 3; i++) journal.record({source:'versions:download',error});
  await journal.flush();
  const saved = await readFile(file,'utf8');
  assert.doesNotMatch(saved,/private-name|private-token|private-bearer|private-query|private@example|user:pass/);
  const reloaded = await createErrorJournal(file, {version:'0.8.3-beta.3'});
  assert.equal(reloaded.snapshot().entries[0].count,3);
  assert.equal(reloaded.snapshot().entries[0].title,'Не удалось установить обновление');
  assert.equal(reloaded.snapshot().entries[0].version,'0.8.3-beta.3');
  await reloaded.clear();
  assert.equal((await createErrorJournal(file)).snapshot().entries.length,0);
});

test('history is bounded by count, age and disk size; clearing pending writes cannot restore old entries', async () => {
  let now=100000;
  const file = join(await mkdtemp(join(tmpdir(),'cue-errors-')),'errors.json');
  const journal = await createErrorJournal(file,{now:()=>now});
  for(let i=0;i<250;i++)journal.record({source:'test',error:`Failure ${i}: ${'x'.repeat(10000)}`});
  await journal.flush();
  assert.ok(journal.snapshot().entries.length <= 100);
  assert.ok((await stat(file)).size <= 512*1024);
  now+=31*86400000;
  assert.equal(journal.snapshot().entries.length,0);
  journal.record({source:'test',error:'last error'});
  await journal.clear();
  assert.equal(JSON.parse(await readFile(file,'utf8')).entries.length,0);
});

test('users receive an explanation and next step instead of IPC, filesystem or Twitch setup jargon', () => {
  for(const raw of ["Error invoking remote method 'versions:download': Error: Invalid package C:\\Users\\someone\\app.asar",'Тwitch Client ID: тип Public','TypeError: Cannot read properties of undefined','EACCES: permission denied']) {
    const notice=presentError(raw);
    assert.doesNotMatch(JSON.stringify(notice), /versions:download|app\.asar|Client ID|тип Public|TypeError|EACCES|someone/);
    assert.ok(notice.description.length>10);
  }
  assert.equal(presentError('Добавьте слово для участия.').title,'Добавьте слово для участия.');
  assert.equal(presentError({ message:'internal failure' }).title,'Не удалось выполнить действие');
  assert.doesNotMatch(JSON.stringify(presentError('Error: Сбой\n    at example (file:///C:/app/main.mjs:22:1)')), /main\.mjs|file:\/\//);
  assert.doesNotMatch(redactDiagnostic('{"refresh_token":"abc123"}'), /abc123/);
});

test('diagnostics HTTP export and clear require the trusted panel and never export raw details', async t => {
  const app=await createApp({dataDir:await mkdtemp(join(tmpdir(),'cue-errors-http-'))});
  const url=await app.listen(0);
  t.after(()=>app.close());
  const post=(body,headers={})=>fetch(url+'/api/diagnostics',{method:'POST',headers:{'Content-Type':'application/json','X-Poll-Client':'panel',...headers},body:JSON.stringify(body)});
  assert.equal((await post({type:'record',message:'private error'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await post({type:'record',message:'Ошибка C:\\Users\\someone\\AppData\\app.asar access_token=private-token'})).status,200);
  const report=await(await fetch(url+'/api/diagnostics')).json();
  assert.equal(report.entries.length,1);
  assert.doesNotMatch(JSON.stringify(report),/someone|private-token/);
  assert.equal((await post({type:'clear'})).status,200);
  assert.equal((await(await fetch(url+'/api/diagnostics')).json()).entries.length,0);
});
