// Schottenstein Center architectural cutaway: reconstructed, not surveyed.
// All vertex coordinates are metres. Separate from ticket inventories and
// authoritative imported-XYZ seats.
import { schottensteinDeckHeight, schottensteinDeckPoint } from '../schottensteinSeating.mjs';

const TAU=Math.PI*2;
const SEGMENTS=192;
const BANDS=12;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const radius=p=>Math.hypot(p.x,p.z);
const vec=(p,y)=>[p.x,y,p.z];
const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const normalize=v=>{const m=Math.hypot(...v)||1;return v.map(n=>n/m);};

// Explicit face winding and normals keep each architectural surface visible
// under the renderer's backface culling.
function face(out,a,b,c,normal){
  if(dot(cross(subtract(b,a),subtract(c,a)),normal)<0)[b,c]=[c,b];
  const n=normalize(normal);
  out.push(...a,...n,...b,...n,...c,...n);
}
function quad(out,a,b,c,d,normal){
  face(out,a,b,c,normal);
  face(out,a,c,d,normal);
}
function ringPoint(tier,angle,fraction,outer=0){
  const p=schottensteinDeckPoint(tier,angle,fraction);
  const r=radius(p);
  const y=schottensteinDeckHeight(tier,p);
  return {x:(r+outer)*Math.cos(angle),z:(r+outer)*Math.sin(angle),y};
}
function normalOut(p){return normalize([p.x,0,p.z]);}
function ringStrip(out,from,to,normal){
  for(let i=0;i<SEGMENTS;i++){
    const a=i*TAU/SEGMENTS,b=(i+1)*TAU/SEGMENTS;
    const p=from(a),q=from(b),r=to(b),s=to(a);
    const mean={x:(p.x+q.x+r.x+s.x)/4,z:(p.z+q.z+r.z+s.z)/4};
    const n=normal==='up'?[0,1,0]:normal==='down'?[0,-1,0]:normalOut(mean);
    quad(out,vec(p,p.y),vec(q,q.y),vec(r,r.y),vec(s,s.y),n);
  }
}
function radialFace(out,tier,fraction,low,high,extra=0){
  for(let i=0;i<SEGMENTS;i++){
    const a=i*TAU/SEGMENTS,b=(i+1)*TAU/SEGMENTS;
    const p=ringPoint(tier,a,fraction,extra),q=ringPoint(tier,b,fraction,extra);
    const n=normalOut({x:(p.x+q.x)/2,z:(p.z+q.z)/2});
    quad(out,vec(p,p.y+low),vec(q,q.y+low),vec(q,q.y+high),vec(p,p.y+high),n);
  }
}
function betweenDecks(out,innerTier,outerTier,elevation){
  const from=a=>({...ringPoint(innerTier,a,1),y:elevation});
  const to=a=>({...ringPoint(outerTier,a,0),y:elevation});
  ringStrip(out,from,to,'up');
}

