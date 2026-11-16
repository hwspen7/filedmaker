// Tamper-evident source metadata. A checksum identifies bytes; it does NOT
// certify a drawing's accuracy, authorship, approval, or copyright status.
const roles=new Set(['seat-rows','ticket-roster','reference-plan','survey','venue-metadata']);
const levels=new Set(['operator','school-supplied','public-reference','survey-unverified']);
const hex=n=>[...new Uint8Array(n)].map(v=>v.toString(16).padStart(2,'0')).join('');
export async function describeFile(file,{role,origin='operator',url=''}={}){
  if(!roles.has(role)||!levels.has(origin))throw Error('Unsupported source classification');
  if(!file||typeof file.arrayBuffer!=='function'||file.size>32_000_000||file.size<1)
    throw Error('Invalid source file or size');
  if(url&&!/^https:\/\//i.test(url))throw Error('Reference sources must use HTTPS');
  if(!globalThis.crypto?.subtle)throw Error('Secure SHA-256 hashing unavailable');
  const bytes=await file.arrayBuffer(),sha256=hex(await crypto.subtle.digest('SHA-256',bytes));
  return {id:'sha256:'+sha256,name:String(file.name||'unnamed').slice(0,160),size:file.size,
    mime:String(file.type||'application/octet-stream').slice(0,80),sha256,
    role,origin,url:String(url).slice(0,500),review:'unverified'};
}
export function appendSource(input,source){
  const v=structuredClone(input),sources=Array.isArray(v.sources)?v.sources:[];
  if(!roles.has(source.role)||!levels.has(source.origin)||!/^sha256:[a-f0-9]{64}$/.test(source.id)||
     source.sha256!==source.id.slice(7)||!Number.isInteger(source.size)||source.size<1||source.size>32_000_000)
    throw Error('Invalid source metadata');
  if(!sources.some(s=>s.id===source.id&&s.role===source.role))sources.push({...source});
  v.sources=sources;
  return v;
}
export function assessSources(v){
  const sources=v.sources??[];
  const seen=new Set(),issues=[];
  for(const source of sources){
    const key=source.id+'|'+source.role;
    if(seen.has(key))issues.push('Duplicate source record '+key);
    seen.add(key);
    if(!/^sha256:[a-f0-9]{64}$/.test(source.id)||source.sha256!==source.id.slice(7))
      issues.push('Invalid source fingerprint');
    if(source.review==='verified'&&!source.verifiedBy)issues.push('Source review missing verifier');
  }
  if(v.rows.length&&(!v.rowSourceId||!sources.some(s=>s.id===v.rowSourceId&&s.role==='seat-rows')))
    issues.push('Rows have no hashed source file in this project');
  if(v.plan.name&&(!v.planSourceId||!sources.some(s=>s.id===v.planSourceId&&s.role==='reference-plan')))
    issues.push('Drawing has no hashed source record');
  return {sources:sources.length,issues,
    allReviewed:!!sources.length&&sources.every(s=>s.review==='verified'&&s.verifiedBy)};
}
