import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {startSource} from '../provider/server.mjs';
import {startIntake} from '../src/app.mjs';
import {collectWaveforms} from '../src/reader.mjs';

async function environment(run){
 const directory=await mkdtemp(join(tmpdir(),'continuous-test-'));const source=await startSource();
 const intake=await startIntake({origin:source.origin,directory});
 const post=async path=>{const response=await fetch(intake.origin+path,{method:'POST'});return {status:response.status,body:await response.json()};};
 const get=async path=>{const response=await fetch(intake.origin+path);return {status:response.status,body:await response.json()};};
 try{await run({source,intake,post,get});}
 finally{await intake.close();await source.close();await rm(directory,{recursive:true,force:true});}
}

test('连续采集分页入库并保留采样与质量声明',()=>environment(async({post,get})=>{
 const collected=await post('/collect/continuous');
 assert.equal(collected.status,200);assert.equal(collected.body.complete,true);assert.equal(collected.body.addedSegments,2);
 const segments=(await get('/segments')).body;
 assert.equal(segments.length,2);
 const r1=segments.find(segment=>segment.id==='r1');
 assert.deepEqual(r1.stream,{network:'XX',station:'STA',location:'00',channel:'BHZ'});
 assert.equal(r1.startNs,'1794614400000000000');assert.equal(r1.intervalNs,'10000000');assert.equal(r1.sampleCount,3);
 assert.equal(r1.timingQuality,80);assert.equal(r1.correctionApplied,false);assert.equal(r1.timeCorrectionNs,'1000');
 assert.match(r1.receipt,/^[a-f0-9]{64}$/);
 const again=await post('/collect/continuous');
 assert.equal(again.body.addedSegments,0);assert.equal((await get('/segments')).body.length,2);
}));

test('不同采样率分段独立成组不拼合不补值',()=>environment(async({post,get})=>{
 await post('/collect/continuous');
 const report=(await get('/continuity')).body;
 assert.equal(report.totals.streams,1);assert.equal(report.totals.segments,2);
 assert.equal(report.totals.gaps,0);assert.equal(report.totals.overlaps,0);
 const stream=report.streams[0];
 assert.equal(stream.identifier,'XX.STA.00.BHZ');
 assert.deepEqual(stream.rates.map(rate=>rate.intervalNs),['10000000','20000000']);
 assert.equal(stream.rates[0].segments[0].id,'r1');assert.equal(stream.rates[1].segments[0].id,'r2');
 assert.ok(stream.rates.every(rate=>rate.segments.length===1));
}));

test('来源重发替代记录时保留原始分段与替代关系',()=>environment(async({source,post,get})=>{
 await post('/collect/continuous');
 source.setPhase('replacement');
 await post('/collect/continuous');
 const all=(await get('/segments?all=1')).body;
 assert.equal(all.length,3);
 const r1=all.find(segment=>segment.id==='r1');const r3=all.find(segment=>segment.id==='r3');
 assert.equal(r1.supersededBy,'r3');assert.equal(r3.replacementOf,'r1');
 assert.notEqual(r3.receipt,r1.receipt);
 const current=(await get('/segments')).body;
 assert.ok(current.every(segment=>segment.id!=='r1'));
 assert.ok(current.some(segment=>segment.id==='r3'));
 const report=(await get('/continuity')).body;
 const rate=report.streams[0].rates.find(item=>item.intervalNs==='10000000');
 assert.deepEqual(rate.segments.map(segment=>segment.id),['r3']);
}));

test('凭据可复查某段波形来自哪份原始响应',()=>environment(async({source,intake,post,get})=>{
 await post('/collect/continuous');
 source.setPhase('replacement');
 await post('/collect/continuous');
 const r3=(await get('/segments?all=1')).body.find(segment=>segment.id==='r3');
 const receipt=(await get('/receipts')).body.find(item=>item.receiptId===r3.receipt);
 assert.ok(receipt);
 const response=await fetch(intake.origin+'/receipts/'+r3.receipt);
 assert.equal(response.status,200);
 const original=await response.json();
 assert.equal(original.records[0].recordId,'r3');
 assert.equal(original.records[0].replacementOf,'r1');
 assert.equal((await fetch(intake.origin+'/receipts/'+'0'.repeat(64))).status,404);
}));