export function buildSchottensteinArchitecture(model){
  if(!model?.sectionFootprints?.length||!model?.seatingRows?.length)return null;
  const decks=[],fascias=[],concourse=[],facade=[],glazing=[],trim=[],aisles=[],stepEdges=[];
  // Geometry must follow the actual generated row spans, not an unrelated
  // radial surface. The old whole-bowl mesh crossed chart aisle boundaries
  // and made chairs appear detached from irregular section elevations.
  // Treads are individual horizontal landings with a proper inward riser.
  const treadRows=model.seatingRows.filter(row=>row.tier===1||row.tier===2);
  const rowPoint=(row,t)=>{
    const x=row.left.x+(row.right.x-row.left.x)*t;
    const z=row.left.z+(row.right.z-row.left.z)*t;
    const y=schottensteinDeckHeight(row.tier,{x,z});
    return {x,z,y};
  };
  for(const row of treadRows){
    if(!(row.width>.35&&row.depth>.12))continue;
    const strips=Math.max(8,Math.ceil(row.width/.62));
    const outward={x:-Math.sin(row.yaw),z:-Math.cos(row.yaw)};
    const depth=clamp(row.depth,.62,1.12);
    const front=depth*.46,back=depth*.48;
    const rise=clamp(row.tier===2?.59:.37,.14,.68);
    for(let i=0;i<strips;i++){
      const a=rowPoint(row,i/strips),b=rowPoint(row,(i+1)/strips);
      // Each tessellated lateral strip is anchored to the seat height in
      // exactly the same section. Neither slope nor a generic annulus is
      // allowed to bridge a missing seat run.
      const p=(v,d,y=v.y-.15)=>[v.x+outward.x*d,y,v.z+outward.z*d];
      const innerA=p(a,-front),innerB=p(b,-front);
      const outerA=p(a,back),outerB=p(b,back);
      quad(decks,innerA,innerB,outerB,outerA,[0,1,0]);
      // The low face is placed on the aisle-facing edge, below this row's
      // seat height, and never rises across the visible seating surface.
      const downA=p(a,-front,a.y-.15-rise);
      const downB=p(b,-front,b.y-.15-rise);
      const inward=[-outward.x,0,-outward.z];
      quad(fascias,innerA,innerB,downB,downA,inward);
    }
  }
  // Only the two global level fronts need a continuous trim. Occupied rows
  // remain separate, with the real mapped section gaps preserved.
  for(const tier of [1,2]) radialFace(fascias,tier,0,-.68,-.18);
  // Walkable terraces bridge tier interruptions and expose an open bowl.
  betweenDecks(concourse,0,1,6.65);
  betweenDecks(concourse,1,2,13.45);
  for(const [tier,level] of [[1,7.10],[2,14.00]]){
    const from=a=>{
      const p=ringPoint(tier,a,0,-.13);
      return {...p,y:level-.37};
    };
    const to=a=>({...from(a),y:level+.24});
    ringStrip(fascias,from,to,'out');
  }
  // Articulated exterior cladding with three window courses, narrow columns
  // and top crown. The outside wall is beyond the rear-seat clearance.
  const outer=a=>ringPoint(2,a,1,.50);
  const facadeHeight=a=>clamp(outer(a).y-.62,20.2,29.3);
  for(let i=0;i<SEGMENTS;i++){
    const a=i*TAU/SEGMENTS,b=(i+1)*TAU/SEGMENTS;
    const p=outer(a),q=outer(b),n=normalOut({x:(p.x+q.x)/2,z:(p.z+q.z)/2});
    const topA=facadeHeight(a),topB=facadeHeight(b);
    for(const [lo,hi] of [[0,2.30],[3.40,9.10],[11.30,17.10],[19.00,20.20]]){
      const ya=clamp(hi,lo,topA),yb=clamp(hi,lo,topB);
      if(ya<=lo||yb<=lo)continue;
      quad(facade,vec(p,lo),vec(q,lo),vec(q,yb),vec(p,ya),n);
    }
    for(const [lo,hi] of [[2.36,3.32],[9.18,11.22],[17.18,18.92]]){
      if(topA<hi||topB<hi)continue;
      if(i%11===0||i%11===1){
        quad(facade,vec(p,lo),vec(q,lo),vec(q,hi),vec(p,hi),n);
      }else{
        const inset=.055;
        const project=r=>({x:r.x+n[0]*inset,z:r.z+n[2]*inset});
        quad(glazing,vec(project(p),lo),vec(project(q),lo),vec(project(q),hi),vec(project(p),hi),n);
      }
    }
    if(Math.min(topA,topB)>20.22)
      quad(facade,vec(p,20.18),vec(q,20.18),vec(q,topB),vec(p,topA),n);
    if(i%8===0){
      const pp={x:p.x+n[0]*.10,z:p.z+n[2]*.10};
      const qq={x:q.x+n[0]*.10,z:q.z+n[2]*.10};
      quad(trim,vec(pp,.12),vec(qq,.12),vec(qq,Math.min(topB,topA)),vec(pp,Math.min(topB,topA)),n);
    }
  }
  // Fine cornices tie the facade to the three seating elevations.
  for(const [tier,fraction,yoffset] of [[0,1,.05],[1,1,.05],[2,1,.05]]){
    const from=a=>{
      const p=ringPoint(tier,a,fraction,.06);
      return {...p,y:p.y+yoffset};
    };
    const to=a=>{
      const p=ringPoint(tier,a,fraction,.53);
      return {...p,y:p.y+yoffset};
    };
    ringStrip(trim,from,to,'up');
  }
  // Fit each staircase to a vacant corridor between traced sections.
  // A row contributes one level tread and one visible riser (not a sloped
  // white ribbon). No step is accepted over a selectable chair.
  const byTier=new Map([1,2].map(t=>[t,model.seats.filter(s=>s.tier===t)]));
  const cellSize=1.0;
  const hashes=new Map();
  for(const [tier,seats] of byTier){
    const hash=new Map();
    for(const seat of seats){
      const key=Math.floor(seat.x/cellSize)+','+Math.floor(seat.z/cellSize);
      if(!hash.has(key))hash.set(key,[]);
      hash.get(key).push(seat);
    }
    hashes.set(tier,hash);
  }
  const conflict=(tier,p,clearance=.55)=>{
    const hash=hashes.get(tier);
    const x=Math.floor(p.x/cellSize),z=Math.floor(p.z/cellSize);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
      for(const seat of hash.get((x+dx)+','+(z+dz))??[]){
        if(Math.hypot(p.x-seat.x,p.z-seat.z)<clearance
          &&Math.abs(p.y-seat.y)<1.6)return true;
      }
    return false;
  };
  const angleOf=s=>{
    const pts=s.outlines.flat();
    const x=pts.reduce((sum,p)=>sum+p.x,0)/pts.length;
    const z=pts.reduce((sum,p)=>sum+p.z,0)/pts.length;
    return (Math.atan2(z,x)+TAU)%TAU;
  };
  for(const tier of [1,2]){
    const centers=model.sectionFootprints.filter(s=>s.tier===tier)
      .map(angleOf).sort((a,b)=>a-b);
    const maxSlots=Math.max(...model.sectionFootprints.filter(s=>s.tier===tier).map(s=>s.depthRows));
    // Try several offsets. The winner maximizes clear individual steps.
    // Unlike the old algorithm, any step touching a chair is omitted.
    const widths=.34;
    const sectionSteps=[];
    for(let i=0;i<centers.length;i++){
      const next=i+1<centers.length?centers[i+1]:centers[0]+TAU;
      const midway=(centers[i]+next)/2;
      let selected=null,best=-1;
      for(let offset=-.072;offset<=.07201;offset+=.012){
        const angle=midway+offset,valid=[];
        for(let j=0;j<maxSlots;j++){
          const u=j/maxSlots,v=(j+1)/maxSlots;
          const center=ringPoint(tier,angle,(u+v)/2);
          const inner=ringPoint(tier,angle,u);
          const outer=ringPoint(tier,angle,v);
          const tangent={x:-Math.sin(angle),z:Math.cos(angle)};
          const clearance=[center,inner,outer].every(p=>
            !conflict(tier,p,.50)&&!conflict(tier,{x:p.x+tangent.x*width,z:p.z+tangent.z*width,y:p.y},.34)
              &&!conflict(tier,{x:p.x-tangent.x*width,z:p.z-tangent.z*width,y:p.y},.34));
          valid.push(clearance);
        }
        const score=valid.reduce((count,yes)=>count+(yes?1:0),0);
        if(score>best){best=score;selected={angle,valid};}
      }
      if(!selected||best===0)continue;
      for(let j=0;j<maxSlots;j++){
        if(!selected.valid[j])continue;
        const {angle}=selected,u=j/maxSlots,v=(j+1)/maxSlots;
        const low=ringPoint(tier,angle,u),high=ringPoint(tier,angle,v);
        const mid=ringPoint(tier,angle,(u+v)/2);
        const y=mid.y-.10;
        const tangent={x:-Math.sin(angle),z:Math.cos(angle)};
        const corner=(p,sign,height)=>[p.x+sign*tangent.x*width,height,p.z+sign*tangent.z*width];
        // A flat tread with a contrasting vertical riser at its inner edge.
        const a=corner(low,-1,y),b=corner(low,1,y);
        const c=corner(high,1,y),d=corner(high,-1,y);
        quad(aisles,a,b,c,d,[0,1,0]);
        const previous=ringPoint(tier,angle,Math.max(0,(j-.5)/maxSlots));
        const bottom=y-clamp(mid.y-previous.y,.13,.65);
        quad(stepEdges,a,b,corner(low,1,bottom),corner(low,-1,bottom),
          [-Math.cos(angle),0,-Math.sin(angle)]);
      }
    }
  }
  return Object.fromEntries(Object.entries({decks,fascias,concourse,facade,glazing,trim,aisles,stepEdges})
    .map(([key,list])=>[key,new Float32Array(list)]));
}
