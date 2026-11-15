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
  const decks=[],fascias=[],concourse=[],facade=[],glazing=[],trim=[],aisles=[],stepEdges=[],backWall=[],galleryGlass=[],galleryGlow=[],windowFrames=[],pilasters=[],roofEdge=[],soffit=[],downlights=[];
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

  // Structural building volume: a seat-level concourse is enclosed by an
  // independent rear ring 5–6 m deep. This replaces the old zero-depth wall.
  const ROOF_Y=34.8;
  const rawR=Array.from({length:SEGMENTS},(_,i)=>
    radius(schottensteinDeckPoint(2,i*TAU/SEGMENTS,1)));
  const rimY=Array.from({length:SEGMENTS},(_,i)=>{
    const p=schottensteinDeckPoint(2,i*TAU/SEGMENTS,1);
    return schottensteinDeckHeight(2,p);
  });
  // Smooth the envelope without ever allowing the wall to run into the seats.
  // This removes the severe crown scalloping on the shorter press side.
  const envelope=rawR.map((_,i)=>{
    let r=0;
    for(let k=-4;k<=4;k++)r=Math.max(r,rawR[(i+k+SEGMENTS)%SEGMENTS]);
    return r;
  });
  const outerR=envelope.map((_,i)=>{
    let sum=0,weight=0;
    for(let k=-4;k<=4;k++){
      const w=5-Math.abs(k);
      sum+=w*envelope[(i+k+SEGMENTS)%SEGMENTS];
      weight+=w;
    }
    return Math.max(rawR[i]+1.04,sum/weight+.58);
  });
  const station=(index,offset,y)=>{
    const i=(index+SEGMENTS)%SEGMENTS,a=i*TAU/SEGMENTS;
    const r=outerR[i]+offset;
    return [r*Math.cos(a),y,r*Math.sin(a)];
  };
  const normalAt=i=>{
    const a=(i+.5)*TAU/SEGMENTS;
    return [Math.cos(a),0,Math.sin(a)];
  };
  const wallBand=(layer,i,offset,bottomA,bottomB,topA,topB,facing)=>{
    const j=(i+1)%SEGMENTS,n=normalAt(i).map(v=>facing==='in'?-v:v);
    if(topA<=bottomA||topB<=bottomB)return;
    quad(layer,station(i,offset,bottomA),station(j,offset,bottomB),
      station(j,offset,topB),station(i,offset,topA),n);
  };
  const horizontal=(layer,i,near,far,y,normal)=>{
    const j=(i+1)%SEGMENTS;
    quad(layer,station(i,near,y),station(j,near,y),
      station(j,far,y),station(i,far,y),[0,normal,0]);
  };
  // A real perimeter façade, rather than a gray thin shell laid behind the
  // seats. Vertical columns and inset glazing are separated by four bands.
  const externalWindowBands=[[3.35,4.55],[10.15,11.55],[18.12,19.72],[26.35,27.68]];
  const facadeOuter=5.55;
  for(let i=0;i<SEGMENTS;i++){
    const isPier=i%7===0;
    let bottom=0;
    for(const [lo,hi] of externalWindowBands){
      wallBand(facade,i,facadeOuter,bottom,bottom,lo,lo,'out');
      if(isPier)wallBand(facade,i,facadeOuter,lo,lo,hi,hi,'out');
      else wallBand(glazing,i,facadeOuter-.095,lo,lo,hi,hi,'out');
      bottom=hi;
    }
    wallBand(facade,i,facadeOuter,bottom,bottom,ROOF_Y-.44,ROOF_Y-.44,'out');
    if(i%7===0){
      wallBand(pilasters,i,facadeOuter+.15,.08,.08,ROOF_Y-.52,ROOF_Y-.52,'out');
    }
    for(const height of [4.65,11.65,19.82,27.80]){
      wallBand(trim,i,facadeOuter+.042,height,height,height+.13,height+.13,'out');
    }
  }
  // The building's roof is carried by the outer wall and deep interior
  // frames. It is an open-centre arena: only an annular gallery canopy, never
  // an opaque roof across the court or an orphan white stripe.
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


  // Multi-depth gallery: walkable rear circulation deck, recessed interior
  // glazing, substantial columns, a ceiling soffit and enclosing roof beam.
  // The upper silhouette is level even where the short press-side seating ends.
  const galleryFront=1.00,glassOffset=1.11,frameOffset=.995;
  const outerWall=facadeOuter,roofUnderside=ROOF_Y-.70,roofTop=ROOF_Y+.12;
  for(let i=0;i<SEGMENTS;i++){
    const j=(i+1)%SEGMENTS,baseA=rimY[i],baseB=rimY[j];
    const sillA=baseA+1.24,sillB=baseB+1.24;
    const headA=Math.min(baseA+3.70,ROOF_Y-1.40);
    const headB=Math.min(baseB+3.70,ROOF_Y-1.40);
    // Properly enclosed lower parapet, not a vertically extended coping.
    wallBand(backWall,i,galleryFront,baseA-.30,baseB-.30,sillA,sillB,'in');
    // Glazing is recessed behind the stone parapet. At structural bays it is
    // replaced by full-height columns, with actual voids between the members.
    const support=i%6===0;
    if(support){
      wallBand(pilasters,i,galleryFront-.05,sillA,sillB,headA,headB,'in');
    }else{
      wallBand(galleryGlass,i,glassOffset, sillA,sillB,headA,headB,'in');
      if(i%6===2||i%6===3){
        wallBand(galleryGlow,i,glassOffset-.022,sillA+.22,sillB+.22,
          headA-.18,headB-.18,'in');
      }
    }
    // Press-side reduction in upper seats creates a legitimate high rear
    // concourse; a second clerestory band gives it architectural rhythm.
    const highBay=Math.max(baseA,baseB)<26.5;
    const upperSill=ROOF_Y-3.38,upperHead=ROOF_Y-1.45;
    if(highBay){
      wallBand(backWall,i,galleryFront,headA,headB,
        Math.max(headA,upperSill),Math.max(headB,upperSill),'in');
      if(support)wallBand(pilasters,i,galleryFront-.05,upperSill,upperSill,
        upperHead,upperHead,'in');
      else wallBand(galleryGlass,i,glassOffset,upperSill,upperSill,
        upperHead,upperHead,'in');
      wallBand(backWall,i,galleryFront,upperHead,upperHead,roofUnderside,roofUnderside,'in');
    }else{
      wallBand(backWall,i,galleryFront,headA,headB,roofUnderside,roofUnderside,'in');
    }
    // Structural glazing frames (sill, header and mullions) sit IN FRONT
    // of the glass, giving the facade shadowable thickness.
    wallBand(windowFrames,i,frameOffset,sillA-.105,sillB-.105,sillA+.075,sillB+.075,'in');
    wallBand(windowFrames,i,frameOffset,headA-.08,headB-.08,headA+.09,headB+.09,'in');
    if(highBay){
      wallBand(windowFrames,i,frameOffset,upperSill-.095,upperSill-.095,
        upperSill+.08,upperSill+.08,'in');
      wallBand(windowFrames,i,frameOffset,upperHead-.08,upperHead-.08,
        upperHead+.09,upperHead+.09,'in');
    }
    // Real radial depth: a large concourse behind the upper seating, with
    // rooms and window bays separated by pilasters and covered by the soffit.
    const concourseY=Math.min(baseA,baseB)+.26;
    horizontal(concourse,i,galleryFront+.16,outerWall-.12,concourseY,1);
    // Continuous deep roof canopy, with a visible charcoal underside,
    // graphite edge beam and a light upper weather cap.
    horizontal(soffit,i,galleryFront-.70,outerWall+.32,roofUnderside,-1);
    horizontal(roofEdge,i,galleryFront-.70,outerWall+.32,roofTop,1);
    wallBand(roofEdge,i,galleryFront-.70,roofUnderside,roofUnderside,
      roofTop,roofTop,'in');
    wallBand(roofEdge,i,outerWall+.32,roofUnderside,roofUnderside,
      roofTop,roofTop,'out');
    if(i%6===0){
      // Column faces project into the gallery and link the lower parapet
      // to the roof beam; even at the press end this forms real volume.
      const a=i*TAU/SEGMENTS,off=.0045,near=galleryFront-.16,far=galleryFront+.48;
      const local=angle=>outerR[i]*1;
      const axis=(angle,offset,y)=>[(outerR[i]+offset)*Math.cos(angle),y,
        (outerR[i]+offset)*Math.sin(angle)];
      const p=a-off,q=a+off;
      const bottom=baseA-.28,top=roofUnderside;
      quad(pilasters,axis(p,near,bottom),axis(q,near,bottom),
        axis(q,near,top),axis(p,near,top),[-Math.cos(a),0,-Math.sin(a)]);
      quad(pilasters,axis(p,far,bottom),axis(q,far,bottom),
        axis(q,far,top),axis(p,far,top),[Math.cos(a),0,Math.sin(a)]);
      quad(pilasters,axis(p,near,top),axis(q,near,top),
        axis(q,far,top),axis(p,far,top),[0,1,0]);
      quad(pilasters,axis(p,far,bottom),axis(q,far,bottom),
        axis(q,near,bottom),axis(p,near,bottom),[0,-1,0]);
    }
    // Downlights are small real ceiling fittings, not pseudo text overlays.
    if(i%6===3){
      const mid=(i+.5)*TAU/SEGMENTS,rr=(outerR[i]+outerR[j])/2+galleryFront+.05;
      const x=rr*Math.cos(mid),z=rr*Math.sin(mid);
      const size=.15;
      quad(downlights,[x-size,roofUnderside-.018,z-size],
        [x+size,roofUnderside-.018,z-size],
        [x+size,roofUnderside-.018,z+size],
        [x-size,roofUnderside-.018,z+size],[0,-1,0]);
    }
  }
  // Synthetic EXIT graphics, glowing portal numbers and fabricated radial
  // staircases are intentionally absent. The map's genuine seat-free
  // circulation gaps remain untouched.
  return Object.fromEntries(Object.entries({decks,fascias,concourse,facade,glazing,trim,aisles,stepEdges,backWall,galleryGlass,galleryGlow,windowFrames,pilasters,roofEdge,soffit,downlights})
    .map(([key,list])=>[key,new Float32Array(list)]));
}
