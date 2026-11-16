import {createServer} from 'node:http';
import {openArchive} from './archive.mjs';
import {createClient} from './source.mjs';
import {collect, collectWaveforms} from './reader.mjs';
import {assessContinuity} from './continuity.mjs';

export async function startIntake({origin,directory,port=0}) {
  const archive=await openArchive(directory);
  const server=createServer(async (request,response)=>{
    const send=(value,status=200)=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));};
    try {
      const url=new URL(request.url,'http://localhost');
      const path=url.pathname;
      if(request.method==='GET'&&path==='/health'){send({status:'运行中'});return;}
      if(request.method==='GET'&&path==='/records'){send(archive.records());return;}
      if(request.method==='GET'&&path==='/receipts'){send(archive.exchanges());return;}
      if(request.method==='GET'&&path.startsWith('/receipts/')){
        const receiptId=path.slice('/receipts/'.length);
        const exchange=archive.exchanges().find(item=>item.receiptId===receiptId);
        if(!exchange){send({message:'凭据不存在'},404);return;}
        const bytes=await archive.raw(exchange.hash);
        response.writeHead(200,{'content-type':'application/json; charset=utf-8'});response.end(bytes);return;
      }
      if(request.method==='GET'&&path==='/segments'){send(archive.segments({all:url.searchParams.get('all')==='1'}));return;}
      if(request.method==='GET'&&path==='/continuity'){send(assessContinuity(archive.segments()));return;}
      if(request.method==='POST'&&path==='/collect'){
        const client=createClient(origin);const records=await collect(client);
        send(await archive.commit(records,client.exchanges));return;
      }
      if(request.method==='POST'&&path==='/collect/continuous'){
        const client=createClient(origin);
        const result=await collectWaveforms(client,{cursor:archive.state().cursor??undefined});
        const summary=await archive.commit([],client.exchanges,{segments:result.segments,cursor:result.complete?null:result.resumeCursor});
        if(!result.complete){send({message:`连续接收中断: ${result.error}`,complete:false,resumeCursor:result.resumeCursor,...summary},502);return;}
        send({complete:true,resumeCursor:null,...summary});return;
      }
      send({message:'接口不存在'},404);
    } catch(error){send({message:error.message},502);}
  });
  await new Promise(resolve=>server.listen(port,'0.0.0.0',resolve));
  return {origin:`http://127.0.0.1:${server.address().port}`,archive,close:()=>new Promise(resolve=>server.close(resolve))};
}
