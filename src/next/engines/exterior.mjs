// Configurable, non-surveyed architectural exterior for arena-shaped venues.
// The generator owns geometry; venue-specific landmarks belong to a profile.
// All coordinates are metres. Each mesh vertex is XYZ followed by unit normal.
import { structuralQuad, addRoundVolume } from '../structuralMesh.mjs';

const TAU=Math.PI*2;
const finite=(v,label,lo,hi)=>{
  const n=Number(v);
  if(!Number.isFinite(n)||n<lo||n>hi)throw Error(label+' must be between '+lo+' and '+hi);
  return n;
};
const length=v=>Math.hypot(...v)||1;
const normalized=v=>v.map(x=>x/length(v));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,s)=>a.map(v=>v*s);
const triangulate=(out,a,b,c,n)=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((w,i)=>w-a[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(cross.reduce((sum,x,i)=>sum+x*n[i],0)<0)[b,c]=[c,b];
  const normal=normalized(n);
  for(const p of [a,b,c])out.push(...p,...normal);
};
const quad=(out,a,b,c,d,n)=>{
  triangulate(out,a,b,c,n);triangulate(out,a,c,d,n);
};
function prism(out,center,u,v,low,high,halfU,halfV){
  const xy=(a,b,y)=>add(add(center,scale(u,a)),[scale(v,b)[0],y,scale(v,b)[2]]);
  const a=xy(-halfU,-halfV,low),b=xy(halfU,-halfV,low),
    c=xy(halfU,halfV,low),d=xy(-halfU,halfV,low);
  const A=xy(-halfU,-halfV,high),B=xy(halfU,-halfV,high),
    C=xy(halfU,halfV,high),D=xy(-halfU,halfV,high);
  quad(out,a,b,B,A,scale(v,-1));quad(out,b,c,C,B,u);
  quad(out,c,d,D,C,v);quad(out,d,a,A,D,scale(u,-1));
  quad(out,A,B,C,D,[0,1,0]);quad(out,d,c,b,a,[0,-1,0]);
}
function featureDirection(angle){
  const outward=[Math.cos(angle),0,Math.sin(angle)];
  // u is the public-facing horizontal axis, v projects away from the bowl.
  return {outward,tangent:[-Math.sin(angle),0,Math.cos(angle)]};
}
function rotunda(out,profile,footprint,angle,role){
  const {outward,tangent}=featureDirection(angle);
  const site=footprint(angle),radius=role==='primary'?6.85:5.55;
  const height=role==='primary'?23.2:18.3;
  const center=[site.x+outward[0]*1.3,0,site.z+outward[2]*1.3];
  const n=48,step=TAU/n;
  const point=(j,r,y)=>[center[0]+Math.cos(j*step)*r,y,center[2]+Math.sin(j*step)*r];
  for(let i=0;i<n;i++){
    const a=i*step,b=(i+1)*step,m=(a+b)/2;
    const nrm=[Math.cos(m),0,Math.sin(m)];
    const streetFacing=nrm[0]*outward[0]+nrm[2]*outward[2]>.20;
    const opening=streetFacing&&i%6>=2&&i%6<=4;
    // Window openings replace masonry faces rather than covering opaque brick.
    const ranges=opening?[[0,3.0,'brick'],[3.0,4.2,'door'],[4.2,5.15,'brick'],
      [5.15,height-3.1,'glass'],[height-3.1,height,'brick']]
      :[[0,height,'brick']];
    for(const [lo,hi,kind] of ranges){
      if(hi<=lo)continue;
      const mesh=kind==='brick'?out.towerBrick:kind==='door'?out.entryDoors:out.towerWindows;
      const inset=kind==='brick'?0:-.07;
      quad(mesh,point(i,radius+inset,lo),point(i+1,radius+inset,lo),
        point(i+1,radius+inset,hi),point(i,radius+inset,hi),nrm);
    }
    if(opening){
      for(const y of [4.16,5.18,height-3.08]){
        quad(out.towerFrames,point(i,radius+.025,y-.095),point(i+1,radius+.025,y-.095),
          point(i+1,radius+.025,y+.095),point(i,radius+.025,y+.095),nrm);
      }
    }
  }
  // Crown lantern: a real open, glazed rotunda roof held on discrete columns.
  const crownBase=height+.15,crownTop=height+2.9;
  for(let i=0;i<n;i++){
    const m=(i+.5)*step,nrm=[Math.cos(m),0,Math.sin(m)];
    quad(out.towerCrown,point(i,radius+.1,crownBase-.18),point(i+1,radius+.1,crownBase-.18),
      point(i+1,radius+.1,crownBase+.18),point(i,radius+.1,crownBase+.18),nrm);
    quad(out.towerCrown,point(i,radius+1.0,crownTop-.24),point(i+1,radius+1.0,crownTop-.24),
      point(i+1,radius+1.0,crownTop+.14),point(i,radius+1.0,crownTop+.14),nrm);
    if(i%6===0){
      const p=point(i,radius+.30,crownBase+.18);
      prism(out.towerRibs,[p[0],0,p[2]],tangent,outward,crownBase+.18,crownTop-.24,.16,.15);
    }
    // A shallow ring, not an opaque disc that would block the view below.
    const innerA=point(i,radius+.05,crownTop+.15),innerB=point(i+1,radius+.05,crownTop+.15),
      outerA=point(i,radius+1.04,crownTop+.15),outerB=point(i+1,radius+1.04,crownTop+.15);
    quad(out.towerCrown,innerA,innerB,outerB,outerA,[0,1,0]);
  }
  // Main entrance: deeply inset glass lobby with framed doors, masonry wings
  // and a thin projecting metal canopy. No freestanding wall or fake EXIT text.
  const entranceWidth=role==='primary'?23:17;
  const lobbyCenter=add(center,scale(outward,radius+.35));
  prism(out.entryBrick,add(lobbyCenter,scale(tangent,-entranceWidth*.55)),
    tangent,outward,0,9.15,1.55,2.3);
  prism(out.entryBrick,add(lobbyCenter,scale(tangent,entranceWidth*.55)),
    tangent,outward,0,9.15,1.55,2.3);
  prism(out.entryBrick,lobbyCenter,tangent,outward,7.85,9.45,entranceWidth*.53,2.0);
  const face=add(lobbyCenter,scale(outward,2.03));
  for(let i=0;i<8;i++){
    const left=(i/8-.5)*entranceWidth,right=((i+1)/8-.5)*entranceWidth;
    const glass=(x,y)=>add(add(face,scale(tangent,x)),[0,y,0]);
    quad(out.entryCurtain,glass(left+.095,.3),glass(right-.095,.3),
      glass(right-.095,7.62),glass(left+.095,7.62),outward);
    if(i<7){
      const x=right,strip=.045;
      quad(out.entryFrames,glass(x-strip,.2),glass(x+strip,.2),
        glass(x+strip,7.72),glass(x-strip,7.72),outward);
    }
  }
  prism(out.entryFrames,face,tangent,outward,7.66,7.86,entranceWidth*.53,.075);
  prism(out.entryFrames,face,tangent,outward,.18,.35,entranceWidth*.53,.075);
  const awning=add(lobbyCenter,scale(outward,3.75));
  prism(out.entryCanopy,awning,tangent,outward,4.05,4.34,entranceWidth*.65,3.4);
  for(const side of [-1,1]){
    const column=add(add(lobbyCenter,scale(tangent,side*entranceWidth*.58)),
      scale(outward,5.7));
    prism(out.entryFrames,column,tangent,outward,0,4.05,.19,.18);
  }
  return {radius,height,center};
}
export const ExteriorEngine={
  /**
   * A reusable architectural facade; all geometry depends on the provided
   * perimeter, so one arena is data rather than a hardcoded source file.
   */
  build({footprint,height=40,segments=192,profile='metal-and-brick',entrances=[]}={}){
    if(typeof footprint!=='function')throw Error('A closed perimeter sampler is required');
    const h=finite(height,'Exterior height',8,95);
    const n=finite(segments,'Perimeter resolution',32,512);
    if(!Number.isInteger(n))throw Error('Perimeter resolution must be integral');
    if(!['metal-and-brick','modern-glass','masonry'].includes(profile))throw Error('Unsupported exterior profile');
    if(!Array.isArray(entrances)||entrances.length>12)throw Error('Invalid entrance features');
    const arrays=Object.fromEntries([
      'metalPanels','metalSeams','brickBase','brickPiers','baseWindows',
      'towerBrick','towerWindows','towerFrames','towerCrown','towerRibs',
      'entryBrick','entryCurtain','entryFrames','entryCanopy','entryDoors'
    ].map(key=>[key,[]]));
    const sampled=Array.from({length:n},(_,i)=>{
      const p=footprint(i*TAU/n);
      if(!p||![p.x,p.z].every(Number.isFinite))throw Error('Invalid perimeter station');
      return p;
    });
    const outNormal=(a,b)=>normalized([a.x+b.x,0,a.z+b.z]);
    const wall=(dest,i,lo,hi,inset=0)=>{
      if(hi<=lo)return;
      const j=(i+1)%n,a=sampled[i],b=sampled[j],normal=outNormal(a,b);
      const p=(point,y)=>[point.x+normal[0]*inset,y,point.z+normal[2]*inset];
      quad(dest,p(a,lo),p(b,lo),p(b,hi),p(a,hi),normal);
    };
    // Panels follow a shared datum; interrupted window bands are holes, not
    // graphics painted across a solid arena wall.
    const beltStart=Math.min(10.3,h*.25),metalStart=beltStart;
    const panelPitch=1.16;
    for(let i=0;i<n;i++){
      const bay=i%12,baseWindow=bay>=3&&bay<=7;
      const bands=baseWindow?[[0,1.5,'brick'],[1.5,6.8,'glass'],[6.8,beltStart,'brick']]
        :[[0,beltStart,'brick']];
      for(const [lo,hi,kind] of bands){
        wall(arrays[kind==='glass'?'baseWindows':'brickBase'],i,lo,hi,kind==='glass'?.055:0);
      }
      if(bay===0){
        wall(arrays.brickPiers,i,0,beltStart,.16);
      }
      const metalWindows=profile==='modern-glass'?[17.5,25.5]:[15.8,24.1,31.7];
      let previous=metalStart;
      for(const y of metalWindows){
        const lo=Math.min(y,h-.55),hi=Math.min(y+.62,h-.42);
        if(lo<=previous||hi<=lo)continue;
        wall(arrays.metalPanels,i,previous,lo,.025);
        if(bay===4||bay===5)wall(arrays.baseWindows,i,lo,hi,.08);
        else wall(arrays.metalPanels,i,lo,hi,.025);
        previous=hi;
      }
      wall(arrays.metalPanels,i,previous,h-.20,.025);
      for(let y=metalStart+panelPitch;y<h-.45;y+=panelPitch){
        // Horizontal metal joint. Sparse reveal lines remain visible close up.
        const inGap=metalWindows.some(t=>y>t&&y<t+.62)&&(bay===4||bay===5);
        if(!inGap)wall(arrays.metalSeams,i,y,y+.055,.077);
      }
      if(bay===0||bay===1)wall(arrays.brickPiers,i,0,beltStart,.12);
    }
    for(const entrance of entrances){
      const a=finite(entrance.angle,'Entrance angle',0,TAU);
      const role=entrance.role==='primary'?'primary':'secondary';
      rotunda(arrays,profile,angle=>footprint(angle),a,role);
    }
    return Object.fromEntries(Object.entries(arrays).map(([key,vertices])=>[key,new Float32Array(vertices)]));
  }
};
export default ExteriorEngine;
