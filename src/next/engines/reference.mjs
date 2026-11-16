// Structured reference pack and manual control-point calibration.
// Images are references, not enough to infer measured elevations or ticket IDs.
const validSource=s=>{if(!s||typeof s!=='object'||!/^https:\/\//.test(String(s.url??'')))throw Error('Reference source needs an HTTPS URL');return {url:String(s.url).slice(0,500),title:String(s.title??'').slice(0,120),date:s.date??null};};
export const ReferenceEngine={
  pack({venueId='custom',sources=[],facts={},level='estimated',rights='reference-only'}={}){
    if(!['estimated','reconstructed','documented','surveyed'].includes(level))throw Error('Unknown provenance level');
    if(!Array.isArray(sources)||sources.length>40)throw Error('Too many sources');
    if(facts==null||typeof facts!=='object'||Array.isArray(facts))throw Error('Facts must be a keyed object');
    return {venueId:String(venueId).slice(0,80),sources:sources.map(validSource),
      facts:structuredClone(facts),level,rights:String(rights).slice(0,100),
      coordinatesCertified:level==='surveyed'&&rights==='licensed-survey',
      notice:'A reference image or published capacity does not verify seat-level coordinates.'};
  },
  calibrate(controls){
    if(!Array.isArray(controls)||controls.length<2||controls.length>100)throw Error('Two to 100 control points required');
    const p=controls.map(c=>{
      const raw=[c.source?.x,c.source?.z,c.target?.x,c.target?.z].map(Number);
      if(!raw.every(Number.isFinite))throw Error('Invalid landmark coordinates');
      return {sx:raw[0],sz:raw[1],tx:raw[2],tz:raw[3]};
    });
    const mean=key=>p.reduce((s,c)=>s+c[key],0)/p.length;
    const sx=mean('sx'),sz=mean('sz'),tx=mean('tx'),tz=mean('tz');
    let den=0,a=0,b=0;
    for(const q of p){const x=q.sx-sx,z=q.sz-sz,X=q.tx-tx,Z=q.tz-tz;
      den+=x*x+z*z;a+=x*X+z*Z;b+=x*Z-z*X;
    }
    if(den<1e-8)throw Error('Source landmarks have no independent spread');
    a/=den;b/=den;
    const transform=(x,z)=>({x:a*x-b*z+(tx-a*sx+b*sz),z:b*x+a*z+(tz-b*sx-a*sz)});
    const errors=p.map(q=>Math.hypot(transform(q.sx,q.sz).x-q.tx,transform(q.sx,q.sz).z-q.tz));
    return {scale:Math.hypot(a,b),rotation:Math.atan2(b,a),transform,
      rmsMetres:Math.sqrt(errors.reduce((s,v)=>s+v*v,0)/errors.length),
      maxErrorMetres:Math.max(...errors),independentlyCheckable:p.length>=3,
      notice:p.length<3?'Two points fit the transform but cannot validate its accuracy.':'Residuals use calibration points; separate held-out controls remain necessary.'};
  }
};
export default ReferenceEngine;
