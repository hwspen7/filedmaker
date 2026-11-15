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


/**
 * Schematic exit portals in gaps between the upper-bowl chart sections.
 * Labels are illustrative, NOT confirmed Ohio State exit designations.
 * They do not alter any seats or verified circulation features.
 */
export function buildSchottensteinExitMarkers(model){
  const blocks=(model?.sectionFootprints??[]).filter(block=>block.tier===2);
  if(!blocks.length)return [];
  const centers=blocks.map(block=>{
    const pts=block.outlines.flat();
    const x=pts.reduce((sum,p)=>sum+p.x,0)/pts.length;
    const z=pts.reduce((sum,p)=>sum+p.z,0)/pts.length;
    return (Math.atan2(z,x)+TAU)%TAU;
  }).sort((a,b)=>a-b);
  const gaps=centers.map((c,i)=>{
    const next=i+1<centers.length?centers[i+1]:centers[0]+TAU;
    return (c+(next-c)/2)%TAU;
  });
  const chosen=new Set(),output=[];
  const distance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  for(let i=0;i<12&&i<gaps.length;i++){
    const ideal=(i+.5)*TAU/12;
    let best=-1,score=Infinity;
    for(let j=0;j<gaps.length;j++){
      if(chosen.has(j))continue;
      const d=distance(gaps[j],ideal);
      if(d<score){best=j;score=d;}
    }
    if(best<0)continue;
    chosen.add(best);
    const angle=gaps[best],anchor=ringPoint(2,angle,1,.32);
    const number=String(output.length+1).padStart(2,'0');
    output.push({id:'EX-'+number,number,
      label:'EXIT '+number,angle,
      x:anchor.x,y:anchor.y+2.10,z:anchor.z,
      verified:false});
  }
  return output;
}

