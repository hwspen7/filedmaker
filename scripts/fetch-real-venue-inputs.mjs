#!/usr/bin/env node
// Download independent public PDF evidence to ephemeral CI fixtures.
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {REAL_SCHOOL_CASES} from '../tests/fixtures/actual-school-cases.mjs';
const approved=new Map(REAL_SCHOOL_CASES.map(c=>[c.id,c.source.url]));
const targets=[
  {id:'aiken-high-taylor-gym',page:4},
  {id:'wills-point-main-gym',page:4},
  {id:'bay-port-pac',page:1,
    url:'https://resources.finalsite.net/images/v1777638822/hssdk12wius/muw8sgvivoenujg9tpme/PACSeating_2026_vwxpdf.pdf'}
];
const MAX=24_000_000,where=resolve('artifacts/real-school'),fixtures=resolve('tests/fixtures');
await mkdir(where,{recursive:true});await mkdir(fixtures,{recursive:true});
const successes=[],failures=[];
for(const item of targets){
  try{
    const url=item.url||approved.get(item.id);
    if(!url||!url.startsWith('https://'))throw Error('Missing HTTPS provenance');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),
      headers:{'User-Agent':'Mozilla/5.0 (compatible; FiledMakerResearchQA/1.0)'}});
    if(!response.ok)throw Error('HTTP '+response.status);
    if(Number(response.headers.get('content-length')||0)>MAX)
      throw Error('Document exceeds 24MB');
    const chunks=[];let size=0;
    for await(const chunk of response.body){
      size+=chunk.length;if(size>MAX)throw Error('Document exceeds 24MB');
      chunks.push(chunk);
    }
    const bytes=Buffer.concat(chunks);
    if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF header');
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const fixture='real-'+item.id+'.base64.txt';
    await writeFile(join(fixtures,fixture),bytes.toString('base64')+'\n');
    const entry={id:item.id,name:item.id+'.pdf',url,sha256,bytes:size,
      page:item.page,fixture,source:'live-public-pdf'};
    successes.push(entry);console.log('LIVE PDF '+JSON.stringify(entry));
  }catch(e){
    failures.push({id:item.id,error:e.message});
    console.error('SOURCE UNAVAILABLE '+item.id+': '+e.message);
  }
}
await writeFile(join(where,'manifest.json'),JSON.stringify({
  at:new Date().toISOString(),sources:successes,failures},null,2));
if(successes.length<2||!successes.some(s=>s.id==='aiken-high-taylor-gym'||s.id==='wills-point-main-gym')){
  console.error('FAIL: Need two independently downloaded PDFs including a genuine gym');
  process.exitCode=1;
}
