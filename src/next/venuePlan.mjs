// Standalone, source-aware venue geometry plan. Metres throughout.
// The plan is renderer-independent and never invents official ticket inventory.
import { seatColor, seatKind } from '../seatPresentation.mjs';
import { ticketReconciliation } from '../seatFirst.mjs';
import { polygonSpans, schottensteinDiagramEdge } from '../schottensteinSeating.mjs';
import { addSchottensteinBoard, addSchottensteinBowl } from './schottensteinInterior.mjs';

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const colorRGB=(hex)=>{
  const x=String(hex||'#788d9a').replace('#','');
  return [0,2,4].map(i=>parseInt(x.slice(i,i+2),16)/255);
};
function offset(s,dx,dy,dz){
  const a=s.yaw||0;
  return [s.x+Math.cos(a)*dx+Math.sin(a)*dz,s.y+dy,s.z-Math.sin(a)*dx+Math.cos(a)*dz];
}
export function buildVenuePlan(model,options={}) {
  const {seats,project,surface}=model;
  const official=ticketReconciliation(project,seats.length);
  const chartPreview=Boolean(model.sectionFootprints);
  const hasRoster=project.ticketing?.inventoryMode==='file-import' && model.seatOrigin==='imported';
  const elements=[],seatShells=[];
  const add=(pos,size,yaw,color,id=-1,rounded=false)=>{
    if(!pos.every(Number.isFinite)||!size.every(x=>Number.isFinite(x)&&x>0.0001))return;
    (rounded?seatShells:elements).push(...pos,...size,Number(yaw)||0,...color,id);
  };
  const concrete=colorRGB('#bccad5');
  const riseFace=colorRGB('#778fa5');
  const steel=colorRGB('#34465a');
  const seatScale=clamp(Number(project.seatPitch)||.53,.42,.76);
  const rows=new Map();
  let chairCount=0,benchCount=0;
  const roundSeats=seats.length<=30000 && options.detail!=='compact';
  for(let i=0;i<seats.length;i++){
    const s=seats[i],kind=seatKind(project,s);
    if(kind==='chair')chairCount++;else benchCount++;
    const key=[s.sectionId,s.tier,s.row].join('::');
    if(!rows.has(key))rows.set(key,[]);
    rows.get(key).push({seat:s,index:i});
    const arenaTint=chartPreview
      ? s.inferredRowColor==='courtside' ? '#333238' : ['#783045','#813449','#722b3e'][s.tier]
      : seatColor(project,s.tier,s.sectionIndex);
    const tint=colorRGB(options.palette?.[Math.max(0,Math.min(3,s.tier))] || arenaTint);
    const pitch=s.seatWidth??seatScale;
    // Seat elevations are the riser top, not the cushion centre.
    if(kind==='bleacher'){
      add(offset(s,0,.37,0),[seatScale*.90,.055,.31],s.yaw,tint,i);
      if(seats.length<110000){
        add(offset(s,-.15,.17,-.02),[.025,.32,.03],s.yaw,steel,i);
        add(offset(s,.15,.17,-.02),[.025,.32,.03],s.yaw,steel,i);
      }
    }else{
      const seatWidth=pitch*.87;
      add(offset(s,0,.437,.058),[seatWidth,.075,.37],s.yaw,tint,i,roundSeats);
      add(offset(s,0,.693,-.157),[seatWidth*.95,.365,.076],s.yaw,tint,i,roundSeats);
      if(seats.length<50000){
        add(offset(s,-seatWidth*.40,.207,-.103),[.027,.414,.09],s.yaw,steel,i);
        add(offset(s,seatWidth*.40,.207,-.103),[.027,.414,.09],s.yaw,steel,i);
        if(options.detail!=='compact'){
          add(offset(s,-pitch*.48,.60,.00),[.024,.037,.22],s.yaw,steel,i);
          add(offset(s,pitch*.48,.60,.00),[.024,.037,.22],s.yaw,steel,i);
        }
      }
    }
  }
  let rowRuns=0,aisleBreaks=0,invalidRows=0,positionCollisions=0;
  // Each seat is mounted to one contiguous tread cell. Never bridge a gap
  // between distant consecutive seats or across sections.
  for(const members of rows.values()){
    if(!members.length)continue;
    const a=members.slice().sort((p,q)=>{
      const n=Number(p.seat.number),m=Number(q.seat.number);
      return Number.isFinite(n)&&Number.isFinite(m)?n-m:0;
    });
    let run=0;
    for(let k=0;k<a.length;k++){
      const s=a[k].seat;
      const prev=k?a[k-1].seat:null, next=k+1<a.length?a[k+1].seat:null;
      const dl=prev?Math.hypot(prev.x-s.x,prev.z-s.z):Infinity;
      const dr=next?Math.hypot(next.x-s.x,next.z-s.z):Infinity;
      if(prev&&dl>seatScale*1.7){aisleBreaks++;run++;}
      if(prev&&dl<seatScale*1.7&&Math.abs(prev.y-s.y)>.13)invalidRows++;
      if(prev&&dl<.24)positionCollisions++;
      const span=clamp(Math.min(dl,dr,seatScale*1.12),.32,seatScale*1.12);
      if(model.seatingRows)continue;
      const depth=.80, rise=.32;
      // Supports stay under each row and leave the aisle between contiguous runs open.
      add(offset(s,0,-rise/2-.01,.035),[span,rise,depth],s.yaw,concrete);
      add(offset(s,0,-rise*.56,depth/2+.036),[span,rise*.78,.014],s.yaw,riseFace);
      if(model.sectionFootprints && (k===0||k===a.length-1||dl>seatScale*1.7||dr>seatScale*1.7)){
        add(offset(s,0,.004,depth*.46),[span,.012,.045],s.yaw,colorRGB('#e1eaf0'));
      }
    }
    rowRuns+=run+1;
  }
  if(chartPreview)addSchottensteinBowl(add,colorRGB,model.sectionFootprints,model.seatingRows??[]);
  // Central surface is a physically scaled reference marker, not an entire building.
  const field=surface.sport==='football'?colorRGB('#277047'):
    surface.sport==='soccer'?colorRGB('#2d7b4f'):colorRGB('#d7b781');
  const basketball = surface.sport==='basketball';
  const accent=colorRGB(chartPreview?'#992437':basketball?'#334e69':'#254c42');
  const darkField=colorRGB(basketball?'#24354b':'#254c42');
  const apron=basketball?3.5:7;
  if(chartPreview){
    const base=colorRGB('#656169');
    const limits=schottensteinDiagramEdge.map(point=>point.x);
    const near=Math.min(...limits),far=Math.max(...limits);
    const strips=Math.ceil((far-near)/.35), stripWidth=(far-near)/strips;
    for(let i=0;i<strips;i++){
      const x=near+(i+.5)*stripWidth;
      for(const [lo,hi] of polygonSpans([schottensteinDiagramEdge],x)){
        add([x,-.36,(lo+hi)/2],[stripWidth+.002,.27,hi-lo],0,base);
      }
    }
  }
  add([0,-.14,0],[surface.width+apron,.23,surface.length+apron],0,darkField);
  add([0,basketball?-.012:.005,0],[surface.width,.07,surface.length],0,field);
  const white=colorRGB('#f8f7ef');
  const line = (x1, y1, z1, x2, y2, z2, width, color) => {
    const dx=x2-x1, dz=z2-z1;
    add([(x1+x2)/2,(y1+y2)/2,(z1+z2)/2],[width,width,Math.hypot(dx,dz)+width*.4],
      Math.atan2(dx,dz),color);
  };
  const arc = (x,y,z,r,start,end,width,color,segments=32) => {
    for(let i=0;i<segments;i++){
      const a=start+(end-start)*i/segments, b=start+(end-start)*(i+1)/segments;
      line(x+Math.sin(a)*r,y,z+Math.cos(a)*r,x+Math.sin(b)*r,y,z+Math.cos(b)*r,width,color);
    }
  };
  const length=surface.length,width=surface.width;
  // Boundary and midpoint lines are crisp, with no stock imagery or text clutter.
  for(const z of [-length/2,0,length/2])add([0,.051,z],[width,.012,.085],0,white);
  for(const x of [-width/2,width/2])add([x,.051,0],[.085,.012,length],0,white);
  if(surface.sport==='football'){
    for(let n=-45;n<=45;n+=5){const z=n*.9144;add([0,.06,z],[width,.01,n%10===0?.085:.05],0,white);}
    for(const sign of [-1,1]){
      add([0,.056,sign*(length/2-4.57)],[width,.015,9.144],0,colorRGB(project.venueReference?.id==='ohio-stadium'?'#b51f36':'#314d68'));
      const z=sign*(length/2+1.2);
      for(const x of [-2.82,2.82])add([x,5.7,z],[.09,5.9,.09],0,colorRGB('#f3cb66'));
      add([0,3.05,z],[5.72,.09,.10],0,colorRGB('#f3cb66'));
      add([0,1.52,z],[.1,3.05,.1],0,colorRGB('#f3cb66'));
    }
  } else if(basketball){
    const wood = ['#dec08c','#dfbf8a','#daba86','#e0c18e','#d9ba85'].map(colorRGB);
    for(let i=0;i<64;i++){
      const x=-width/2+(i+.5)*width/64;
      add([x,.0385,0],[width/64,.004,length],0,wood[(i*7+Math.floor(i/5))%wood.length]);
    }
    const markingY=.052, paint=colorRGB('#476a8c');
    arc(0,markingY,0,1.83,0,Math.PI*2,.035,white,40);
    for(const sign of [-1,1]){
      const baseline=sign*length/2;
      const rim=baseline-sign*1.60;
      const board=baseline-sign*1.22;
      const foul=baseline-sign*5.79;
      const laneHalf=1.83;
      add([0,.042,(baseline+foul)/2],[laneHalf*2,.005,5.79],0,paint);
      add([0,markingY,foul],[laneHalf*2,.009,.04],0,white);
      const laneCenter=(baseline+foul)/2;
      for(const x of [-laneHalf,laneHalf]){
        add([x,markingY,laneCenter],[.04,.009,5.79],0,white);
      }
      arc(0,markingY,foul,1.83,sign>0?Math.PI/2:-Math.PI/2,sign>0?Math.PI*1.5:Math.PI/2,.035,white);
      arc(0,markingY,rim,1.22,sign>0?Math.PI/2:-Math.PI/2,sign>0?Math.PI*1.5:Math.PI/2,.035,white,20);
      const radius=surface.threePointRadiusM||6.75;
      const corner=Math.min(radius,width/2-.68);
      const angle=Math.asin(corner/radius);
      const joins=rim-sign*Math.sqrt(radius*radius-corner*corner);
      arc(0,markingY,rim,radius,sign>0?Math.PI-angle:-angle,sign>0?Math.PI+angle:angle,.04,white,44);
      for(const x of [-corner,corner])line(x,markingY,joins,x,markingY,baseline,.04,white);
      const post=baseline+sign*1.22;
      add([0,.28,post],[1.10,.58,.88],0,chartPreview?colorRGB('#28252a'):darkField);
      add([0,1.58,post],[.20,3.16,.19],0,chartPreview?white:accent);
      add([0,3.18,(post+board)/2],[.13,.13,Math.abs(post-board)],0,chartPreview?white:steel);
      add([0,3.45,board],[1.83,1.06,.062],0,colorRGB('#a5bfd0'));
      const boardFace=board-sign*.036;
      for(const x of [-.87,.87,-.294,.294]){
        const outer=Math.abs(x)>.5;
        add([x,outer?3.45:3.27,boardFace],[.027,outer?1.01:.45,.016],0,white);
      }
      for(const [y,span] of [[2.95,1.77],[3.95,1.77],[3.05,.60],[3.50,.60]]){
        add([0,y,boardFace],[span,.026,.02],0,white);
      }
      const rimColor=colorRGB('#f16c32'), net=colorRGB('#eeeae0');
      add([0,3.05,(rim+board)/2],[.09,.03,Math.abs(rim-board)],0,rimColor);
      arc(0,3.05,rim,.2286,0,Math.PI*2,.024,rimColor,24);
      arc(0,2.70,rim,.145,0,Math.PI*2,.012,net,16);
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        const dx=Math.sin(a),dz=Math.cos(a);
        add([dx*.18,2.875,rim+dz*.18],[.012,.35,.012],0,net);
      }
    }
    const housing=colorRGB('#192b3c');
    if(chartPreview) addSchottensteinBoard(add,colorRGB);
    else {
    const screen=colorRGB('#286695'), bevel=colorRGB('#587d9e');
    add([0,13.6,0],[4.65,2.5,6.4],0,housing);
    add([0,12.30,0],[4.75,.11,6.5],0,bevel);
    add([0,14.88,0],[4.75,.11,6.5],0,bevel);
    for(const side of [-1,1]){
      for(const end of [false,true]){
        const x=end?0:side*2.343,z=end?side*3.216:0;
        const yaw=end?0:Math.PI/2,w=end?4.31:6.08;
        add([x,13.68,z],[w,1.87,.055],yaw,screen);
        add([x,12.59,z],[w,.19,.067],yaw,bevel);
        add([x,14.72,z],[w,.11,.072],yaw,accent);
        // Screen graphics remain generic and work in offline exports.
        for(const offset of [-.29,.29]){
          const shift=w*offset;
          add([x+(end?shift:side*.035),13.73,z+(end?side*.035:shift)],
            [w*.26,.91,.025],yaw,colorRGB('#4c86ad'));
        }
      }
    }
    }
    if(chartPreview){
      // Low courtside objects only, positioned within the published floor zone.
      for(const z of [-8.4,8.4]){
        for(let i=0;i<8;i++){
          add([-width/2-1.69,.41,z+(i-3.5)*.58],[.42,.085,.48],0,accent);
          add([-width/2-1.84,.66,z+(i-3.5)*.58],[.07,.46,.48],0,accent);
        }
      }
      add([-width/2-1.08,.44,0],[.57,.85,5.1],0,housing);
      add([-width/2-.775,.51,0],[.044,.40,4.98],0,accent);
    }
  } else {
    for(const sign of [-1,1]){
      const z=sign*(length/2+.25);
      for(const x of [-3.66,3.66])add([x,1.22,z],[.075,2.44,.075],0,white);
      add([0,2.44,z],[7.32,.08,.08],0,white);
    }
  }
  const schematic= model.seatOrigin!=='imported' || project.ticketing?.coordinates!=='supplied-unverified';
  const instanceData=new Float32Array(seatShells.length+elements.length);
  instanceData.set(seatShells);
  instanceData.set(elements,seatShells.length);
  return {instanceData,instanceCount:instanceData.length/11,roundedCount:seatShells.length/11,
    sectionFootprints:model.sectionFootprints,arenaInterior:chartPreview,
    scoreboardHeight:chartPreview?16.3:13.6,seats,project,surface,official,
    hasRoster,schematic,chairCount,benchCount,rowRuns,aisleBreaks,invalidRows,positionCollisions};
}