export function buildSchottensteinArchitecture(model){
  if(!model?.sectionFootprints?.length||!model?.seatingRows?.length)return null;
  const decks=[],fascias=[],concourse=[],facade=[],glazing=[],trim=[],aisles=[],stepEdges=[],crown=[],signs=[],exitLights=[],exitGlyphs=[];
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

  // The upper bowl terminates in a solid, two-sided arena wall. Its bottom
  // follows the traced upper tier and joins the exterior cladding. A narrow
  // coping closes the wall: there is NO free-standing white crown ribbon.
  const exits=buildSchottensteinExitMarkers(model);
  const innerOffset=.38,outerOffset=.94;
  const wallPoint=(angle,offset,height)=>{
    const base=ringPoint(2,angle,1,offset);
    return [base.x,base.y+height,base.z];
  };
  const inward=angle=>[-Math.cos(angle),0,-Math.sin(angle)];
  const outward=angle=>[Math.cos(angle),0,Math.sin(angle)];
  const angularDistance=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const paintWall=(out,a,b,ra,rb,lo,hi,normal)=>{
    quad(out,wallPoint(a,ra,lo),wallPoint(b,rb,lo),
      wallPoint(b,rb,hi),wallPoint(a,ra,hi),normal);
  };
  for(let i=0;i<SEGMENTS;i++){
    const a=i*TAU/SEGMENTS,b=(i+1)*TAU/SEGMENTS,m=(a+b)/2;
    const inside=inward(m),outside=outward(m);
    const portal=exits.some(exitMarker=>Math.abs(angularDistance(m,exitMarker.angle))<.024);
    // Inner, outer and capped faces form real wall volume; the openings are
    // recessed into the inner face, never laid across occupied seat rows.
    if(!portal){
      paintWall(crown,a,b,innerOffset,innerOffset,-.48,3.34,inside);
      if(i%18>=4&&i%18<=13){
        paintWall(glazing,a,b,innerOffset-.024,innerOffset-.024,2.62,3.12,inside);
      }
    }else{
      paintWall(crown,a,b,innerOffset,innerOffset,1.82,3.34,inside);
      paintWall(glazing,a,b,innerOffset+.068,innerOffset+.068,-.43,1.82,inside);
      paintWall(signs,a,b,innerOffset-.045,innerOffset-.045,1.88,2.46,inside);
      // A small red lamp identifies the opening without claiming an
      // architectural or code-compliant exit installation.
      const c=m,delta=Math.min(.006,(b-a)*.20);
      paintWall(exitLights,c-delta,c+delta,innerOffset-.061,innerOffset-.061,1.77,1.88,inward(c));
    }
    paintWall(crown,a,b,outerOffset,outerOffset,-.50,3.34,outside);
    quad(crown,wallPoint(a,innerOffset,3.34),wallPoint(b,innerOffset,3.34),
      wallPoint(b,outerOffset,3.34),wallPoint(a,outerOffset,3.34),[0,1,0]);
    // Thin charcoal coping / cornice rather than a tall white parapet.
    quad(trim,wallPoint(a,innerOffset-.045,3.37),wallPoint(b,innerOffset-.045,3.37),
      wallPoint(b,outerOffset+.055,3.37),wallPoint(a,outerOffset+.055,3.37),[0,1,0]);
    if(i%12===0){
      paintWall(trim,a,b,innerOffset-.031,innerOffset-.031,-.48,3.32,inside);
    }
  }
  // Intentionally no generated stair treads or radial stair ribbons.
  // The actual empty aisles remain visible between the mapped seat banks.
  // Geometry-backed lettering belongs to the wall, not to a floating UI badge.
  // The 5x7 strokes are two-sided through correct triangle winding and remain
  // legible from spectator positions even when HTML area labels are hidden.
  const font={
    E:['11111','10000','10000','11110','10000','10000','11111'],
    X:['10001','01010','00100','00100','00100','01010','10001'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
    T:['11111','00100','00100','00100','00100','00100','00100'],
    '0':['01110','10001','10011','10101','11001','10001','01110'],
    '1':['00100','01100','00100','00100','00100','00100','01110'],
    '2':['01110','10001','00001','00010','00100','01000','11111'],
    '3':['11110','00001','00001','01110','00001','00001','11110'],
    '4':['00010','00110','01010','10010','11111','00010','00010'],
    '5':['11111','10000','10000','11110','00001','00001','11110'],
    '6':['01110','10000','10000','11110','10001','10001','01110'],
    '7':['11111','00001','00010','00100','01000','01000','01000'],
    '8':['01110','10001','10001','01110','10001','10001','01110'],
    '9':['01110','10001','10001','01111','00001','00001','01110']
  };
  for(const marker of exits){
    const angle=marker.angle,normal=inward(angle);
    const tangent=[Math.sin(angle),-Math.cos(angle)];
    const wall=ringPoint(2,angle,1,innerOffset-.078);
    const pixel=.029,advance=pixel*6;
    const line=(label,top)=>{
      const span=label.length*advance-pixel;
      for(let index=0;index<label.length;index++){
        const glyph=font[label[index]];
        if(!glyph)continue;
        for(let r=0;r<7;r++)for(let c=0;c<5;c++){
          if(glyph[r][c]!=='1')continue;
          const left=index*advance+c*pixel-span/2, right=left+pixel*.89;
          const upper=top-r*pixel,lower=upper-pixel*.92;
          const onWall=(x,y)=>[
            wall.x+tangent[0]*x,y,wall.z+tangent[1]*x
          ];
          quad(exitGlyphs,onWall(left,lower),onWall(right,lower),
            onWall(right,upper),onWall(left,upper),normal);
        }
      }
    };
    line('EXIT',wall.y+2.43);
    line(marker.number,wall.y+2.15);
  }
  return Object.fromEntries(Object.entries({decks,fascias,concourse,facade,glazing,trim,aisles,stepEdges,crown,signs,exitLights,exitGlyphs})
    .map(([key,list])=>[key,new Float32Array(list)]));
}
