// Geometric support for ticket-inventory seating. Each seat position is data;
// the concrete tread underneath is an explicitly schematic visual aid.
// This module has no renderer dependency so its topology can be tested offline.
const finite = v => typeof v === 'number' && Number.isFinite(v);
const keyFor = seat => JSON.stringify([seat.sectionId ?? seat.section, seat.tier, seat.row]);
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const sortSeats = (a,b) => {
  const x=Number(a.number),y=Number(b.number);
  if(Number.isFinite(x)&&Number.isFinite(y)&&x!==y)return x-y;
  return String(a.number??'').localeCompare(String(b.number??''),undefined,{numeric:true});
};
const directionalDifference = (a,b) => Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

export function seatingSupportPlan(seats, opts={}) {
  const depth=opts.depth??.86;
  const topDrop=opts.topDrop??.065;
  const thickness=opts.thickness??.31;
  if(![depth,topDrop,thickness].every(finite)||depth<.4||depth>1.8||thickness<=0||thickness>1){
    throw new Error('Invalid seat support dimensions.');
  }
  const groups=new Map();
  for(const s of seats){
    if(![s.x,s.y,s.z].every(finite))continue;
    const key=keyFor(s);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(s);
  }
  const runs=[];
  const maxSeats=opts.maxSeats??160000;
  if(seats.length>maxSeats)throw new Error('Seat support preview exceeds safety limit.');
  for(const [key,group] of groups) {
    const ordered=group.slice().sort(sortSeats);
    const shortDistances=[];
    for(let i=1;i<ordered.length;i++){
      const d=distance(ordered[i-1],ordered[i]);
      if(d>=.3&&d<1.05)shortDistances.push(d);
    }
    shortDistances.sort((a,b)=>a-b);
    const pitch=shortDistances.length?shortDistances[Math.floor(shortDistances.length/2)]:.53;
    const limit=Math.max(.77,Math.min(1.12,pitch*1.52));
    const consecutive=(a,b)=>{
      const d=distance(a,b);
      const an=Number(a.number),bn=Number(b.number);
      return d>=.27&&d<=limit&&Math.abs(a.y-b.y)<.12&&
        (Number.isNaN(an)||Number.isNaN(bn)||bn-an===1)&&
        directionalDifference(a.yaw??0,b.yaw??0)<.40;
    };
    let run=[];
    const finish=()=>{if(run.length){runs.push({key,seats:run});run=[];}};
    for(const seat of ordered){
      if(run.length&&!consecutive(run[run.length-1],seat))finish();
      run.push(seat);
    }
    finish();
  }
  const cells=[];
  for(const run of runs){
    const row=run.seats;
    for(let i=0;i<row.length;i++){
      const seat=row[i],before=row[i-1],after=row[i+1];
      const nearest=before?distance(before,seat):after?distance(seat,after):.53;
      const span=Math.max(.37,Math.min(.86,nearest));
      const dx=before&&after?after.x-before.x:after?after.x-seat.x:before?seat.x-before.x:Math.cos(seat.yaw??0);
      const dz=before&&after?after.z-before.z:after?after.z-seat.z:before?seat.z-before.z:-Math.sin(seat.yaw??0);
      const length=Math.hypot(dx,dz)||1;
      const tangent={x:dx/length,z:dz/length};
      const yaw=seat.yaw??Math.atan2(-seat.x,-seat.z);
      const forward={x:Math.sin(yaw),z:Math.cos(yaw)};
      // Preserve measured/estimated seat coordinates. The supports never
      // change ticket identifiers or reposition an authored seat.
      cells.push({x:seat.x,y:seat.y-topDrop,z:seat.z,width:span+.015,
        depth,thickness,tangent,forward,
        sectionId:seat.sectionId??seat.section,tier:seat.tier,row:seat.row,
        endLeft:i===0,endRight:i===row.length-1});
    }
  }
  return {cells,runCount:runs.length,seatCount:cells.length,
    provenance:'schematic support constructed from seat rows; not a surveyed structural model'};
}

export function supportFootprint(cell){
  const {x,z,width,depth,tangent:t,forward:f}=cell;
  const p=(along,fore)=>({x:x+t.x*along+f.x*fore,z:z+t.z*along+f.z*fore});
  return {frontLeft:p(-width/2,depth/2),frontRight:p(width/2,depth/2),
    rearLeft:p(-width/2,-depth/2),rearRight:p(width/2,-depth/2)};
}

// Floor-only schematic stair aisles for parametrically generated stands.
// These must never create seats or imply an official venue aisle location.
export function schematicAisleSteps(project, surface, tiers, perimeterPoint){
  const steps=[];
  if(!project.seatFirst)return steps;
  for(const tier of tiers){
    const points=[];
    const sections=project.sections.filter(s=>s.enabled);
    // Only draw a neutral aisle where both adjoining sections are present.
    for(let i=0;i<project.sections.length;i++){
      const s=project.sections[i],next=project.sections[(i+1)%project.sections.length];
      if(!s.enabled||!next.enabled)continue;
      if(Math.abs((s.end%360)-(next.start%360))>.001)continue;
      points.push({angle:s.end%360,width:project.aisleWidth,sectionId:s.id,neighborId:next.id});
    }
    for(const a of project.aisles||[]){
      if(a.tier==='all'||a.tier===tier.id)points.push({angle:a.angle,width:a.width,sectionId:null});
    }
    for(const point of points){
      const radians=point.angle*Math.PI/180;
      const left=project.sections.find(s=>s.enabled&&s.start<=point.angle&&s.end>=point.angle)||sections[0];
      const override=project.sectionProfiles?.find(p=>p.tierId===tier.id&&p.sectionId===left?.id);
      const rows=override?.rows??tier.rows;
      const startOffset=tier.startOffset+(override?.frontShift??0);
      const startHeight=tier.startHeight+(override?.heightShift??0);
      const depth=override?.depth??tier.depth;
      const rise=override?.rise??tier.rise;
      if(!rows||!Number.isFinite(startOffset)||!Number.isFinite(startHeight))continue;
      for(let row=0;row<rows;row++){
        const radial=startOffset+row*depth;
        const a=perimeterPoint(project,surface,radians,radial);
        const b=perimeterPoint(project,surface,radians,radial+depth);
        const before=perimeterPoint(project,surface,radians-.001,radial);
        const after=perimeterPoint(project,surface,radians+.001,radial);
        const len=Math.hypot(after.x-before.x,after.z-before.z)||1;
        const tangent={x:(after.x-before.x)/len,z:(after.z-before.z)/len};
        steps.push({tier:tier.id,row:row+1,angle:point.angle,width:point.width,
          y:startHeight+row*rise+.023,a,b,tangent,
          schematic:true});
      }
    }
  }
  return steps;
}
