import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, rename, open} from 'node:fs/promises';
import {join} from 'node:path';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function replace(path, bytes) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
}

const receiptOf = exchange => {
  const hash = digest(exchange.bytes);
  return {receiptId: digest(Buffer.from(exchange.url + ':' + exchange.status + ':' + hash)), hash};
};

const segmentContent = ({id, identifier, stream, startNs, intervalNs, sampleCount, samples, timeCorrectionNs, correctionApplied, timingQuality, replacementOf}) =>
  ({id, identifier, stream, startNs, intervalNs, sampleCount, samples, timeCorrectionNs, correctionApplied, timingQuality, replacementOf});

export async function openArchive(directory) {
  await mkdir(join(directory, 'objects'), {recursive:true});
  const indexPath = join(directory, 'index.json');
  let index = {version:2, records:[], exchanges:[], segments:[], state:{cursor:null}};
  try {
    const loaded = JSON.parse(await readFile(indexPath, 'utf8'));
    index = loaded.version === 1
      ? {version:2, records:loaded.records, exchanges:loaded.exchanges, segments:[], state:{cursor:null}}
      : loaded;
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (index.version !== 2 || !Array.isArray(index.records) || !Array.isArray(index.exchanges) || !Array.isArray(index.segments) || typeof index.state !== 'object' || index.state === null) throw new Error('归档索引结构无效');
  for (const exchange of index.exchanges) {
    if (!/^[a-f0-9]{64}$/.test(exchange.hash)) throw new Error('归档摘要无效');
    const bytes = await readFile(join(directory, 'objects', exchange.hash));
    if (digest(bytes) !== exchange.hash) throw new Error('归档原文校验失败');
  }
  let queue = Promise.resolve();
  return {
    records:() => structuredClone(index.records),
    exchanges:() => structuredClone(index.exchanges),
    segments:({all=false}={}) => structuredClone(all ? index.segments : index.segments.filter(segment => !segment.supersededBy)),
    state:() => structuredClone(index.state),
    raw: async hash => {
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('原文摘要无效');
      const bytes = await readFile(join(directory, 'objects', hash));
      if (digest(bytes) !== hash) throw new Error('原文校验失败');
      return bytes;
    },
    commit(records, exchanges, {segments=[], cursor}={}) {
      const operation = queue.then(async () => {
        const next = structuredClone(index);
        const receipts = new Map();
        for (const exchange of exchanges) {
          const {receiptId, hash} = receiptOf(exchange);
          receipts.set(exchange.url, receiptId);
          await replace(join(directory, 'objects', hash), exchange.bytes);
          if (!next.exchanges.some(existing => existing.receiptId === receiptId)) {
            next.exchanges.push({receiptId,url:exchange.url,status:exchange.status,contentType:exchange.contentType,hash});
          }
        }
        let addedRecords = 0, addedSegments = 0;
        for (const record of records) {
          if (typeof record.id !== 'string' || !record.id) throw new Error('资料必须有非空标识');
          const revision = digest(Buffer.from(JSON.stringify(record)));
          if (!next.records.some(existing => existing.id === record.id && existing.revision === revision)) {
            next.records.push({...record,revision});
            addedRecords += 1;
          }
        }
        for (const segment of segments) {
          if (typeof segment.id !== 'string' || !segment.id) throw new Error('波形分段必须有非空标识');
          const revision = digest(Buffer.from(JSON.stringify(segmentContent(segment))));
          if (!next.segments.some(existing => existing.id === segment.id && existing.revision === revision)) {
            next.segments.push({...structuredClone(segment), revision, receipt: receipts.get(segment.sourceUrl) ?? null});
            addedSegments += 1;
          }
        }
        for (const segment of segments) {
          if (typeof segment.replacementOf !== 'string' || !segment.replacementOf) continue;
          for (const existing of next.segments) {
            if (existing.id === segment.replacementOf && !existing.supersededBy) existing.supersededBy = segment.id;
          }
        }
        if (cursor !== undefined) next.state = {...next.state, cursor};
        await replace(indexPath, Buffer.from(JSON.stringify(next, null, 2)));
        index = next;
        return {records:next.records.length, segments:next.segments.length, exchanges:next.exchanges.length, addedRecords, addedSegments};
      });
      queue = operation.catch(() => {});
      return operation;
    }
  };
}
