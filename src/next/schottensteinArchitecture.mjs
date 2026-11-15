// Schottenstein Center architectural cutaway: reconstructed, not surveyed.
// All vertex coordinates are metres. Separate from ticket inventories and
// authoritative imported-XYZ seats.
import { SCHOTTENSTEIN_ROOF_EAVE, SCHOTTENSTEIN_TERRACE_RIM, schottensteinBuildingRadius, schottensteinDeckHeight, schottensteinDeckPoint } from '../schottensteinSeating.mjs';
import { ExteriorEngine } from './engines/exterior.mjs';
import { fitRearSeatEnvelope } from './engines/geometry.mjs';

const TAU=Math.PI*2;
const SEGMENTS=192;
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

// A narrow, genuinely structural perimeter cap follows the final occupied
// rows. The actual seat-level terrace slabs are generated separately below.
//
// Never span the entire seating bank with an analytic "upper bowl" sheet:
// the real chart includes reduced-height press sections and empty access
// wedges; a large continuous sheet covers those chairs in overview views.
function addUpperBowl(out,seats){
  const edge=fitRearSeatEnvelope(seats,{
    tier:2,segments:SEGMENTS,clearance:.38,spread:1
  });
  const heights=new Float64Array(SEGMENTS).fill(-Infinity);
  const furthest=new Float64Array(SEGMENTS).fill(-Infinity);
  const wrap=i=>(i+SEGMENTS)%SEGMENTS;
  for(const chair of seats){
    if(chair.tier!==2)continue;
    const angle=(Math.atan2(chair.z,chair.x)+TAU)%TAU;
    const index=wrap(Math.round(angle*SEGMENTS/TAU));
    const r=radius(chair);
    // Choose the height of the rear-most occupied chair at each station,
    // rather than the height of an unrelated radial stadium profile.
    for(let delta=-1;delta<=1;delta++){
      const j=wrap(index+delta);
      if(r>furthest[j]){
        furthest[j]=r;
        heights[j]=chair.y;
      }
    }
  }
  // Interpolate only genuinely unoccupied angular stations. Section aisle
  // breaks retain continuous concrete, not an arbitrary sawtooth edge.
  for(let i=0;i<SEGMENTS;i++){
    if(Number.isFinite(heights[i]))continue;
    let before=wrap(i-1),after=wrap(i+1);
    while(!Number.isFinite(heights[before]))before=wrap(before-1);
    while(!Number.isFinite(heights[after]))after=wrap(after+1);
    const total=wrap(after-before),fraction=total?wrap(i-before)/total:0;
    heights[i]=heights[before]*(1-fraction)+heights[after]*fraction;
  }
  // Smooth elevation transitions through the short press-side banks without
  // changing any chair, tier height or aisle. An abrupt step in the rear wall
  // would look like the old broken bowl lip.
  const y=Array.from({length:SEGMENTS},(_,i)=>{
    let sum=0,weight=0;
    for(let d=-4;d<=4;d++){
      const w=5-Math.abs(d);
      sum+=heights[wrap(i+d)]*w;
      weight+=w;
    }
    return sum/weight;
  });
  // Closed six-sided cross-section: narrow seat-support lip, court-facing
  // parapet, real cap thickness, external wall and underside. All points
  // remain OUTSIDE the occupied chair footprint.
  const sections=Array.from({length:SEGMENTS},(_,i)=>{
    const a=i*TAU/SEGMENTS,r=edge.radii[i],base=y[i]-.16;
    const p=(offset,height)=>[(r+offset)*Math.cos(a),height,(r+offset)*Math.sin(a)];
    return [
      p(-.13,base),
      p(0,base),
      p(0,base+.88),
      p(.26,base+.88),
      p(.26,base-.39),
      p(-.13,base-.39)
    ];
  });
  const vertices=sections.map((section,i)=>section.map((point,k)=>{
    const before=sections[wrap(i-1)][k],after=sections[wrap(i+1)][k];
    const previous=section[(k+section.length-1)%section.length];
    const next=section[(k+1)%section.length];
    const incoming=normalize(subtract(point,previous));
    const outgoing=normalize(subtract(next,point));
    const across=incoming.map((v,axis)=>v+outgoing[axis]);
    return [...point,...normalize(cross(subtract(after,before),across))];
  }));
  for(let i=0;i<SEGMENTS;i++){
    const a=vertices[i],b=vertices[wrap(i+1)];
    for(let k=0;k<a.length;k++){
      const l=(k+1)%a.length;
      out.push(...a[k],...b[k],...b[l],...a[k],...b[l],...a[l]);
    }
  }
}

