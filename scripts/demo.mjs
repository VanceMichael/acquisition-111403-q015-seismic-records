import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startSource} from '../provider/server.mjs';
import {startIntake} from '../src/app.mjs';

const directory=await mkdtemp(join(tmpdir(),'intake-demo-'));
const source=await startSource();
const intake=await startIntake({origin:source.origin,directory});
try{
 const response=await fetch(intake.origin+'/collect',{method:'POST'});
 const receipt=await response.json();if(!response.ok)throw new Error(JSON.stringify(receipt));
 console.log('本次接收',JSON.stringify(receipt));
 const continuous=await fetch(intake.origin+'/collect/continuous',{method:'POST'});
 const summary=await continuous.json();if(!continuous.ok)throw new Error(JSON.stringify(summary));
 console.log('连续采集',JSON.stringify(summary));
 console.log('结构化资料',JSON.stringify(await(await fetch(intake.origin+'/records')).json(),null,2));
 console.log('波形分段',JSON.stringify(await(await fetch(intake.origin+'/segments')).json(),null,2));
 console.log('连续性说明',JSON.stringify(await(await fetch(intake.origin+'/continuity')).json(),null,2));
 console.log('原文凭据',JSON.stringify(await(await fetch(intake.origin+'/receipts')).json(),null,2));
}finally{await intake.close();await source.close();await rm(directory,{recursive:true,force:true});}
