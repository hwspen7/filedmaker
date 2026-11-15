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
  // Upper and club tier surfaces share the analytic rake of the selectable
  // seats. The lower bowl uses the existing individual row treads because
  // its chart-derived per-section elevations are not one global surface.
  for(const tier of [1,2]){
    for(let i=0;i<SEGMENTS;i++){
      const a=i*TAU/SEGMENTS,b=(i+1)*TAU/SEGMENTS;
      for(let j=0;j<BANDS;j++){
        const u=j/BANDS,v=(j+1)/BANDS;
        const pa=ringPoint(tier,a,u),pb=ringPoint(tier,b,u);
        const pc=ringPoint(tier,b,v),pd=ringPoint(tier,a,v);
        const height=[pa,pb,pc,pd].map(p=>p.y-.18);
        const nearR=(radius(pa)+radius(pb))/2,farR=(radius(pc)+radius(pd))/2;
        const grade=((height[2]+height[3])-(height[0]+height[1]))/2/Math.max(.5,farR-nearR);
        const mid=(a+b)/2;
        const n=normalize([-grade*Math.cos(mid),1,-grade*Math.sin(mid)]);
        quad(decks,vec(pa,height[0]),vec(pb,height[1]),vec(pc,height[2]),vec(pd,height[3]),n);
      }
    }
    // Proper riser depth at the front and rear, never a ground-to-seat sheet.
    radialFace(fascias,tier,0,-.82,-.16);
    radialFace(fascias,tier,1,-.50,-.14);
  }
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
  // Regularized stair ribbons follow the actual gaps between sections.
  // Search nearby rays and reject candidates that cross existing chairs.
  const seatsByTier=[0,1,2].map(tier=>model.seats.filter(s=>s.tier===tier));
  const angleOf=s=>{
    const points=s.outlines.flat();
    const x=points.reduce((sum,p)=>sum+p.x,0)/points.length;
    const z=points.reduce((sum,p)=>sum+p.z,0)/points.length;
    return (Math.atan2(z,x)+TAU)%TAU;
  };
  for(const tier of [1,2]){
    const centers=model.sectionFootprints.filter(s=>s.tier===tier)
      .map(angleOf).sort((a,b)=>a-b);
    const tierSeats=seatsByTier[tier];
    for(let i=0;i<centers.length;i++){
      const next=i+1<centers.length?centers[i+1]:centers[0]+TAU;
      const target=(centers[i]+next)/2;
      const score=angle=>tierSeats.reduce((sum,seat)=>{
        const radial=Math.hypot(seat.x,seat.z);
        const across=Math.abs(seat.x*Math.sin(angle)-seat.z*Math.cos(angle));
        return sum+(radial>8&&across<.43?1:0);
      },0);
      let selected=target,least=Infinity;
      for(let j=-7;j<=7;j++){
        const candidate=target+j*.009;
        const count=score(candidate);
        if(count<least){least=count;selected=candidate;}
      }
      if(least>3)continue;
      const at=(depth,offset,above=.01)=>{
        const p=ringPoint(tier,selected,depth);
        return [p.x-offset*Math.sin(selected),p.y-.18+above,p.z+offset*Math.cos(selected)];
      };
      const steps=tier===1?12:22;
      for(let j=0;j<steps;j++){
        const u=j/steps,v=(j+1)/steps;
        quad(aisles,at(u,-.43),at(u,.43),at(v,.43),at(v,-.43),[0,1,0]);
        const end=Math.max(u,v-.008);
        quad(stepEdges,at(end,-.44,.024),at(end,.44,.024),at(v,.44,.024),at(v,-.44,.024),[0,1,0]);
      }
    }
  }
  return Object.fromEntries(Object.entries({decks,fascias,concourse,facade,glazing,trim,aisles,stepEdges})
    .map(([key,list])=>[key,new Float32Array(list)]));
}
