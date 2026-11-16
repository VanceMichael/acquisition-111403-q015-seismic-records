const INTEGER=/^-?\d+$/;
const POSITIVE=/^\d+$/;

export async function collect(client) {
 const document=await client("/event");
 return [{id:document.recordId,...document}];
}

function fail(field,message){throw new Error(`连续波形记录无效: ${field} ${message}`);}

function normalizeSegment(document,sourceUrl){
 if(typeof document!=='object'||document===null) fail('记录','必须是对象');
 const {recordId,sourceIdentifier,startNs,intervalNs,samples,timeCorrectionNs,correctionApplied,timingQuality,replacementOf}=document;
 if(typeof recordId!=='string'||!recordId) fail('recordId','必须是非空字符串');
 if(typeof sourceIdentifier!=='string') fail('sourceIdentifier','必须是字符串');
 const parts=sourceIdentifier.split('.');
 if(parts.length!==4||parts.some(part=>!part)) fail('sourceIdentifier','必须是 台网.台站.位置码.通道 四段');
 if(typeof startNs!=='string'||!INTEGER.test(startNs)) fail('startNs','必须是整数纳秒字符串');
 if(typeof intervalNs!=='string'||!POSITIVE.test(intervalNs)||BigInt(intervalNs)<=0n) fail('intervalNs','必须是正整数纳秒字符串');
 if(!Array.isArray(samples)||!samples.length||!samples.every(sample=>Number.isFinite(sample))) fail('samples','必须是非空有限数值数组');
 if(typeof timeCorrectionNs!=='string'||!INTEGER.test(timeCorrectionNs)) fail('timeCorrectionNs','必须是整数纳秒字符串');
 if(typeof correctionApplied!=='boolean') fail('correctionApplied','必须是布尔值');
 if(timingQuality!==null&&(typeof timingQuality!=='number'||!Number.isFinite(timingQuality))) fail('timingQuality','必须是数值或null');
 if(replacementOf!==null&&(typeof replacementOf!=='string'||!replacementOf)) fail('replacementOf','必须是非空字符串或null');
 const [network,station,location,channel]=parts;
 return {
  id:recordId,
  identifier:sourceIdentifier,
  stream:{network,station,location,channel},
  startNs,intervalNs,
  sampleCount:samples.length,
  samples:[...samples],
  timeCorrectionNs,correctionApplied,timingQuality,replacementOf,
  sourceUrl
 };
}

export async function collectWaveforms(client,{cursor}={}) {
 let next=cursor??'/waveforms?cursor=0';
 const segments=[];
 while(next!==null){
  let page;
  try{page=await client(next);}
  catch(error){return {segments,complete:false,resumeCursor:next,error:error.message};}
  if(typeof page!=='object'||page===null||!Array.isArray(page.records)) throw new Error('连续波形响应结构无效: 缺少records数组');
  if(page.next!==null&&typeof page.next!=='string') throw new Error('连续波形响应结构无效: next必须是字符串或null');
  const pageUrl=client.origin?new URL(next,client.origin).href:next;
  for(const record of page.records) segments.push(normalizeSegment(record,pageUrl));
  next=page.next;
 }
 return {segments,complete:true,resumeCursor:null};
}