export function buildSchottensteinArchitecture(model){
  if(!model?.sectionFootprints?.length||!model?.seatingRows?.length)return null;
  const decks=[],fascias=[],upperBowl=[],concourse=[],facade=[],glazing=[],trim=[],aisles=[],stepEdges=[],backWall=[],galleryGlass=[],galleryGlow=[],windowFrames=[],pilasters=[],roofEdge=[],soffit=[],downlights=[],roofDeck=[],radialBeams=[],buildingRoof=[],entryMasonry=[],entryGlass=[],pressWalls=[],pressGlass=[],cutawayFacade=[],externalTrim=[],galleryFloorMesh=[];
  addUpperBowl(upperBowl,model.seats);
  // Geometry must follow the actual generated row spans, not an unrelated
  // radial surface. The old whole-bowl mesh crossed chart aisle boundaries
  // and made chairs appear detached from irregular section elevations.
  // Treads are individual horizontal landings with a proper inward riser.
  const treadRows=model.seatingRows.filter(row=>row.tier===1||row.tier===2);
  const heightBySlot=new Map(treadRows.map(row=>[row.sectionId+':'+row.slot,row.y]));
  const rowPoint=(row,t)=>{
    const x=row.left.x+(row.right.x-row.left.x)*t;
    const z=row.left.z+(row.right.z-row.left.z)*t;
    return {x,z,y:row.y};
  };
  for(const row of treadRows){
    if(!(row.width>.35&&row.depth>.12))continue;
    const strips=Math.max(8,Math.ceil(row.width/.62));
    const outward={x:-Math.sin(row.yaw),z:-Math.cos(row.yaw)};
    const depth=row.depth;
    const front=depth*.5,back=depth*.5;
    const tangent=normalize([row.right.x-row.left.x,0,row.right.z-row.left.z]);
    const previous=heightBySlot.get(row.sectionId+':'+(row.slot-1));
    const rise=clamp(previous===undefined?(row.tier===2?.66:.40):row.y-previous,.14,.72)+.04;
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
      // Close the aisle-facing ends with the same nosing and riser depth.
      if(i===0)quad(fascias,innerA,outerA,p(a,back,a.y-.15-rise),downA,tangent.map(v=>-v));
      if(i===strips-1)quad(fascias,innerB,outerB,p(b,back,b.y-.15-rise),downB,tangent);
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
  const outerR=Array.from({length:SEGMENTS},(_,i)=>schottensteinBuildingRadius(i*TAU/SEGMENTS));
  const chairEdge=Array(SEGMENTS).fill(null);
  for(const seat of model.seats){
    if(seat.tier!==2)continue;
    const station=Math.floor((Math.atan2(seat.z,seat.x)/TAU+1)*SEGMENTS)%SEGMENTS;
    for(let d=-1;d<=2;d++){
      const i=(station+d+SEGMENTS)%SEGMENTS;
      if(!chairEdge[i]||radius(seat)>radius(chairEdge[i]))chairEdge[i]=seat;
    }
  }
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
  // The real arena is clad in horizontal light metal panels above a brick
  // entrance level, with glazed brick rotundas at the main approaches.
  // The shared ExteriorEngine generates those building elements from a
  // venue-specific configuration. Seating and inner circulation stay intact.
  const facadeOuter=5.55;
  const exterior=ExteriorEngine.build({
    footprint:angle=>{
      const r=schottensteinBuildingRadius(angle)+facadeOuter;
      return {x:r*Math.cos(angle),z:r*Math.sin(angle)};
    },
    height:SCHOTTENSTEIN_ROOF_EAVE-.44,
    segments:SEGMENTS,
    profile:'metal-and-brick',
    entrances:[
      {angle:TAU*.125,role:'primary'},
      {angle:TAU*.375,role:'secondary'},
      {angle:TAU*.625,role:'secondary'},
      {angle:TAU*.875,role:'secondary'}
    ]
  });
  for(const vertex of exterior.metalPanels)facade.push(vertex);
  for(const vertex of exterior.baseWindows)glazing.push(vertex);
  for(const vertex of exterior.metalSeams)externalTrim.push(vertex);
  for(const vertex of exterior.towerBrick)entryMasonry.push(vertex);
  for(const vertex of exterior.towerWindows)entryGlass.push(vertex);
  const brickBase=[...exterior.brickBase],brickPiers=[...exterior.brickPiers],
    towerFrames=[...exterior.towerFrames],towerCrown=[...exterior.towerCrown],
    towerRibs=[...exterior.towerRibs],entryBrick=[...exterior.entryBrick],
    entryCurtain=[...exterior.entryCurtain],entryFrames=[...exterior.entryFrames],
    entryCanopy=[...exterior.entryCanopy],entryDoors=[...exterior.entryDoors];
  // The low perimeter still exists for the original interior cutaway view;
  // it is not a second solid outer wall in the enclosed building view.
  for(let i=0;i<SEGMENTS;i++){
    wallBand(cutawayFacade,i,facadeOuter,0,0,2.85,2.85,'out');
  }
  // The building's roof is carried by the outer wall and deep interior
  // frames. It is an open-centre arena: only an annular gallery canopy, never
  // an opaque roof across the court or an orphan white stripe.
  // Fine cornices tie the facade to the three seating elevations.
  for(const [tier,fraction,yoffset] of [[0,1,.05],[1,1,.05]]){
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
  const outerWall=facadeOuter,roofUnderside=SCHOTTENSTEIN_ROOF_EAVE-.70,roofTop=SCHOTTENSTEIN_ROOF_EAVE+.12;
  const galleryFloor=SCHOTTENSTEIN_TERRACE_RIM.rear+.55;
  const sill=galleryFloor+.94,head=sill+3.15;
  const clerestorySill=roofUnderside-2.15,clerestoryHead=roofUnderside-.82;
  const treadEdge=i=>{
    const seat=chairEdge[i];
    return station(i,radius(seat)+.35-outerR[i],seat.y-.20);
  };
  for(let i=0;i<SEGMENTS;i++){
    const j=(i+1)%SEGMENTS;
    // Properly enclosed lower parapet, not a vertically extended coping.
    wallBand(backWall,i,galleryFront,galleryFloor-.32,galleryFloor-.32,sill,sill,'in');
    // Glazing is recessed behind the stone parapet. At structural bays it is
    // replaced by full-height columns, with actual voids between the members.
    const support=i%6===0;
    if(support){
      wallBand(pilasters,i,galleryFront-.05,sill,sill,head,head,'in');
    }else{
      wallBand(galleryGlass,i,glassOffset, sill,sill,head,head,'in');
      if(i%6===2||i%6===3){
        wallBand(galleryGlow,i,glassOffset-.022,sill+.22,sill+.22,
          head-.18,head-.18,'in');
      }
    }
    wallBand(backWall,i,galleryFront,head,head,clerestorySill,clerestorySill,'in');
    wallBand(support?pilasters:galleryGlass,i,support?galleryFront-.05:glassOffset,
      clerestorySill,clerestorySill,clerestoryHead,clerestoryHead,'in');
    wallBand(backWall,i,galleryFront,clerestoryHead,clerestoryHead,roofUnderside,roofUnderside,'in');
    wallBand(windowFrames,i,frameOffset,sill-.105,sill-.105,sill+.075,sill+.075,'in');
    wallBand(windowFrames,i,frameOffset,head-.08,head-.08,head+.09,head+.09,'in');
    horizontal(galleryFloorMesh,i,galleryFront,outerWall,galleryFloor,1);
    horizontal(soffit,i,galleryFront,outerWall,galleryFloor-.32,-1);
    if(chairEdge[i]&&chairEdge[j]){
      const a=treadEdge(i),b=treadEdge(j);
      // Short press sections are served at the lower level, separate from
      // the upper landing.
      if(Math.abs(a[1]-galleryFloor)<.9&&Math.abs(b[1]-galleryFloor)<.9){
        quad(galleryFloorMesh,a,b,station(j,galleryFront,galleryFloor),
          station(i,galleryFront,galleryFloor),[0,1,0]);
      }
    }
    // Continuous deep roof canopy, with a visible charcoal underside,
    // graphite edge beam and a light upper weather cap.
    horizontal(soffit,i,galleryFront-.70,outerWall+.32,roofUnderside,-1);
    horizontal(roofDeck,i,galleryFront-.70,outerWall+.32,roofTop,1);
    wallBand(roofEdge,i,galleryFront-.70,roofUnderside,roofUnderside,
      roofTop,roofTop,'in');
    wallBand(roofEdge,i,outerWall+.32,roofUnderside,roofUnderside,
      roofTop,roofTop,'out');
    if(i%6===0){
      // Column faces project into the gallery and link the lower parapet
      // to the roof beam; even at the press end this forms real volume.
      const a=i*TAU/SEGMENTS,off=.0045,near=galleryFront-.16,far=galleryFront+.48;
      const axis=(angle,offset,y)=>[(outerR[i]+offset)*Math.cos(angle),y,
        (outerR[i]+offset)*Math.sin(angle)];
      const p=a-off,q=a+off;
      const bottom=galleryFloor-.32,top=roofUnderside;
      const beamTop=roofUnderside+.035,beamBottom=roofUnderside-.39;
      // Exposed radial structural ribs connect the inner gallery columns
      // to the external wall. Both web faces and the soffit have real depth.
      const inside=galleryFront-.70,outside=outerWall+.26;
      const beam=(angle,offset,height)=>[
        (outerR[i]+offset)*Math.cos(angle),height,
        (outerR[i]+offset)*Math.sin(angle)
      ];
      const tangent=[-Math.sin(a),0,Math.cos(a)];
      quad(radialBeams,beam(p,inside,beamBottom),beam(p,outside,beamBottom),
        beam(p,outside,beamTop),beam(p,inside,beamTop),tangent);
      quad(radialBeams,beam(q,inside,beamBottom),beam(q,outside,beamBottom),
        beam(q,outside,beamTop),beam(q,inside,beamTop),tangent.map(v=>-v));
      quad(radialBeams,beam(p,inside,beamBottom),beam(q,inside,beamBottom),
        beam(q,outside,beamBottom),beam(p,outside,beamBottom),[0,-1,0]);
      // Fine panel-joint lines prevent the upper roof from reading as a
      // featureless single-color collar around the arena.
      const seamY=roofTop+.013;
      quad(roofEdge,beam(p,inside,seamY),beam(q,inside,seamY),
        beam(q,outside,seamY),beam(p,outside,seamY),[0,1,0]);
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
  // Deliberately open roof: the arena wall, eaves and gallery canopy remain,
  // while the central opaque lid is absent in every rendering and export.

  // Model the mapped press enclosure at its own lower elevation. Its
  // outline reserves the existing seat-free area in the seating model.
  const press=model.features?.find(feature=>feature.kind==='press');
  if(press?.outline?.length>=3){
    const low=press.y-.16,high=low+2.55;
    const outline=press.outline;
    const near=Math.min(...outline.map(p=>p.x));
    for(let i=0;i<outline.length;i++){
      const a=outline[i],b=outline[(i+1)%outline.length];
      const dx=b.x-a.x,dz=b.z-a.z;
      const outward=[dz,0,-dx];
      const layer=Math.abs((a.x+b.x)/2-near)<.65?pressGlass:pressWalls;
      quad(layer,vec(a,low),vec(b,low),vec(b,high),vec(a,high),outward);
    }
    for(let i=1;i<outline.length-1;i++){
      face(pressWalls,vec(outline[0],high),vec(outline[i],high),vec(outline[i+1],high),[0,1,0]);
    }
  }
  // Synthetic EXIT graphics, glowing portal numbers and fabricated radial
  // staircases are intentionally absent. The map's genuine seat-free
  // circulation gaps remain untouched.
  return Object.fromEntries(Object.entries({decks,fascias,upperBowl,concourse,facade,glazing,trim,aisles,stepEdges,backWall,galleryGlass,galleryGlow,windowFrames,pilasters,roofEdge,soffit,downlights,roofDeck,radialBeams,buildingRoof,entryMasonry,entryGlass,pressWalls,pressGlass,cutawayFacade,externalTrim,galleryFloorMesh,brickBase,brickPiers,towerFrames,towerCrown,towerRibs,entryBrick,entryCurtain,entryFrames,entryCanopy,entryDoors})
    .map(([key,list])=>[key,new Float32Array(list)]));
}
