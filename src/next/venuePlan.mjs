// Standalone, source-aware venue geometry plan. Metres throughout.
// The plan is renderer-independent and never invents official ticket inventory.
import { seatColor, seatKind } from '../seatPresentation.mjs';
import { ticketReconciliation } from '../seatFirst.mjs';

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
  const hasRoster=project.ticketing?.inventoryMode==='file-import' && model.seatOrigin==='imported';
  const elements=[];
  const add=(pos,size,yaw,color,id=-1)=>{
    if(!pos.every(Number.isFinite)||!size.every(x=>Number.isFinite(x)&&x>0.0001))return;
    elements.push(...pos,...size,Number(yaw)||0,...color,id);
  };
  const concrete=colorRGB('#c9cfd3');
  const riseFace=colorRGB('#9daab2');
  const steel=colorRGB('#788a94');
  const seatScale=clamp(Number(project.seatPitch)||.53,.42,.76);
  const rows=new Map();
  let chairCount=0,benchCount=0;
  for(let i=0;i<seats.length;i++){
    const s=seats[i],kind=seatKind(project,s);
    if(kind==='chair')chairCount++;else benchCount++;
    const key=[s.sectionId,s.tier,s.row].join('::');
    if(!rows.has(key))rows.set(key,[]);
    rows.get(key).push({seat:s,index:i});
    const tint=colorRGB(options.palette?.[Math.max(0,Math.min(3,s.tier))] || seatColor(project,s.tier,s.sectionIndex));
    // Seat elevations are the riser top, not the cushion centre.
    if(kind==='bleacher'){
      add(offset(s,0,.37,0),[seatScale*.90,.055,.31],s.yaw,tint,i);
      if(seats.length<110000){
        add(offset(s,-.15,.17,-.02),[.025,.32,.03],s.yaw,steel,i);
        add(offset(s,.15,.17,-.02),[.025,.32,.03],s.yaw,steel,i);
      }
    }else{
      add(offset(s,0,.44,.055),[seatScale*.81,.065,.365],s.yaw,tint,i);
      add(offset(s,0,.71,-.176),[seatScale*.77,.35,.055],s.yaw,tint,i);
      if(seats.length<50000){
        add(offset(s,-.16,.22,-.095),[.027,.40,.038],s.yaw,steel,i);
        add(offset(s,.16,.22,-.095),[.027,.40,.038],s.yaw,steel,i);
        // Premium detail optional to keep large university venues fast.
        if(options.detail==='full'){
          add(offset(s,-seatScale*.48,.60,.00),[.024,.037,.22],s.yaw,steel,i);
          add(offset(s,seatScale*.48,.60,.00),[.024,.037,.22],s.yaw,steel,i);
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
    const s0=a[0].seat;
    let run=0;
    for(let k=0;k<a.length;k++){
      const s=a[k].seat;
      const prev=k?a[k-1].seat:null, next=k+1<a.length?a[k+1].seat:null;
      const dl=prev?Math.hypot(prev.x-s.x,prev.z-s.z):Infinity;
      const dr=next?Math.hypot(next.x-s.x,next.z-s.z):Infinity;
      if(prev&&dl>seatScale*1.7){aisleBreaks++;run++;}
      const dy=(prev&&dl<seatScale*1.7)?Math.abs(prev.y-s.y):0;
      if(dy>.13)invalidRows++;
      if(prev&&dl<.24)positionCollisions++;
      const span=clamp(Math.min(dl,dr,seatScale*1.02),.35,seatScale*1.02);
      // Light neutral tread and riser. The top is just below the seat anchor.
      add(offset(s,0,-.155,0),[span,.28,.80],s.yaw,concrete,-1);
      // Visible face on the approach side, continuous along a row.
      add(offset(s,0,-.24,.386),[span,.30,.025],s.yaw,riseFace,-1);
    }
    rowRuns+=run+1;
  }
  // Central surface is a physically scaled reference marker, not an entire building.
  const field=surface.sport==='football'?colorRGB('#277047'):
    surface.sport==='soccer'?colorRGB('#2d7b4f'):colorRGB(project.venueReference?.id==='schottenstein-center'?'#b3b5b7':'#cda976');
  const darkField=surface.sport==='basketball'?colorRGB('#474d56'):colorRGB('#254c42');
  add([0,-.14,0],[surface.width+7,.23,surface.length+7],0,darkField);
  add([0,.005,0],[surface.width,.07,surface.length],0,field);
  const white=colorRGB('#e9eeed');
  const length=surface.length,width=surface.width;
  // Boundary and midpoint lines are crisp, with no stock imagery or text clutter.
  for(const z of [-length/2,length/2,0])add([0,.051,z],[width,.012,.085],0,white);
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
  } else if(surface.sport==='basketball'){
    for(const sign of [-1,1]){
      const z=sign*(length/2-1.5);
      add([0,3.05,z],[1.8,1.0,.07],0,colorRGB('#dce8ed'));
      add([0,2.5,z+sign*.1],[.14,4.6,.16],0,colorRGB('#6f7883'));
      add([0,.075,sign*(length/2-5.8)],[4.9,.01,.07],0,white);
      for(const x of [-2.45,2.45])add([x,.08,sign*(length/2-2.9)],[.07,.01,5.8],0,white);
    }
    // Simple centre-hung screen: clearly a reference marker, not a BIM model.
    add([0,15.2,0],[6.5,2.8,3.5],0,colorRGB('#303d49'));
    add([0,15.2,1.78],[6.18,2.46,.08],0,colorRGB('#244e68'));
    add([0,15.2,-1.78],[6.18,2.46,.08],0,colorRGB('#244e68'));
  } else {
    for(const sign of [-1,1]){
      const z=sign*(length/2+.25);
      for(const x of [-3.66,3.66])add([x,1.22,z],[.075,2.44,.075],0,white);
      add([0,2.44,z],[7.32,.08,.08],0,white);
    }
  }
  const schematic= model.seatOrigin!=='imported' || project.ticketing?.coordinates!=='supplied-unverified';
  return {instanceData:new Float32Array(elements),instanceCount:elements.length/11,seats,project,surface,official,hasRoster,schematic,chairCount,benchCount,rowRuns,aisleBreaks,invalidRows,positionCollisions};
}