test('中途断开后从断点续收且原始分段不丢不重',()=>environment(async({source,post,get})=>{
 source.setPhase('interrupted');
 const first=await post('/collect/continuous');
 assert.equal(first.status,502);assert.equal(first.body.complete,false);
 assert.equal(first.body.resumeCursor,'/waveforms?cursor=1');
 assert.deepEqual((await get('/segments')).body.map(segment=>segment.id),['r1']);
 source.setPhase('normal');
 const second=await post('/collect/continuous');
 assert.equal(second.status,200);assert.equal(second.body.complete,true);
 const segments=(await get('/segments')).body;
 assert.deepEqual(segments.map(segment=>segment.id).sort(),['r1','r2']);
 assert.equal((await post('/collect/continuous')).body.addedSegments,0);
}));

test('同速率分段报告缺口与重叠并标注未应用校时',()=>environment(async({source,post,get})=>{
 source.setPhase('overlap');
 await post('/collect/continuous');
 const report=(await get('/continuity')).body;
 assert.equal(report.totals.gaps,1);assert.equal(report.totals.overlaps,1);
 const rate=report.streams[0].rates[0];
 assert.equal(rate.intervalNs,'10000000');assert.equal(rate.segments.length,3);
 const gap=rate.gaps[0];
 assert.equal(gap.afterId,'o2');assert.equal(gap.beforeId,'o3');
 assert.equal(gap.fromNs,'1794614400050000000');assert.equal(gap.toNs,'1794614400070000000');
 assert.equal(gap.durationNs,'20000000');assert.equal(gap.missingSamples,'2');
 const overlap=rate.overlaps[0];
 assert.equal(overlap.firstId,'o1');assert.equal(overlap.secondId,'o2');
 assert.equal(overlap.fromNs,'1794614400020000000');assert.equal(overlap.toNs,'1794614400030000000');
 assert.equal(overlap.overlappingSamples,'1');
 const o2=rate.segments.find(segment=>segment.id==='o2');
 assert.ok(o2.timeFlags.includes('correction-pending'));
 assert.ok(!o2.timeFlags.includes('quality-unknown'));
}));

test('质量未知与校时未应用的分段标记为时间不确定',()=>environment(async({source,post,get})=>{
 source.setPhase('uncertain');
 await post('/collect/continuous');
 const report=(await get('/continuity')).body;
 const uncertain=report.streams[0].rates.flatMap(rate=>rate.segments).find(segment=>segment.id==='uncertain1');
 assert.deepEqual(uncertain.timeFlags.sort(),['correction-pending','quality-unknown']);
 assert.ok(report.totals.uncertain>=1);
}));

test('违反来源约定的记录被拒绝',async()=>{
 const page={records:[{recordId:'bad',sourceIdentifier:'XX.STA.00.BHZ',startNs:'1.5',intervalNs:'10000000',samples:[1],timeCorrectionNs:'0',correctionApplied:true,timingQuality:null,replacementOf:null}],next:null};
 const client=async()=>page;client.origin='http://local';client.exchanges=[];
 await assert.rejects(()=>collectWaveforms(client),/startNs/);
 const noSamples={...page,records:[{...page.records[0],recordId:'ok',startNs:'1',samples:[]}]};
 const empty=async()=>noSamples;empty.origin='http://local';empty.exchanges=[];
 await assert.rejects(()=>collectWaveforms(empty),/samples/);
});

test('传输中断返回已收分段与续传游标',async()=>{
 const valid={recordId:'s1',sourceIdentifier:'XX.STA.00.BHZ',startNs:'1794614400000000000',intervalNs:'10000000',samples:[1,2],timeCorrectionNs:'0',correctionApplied:true,timingQuality:90,replacementOf:null};
 const client=async path=>{
  if(path==='/waveforms?cursor=0')return {records:[valid],next:'/waveforms?cursor=1'};
  throw new Error('连接重置');
 };
 client.origin='http://local';client.exchanges=[];
 const result=await collectWaveforms(client);
 assert.equal(result.complete,false);assert.equal(result.resumeCursor,'/waveforms?cursor=1');
 assert.equal(result.segments.length,1);assert.equal(result.segments[0].id,'s1');
 assert.equal(result.segments[0].sourceUrl,'http://local/waveforms?cursor=0');
});
