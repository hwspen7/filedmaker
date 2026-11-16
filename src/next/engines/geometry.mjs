// Reusable, survey-independent geometry. Coordinates are metres, Y is vertical.
const TAU=Math.PI*2;
const finite=(n,name,min,max)=>{const x=Number(n);if(!Number.isFinite(x)||x<min||x>max)throw Error(name+' must be between '+min+' and '+max);return x;};
const integer=(n,name,min,max)=>Math.round(finite(n,name,min,max));
export const GeometryEngine={
  normalize(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Venue specification must be an object');
    const surface=input.surface??'ncaa';
    if(!['ncaa','nba','nfhs-basketball','nfhs-football','ncaa-football','nfl','soccer'].includes(surface))throw Error('Unsupported venue surface');
    const defaults={ncaa:[15.24,28.6512],nba:[15.24,28.6512],'nfhs-basketball':[15.24,25.6032],'ncaa-football':[48.768,109.728],'nfhs-football':[48.768,109.728],nfl:[48.768,109.728],soccer:[68,105]};
    const [defaultWidth,defaultLength]=defaults[surface];
    const field={width:finite(input.field?.width??defaultWidth,'Field width',8,150),
      length:finite(input.field?.length??defaultLength,'Field length',15,200)};
    const rawTiers=input.tiers??[{rows:16,depth:.82,rise:.32,gap:3},{rows:20,depth:.83,rise:.39,gap:0}];
    if(!Array.isArray(rawTiers)||!rawTiers.length||rawTiers.length>4)throw Error('Use one to four seating tiers');
    let radial=finite(input.clearance??(field.width>30?8:4),'Field clearance',1,30);
    let height=finite(input.startHeight??.85,'First deck height',.2,15);
    const tiers=rawTiers.map((tier,i)=>{
      const rows=integer(tier.rows,'Row count',1,75),depth=finite(tier.depth??.82,'Row depth',.65,1.8);
      const rise=finite(tier.rise??.36,'Row rise',.12,.75);
      const gap=finite(tier.gap??(i<rawTiers.length-1?3:0),'Concourse gap',0,25);
      const elevationGap=finite(tier.elevationGap??(i<rawTiers.length-1?1.5:0),'Level gap',0,12);
      const t={id:'T'+(i+1),index:i,rows,depth,rise,gap,elevationGap,frontRadiusOffset:radial,baseY:height};
      radial+=rows*depth+gap;height+=rows*rise+elevationGap;
      return t;
    });
    const sections=integer(input.sections??(field.width>30?24:20),'Sections',4,64);
    const aisleWidth=finite(input.aisleWidth??1.1,'Aisle width',.8,5);
    const pitch=finite(input.seatPitch??.54,'Seat pitch',.43,.90);
    const exponent=finite(input.roundness??4.2,'Outline exponent',2,8);
    const capacity=input.targetCapacity==null?null:integer(input.targetCapacity,'Target capacity',1,150000);
    const exterior=input.exterior==null?null:(()=>{
      if(typeof input.exterior!=='object'||Array.isArray(input.exterior))throw Error('Exterior profile must be an object');
      const profile=input.exterior.profile??'metal-and-brick';
      if(!['metal-and-brick','modern-glass','masonry'].includes(profile))throw Error('Unsupported facade material profile');
      const entrances=input.exterior.entrances??[];
      if(!Array.isArray(entrances)||entrances.length>12)throw Error('Maximum twelve entrance volumes');
      const signature=input.exterior.signature??null;
      if(signature){
        if(!signature||typeof signature!=='object'||Array.isArray(signature))throw Error('Invalid architecture signature');
        if(!['folded-dome','copper-dome','saddle','truss-arch','barrel','gable',
          'gable-skylight','trapezoid','swept','oval-low','low-crown','flat-broad'].includes(signature.roof))
          throw Error('Unsupported architecture roof silhouette');
        if(!['white','copper','slate','pale'].includes(signature.finish))
          throw Error('Unsupported architecture roofing material');
      }
      return {profile,signature:signature?{
        roof:signature.roof,finish:signature.finish,feature:String(signature.feature??'').slice(0,60),
        roofRise:finite(signature.roofRise,'Signature roof rise',0,30),
        entryAngle:finite(signature.entryAngle,'Signature entrance direction',0,TAU),
        source:String(signature.source??'').slice(0,512),
        note:String(signature.note??'').slice(0,300),
        measuredDimensions:signature.measuredFacts??[],
        outerDiameterMetres:signature.outerDiameterMetres==null?null:
          finite(signature.outerDiameterMetres,'Historic dome diameter',40,200),
        apexHeightMetres:signature.apexHeightMetres==null?null:
          finite(signature.apexHeightMetres,'Historic apex height',8,80),
        radialButtresses:signature.radialButtresses==null?null:
          integer(signature.radialButtresses,'Radial buttress count',6,100),
        historicalWallHeightMetres:signature.historicalWallHeightMetres==null?null:
          finite(signature.historicalWallHeightMetres,'Historic exterior wall',3,50),
        historicalDomeRiseMetres:signature.historicalDomeRiseMetres==null?null:
          finite(signature.historicalDomeRiseMetres,'Historic dome rise',3,40),
        historicalApexAboveCourtMetres:signature.historicalApexAboveCourtMetres==null?null:
          finite(signature.historicalApexAboveCourtMetres,'Historic roof apex',8,90),
        historicalBuildingWidthMetres:signature.historicalBuildingWidthMetres==null?null:
          finite(signature.historicalBuildingWidthMetres,'Historic building width',40,250),
        historicalBuildingLengthMetres:signature.historicalBuildingLengthMetres==null?null:
          finite(signature.historicalBuildingLengthMetres,'Historic building length',40,250),
        asymmetricConcourseMetres:signature.asymmetricConcourseMetres==null?null:
          Object.fromEntries(['north','south','east','west'].map(side=>[
            side,finite(signature.asymmetricConcourseMetres[side],
              'Measured '+side+' concourse depth',1,25)
          ])),
        historicalClearspanMetres:signature.historicalClearspanMetres==null?null:{
          width:finite(signature.historicalClearspanMetres.width,'Historic clearspan width',40,150),
          length:finite(signature.historicalClearspanMetres.length,'Historic clearspan length',40,150)
        }
      }:null,entrances:entrances.map((item,index)=>({
        angle:finite(item.angle,'Entrance angle '+index,0,Math.PI*2),
        role:item.role==='primary'?'primary':'secondary'
      }))};
    })();
    // Source-backed section identities and displayed rows are independent
    // of an estimated, adjustable seat-center mesh. Missing angular survey
    // data remain approximations even when section IDs are documented.
    const sectionMap=input.sectionMap==null?null:(()=>{
      const groupsByTier=input.sectionMap;
      if(!Array.isArray(groupsByTier)||groupsByTier.length!==tiers.length)
        throw Error('Section map must have one tier entry per seating level');
      const keys=new Set();
      return groupsByTier.map((groups,tierIndex)=>{
        if(!Array.isArray(groups)||groups.length<1||groups.length>12)
          throw Error('Section map tier requires 1 to 12 arc groups');
        const occupied=[];
        const output=groups.map(group=>{
          const start=finite(group.startAngle,'Section arc start',0,TAU);
          const span=finite(group.spanAngle,'Section arc span',.05,TAU);
          const ids=group.sectionIds;
          if(!Array.isArray(ids)||ids.length<1||ids.length>48)
            throw Error('Invalid mapped section identifier list');
          const weights=group.weights??ids.map(()=>1);
          if(weights.length!==ids.length||weights.some(v=>!Number.isFinite(v)||v<=0||v>10))
            throw Error('Invalid relative section widths');
          const rowStart=integer(group.rowStart??1,'Displayed starting row',1,100);
          const rowCount=integer(group.rowCount??tiers[tierIndex].rows,'Display row count',1,tiers[tierIndex].rows);
          for(const id of ids){
            if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,12}$/.test(id))
              throw Error('Invalid mapped section identifier '+id);
            const key=tierIndex+':'+id;
            if(keys.has(key))throw Error('Duplicate mapped section '+key);
            keys.add(key);
          }
          const skipRows=group.skipRows??[];
          if(!Array.isArray(skipRows)||new Set(skipRows).size!==skipRows.length||
            skipRows.some(v=>!Number.isInteger(v)||v<rowStart||v>=rowStart+rowCount))
            throw Error('Invalid mapped skipped row labels');
          const end=start+span;
          occupied.push([start,Math.min(TAU,end)]);
          if(end>TAU)occupied.push([0,end-TAU]);
          return {startAngle:start,spanAngle:span,sectionIds:[...ids],
            weights:[...weights],rowStart,rowCount,skipRows:[...skipRows]};
        });
        occupied.sort((a,b)=>a[0]-b[0]);
        for(let i=1;i<occupied.length;i++)
          if(occupied[i][0]<occupied[i-1][1]-1e-7)
            throw Error('Overlapping mapped section arcs in tier '+tierIndex);
        return output;
      });
    })();
    // First-wave school interiors are independently profiled. Reference
    // section numbers are sourced, but contours and notch footprints remain
    // visually interpreted rather than measured survey coordinates.
    const interior=input.interior==null||sectionMap==null?null:(()=>{
      const raw=input.interior;
      if(!raw||typeof raw!=='object'||Array.isArray(raw))
        throw Error('Invalid school interior profile');
      const outlines=new Set(['grandstands','circle','ellipse','rounded-rectangle','octagon','rectangle']);
      if(!outlines.has(raw.outline))throw Error('Unsupported interior outline');
      if(!Array.isArray(raw.tierProfiles)||raw.tierProfiles.length!==tiers.length)
        throw Error('Interior must have an independent geometry profile for every tier');
      const tierProfiles=raw.tierProfiles.map((t,i)=>({
        widthScale:finite(t.widthScale,'Interior tier width '+i,.88,1.2),
        lengthScale:finite(t.lengthScale,'Interior tier length '+i,.88,1.2),
        radialInset:finite(t.radialInset,'Interior tier radial inset '+i,-8,3.5),
        rake:finite(t.rake,'Interior tier rake '+i,-2,2),
        wave:finite(t.wave,'Interior tier wave '+i,0,1.5)
      }));
      const sectionExists=(id,tier)=>sectionMap?.[tier]?.some(group=>group.sectionIds.includes(id));
      const sectionRules=(raw.sectionRules??[]).map(rule=>{
        const tier=integer(rule.tier,'Interior rule tier',0,tiers.length-1);
        const id=String(rule.id);
        if(!sectionExists(id,tier))throw Error('Unknown interior section '+id+' in tier '+tier);
        return {tier,id,
          frontRows:integer(rule.frontRows??0,'Interior front trim',0,tiers[tier].rows),
          rearRows:integer(rule.rearRows??0,'Interior rear trim',0,tiers[tier].rows),
          frontWidth:finite(rule.frontWidth??1,'Section front width ratio',.4,1),
          rearWidth:finite(rule.rearWidth??1,'Section rear width ratio',.4,1)};
      });
      const notches=(raw.notches??[]).map(notch=>{
        const tier=integer(notch.tier,'Notch tier',0,tiers.length-1),id=String(notch.id);
        if(!sectionExists(id,tier))throw Error('Unknown interior notch section '+id);
        return {tier,id,
          fromRow:integer(notch.fromRow,'Notch first row',1,100),
          toRow:integer(notch.toRow,'Notch final row',1,100),
          at:finite(notch.at,'Notch location',.05,.95),
          span:finite(notch.span,'Notch section fraction',.025,.4)};
      });
      const seatTypes=(raw.seatTypes??[]).map(type=>{
        const tier=integer(type.tier,'Seat material tier',0,tiers.length-1);
        const sections=type.sections??null;
        if(sections&&(!Array.isArray(sections)||sections.some(id=>!sectionExists(id,tier))))
          throw Error('Unknown bleacher section in interior profile');
        if(!['chair','bleacher'].includes(type.kind))throw Error('Unknown interior seat material');
        return {tier,fromRow:integer(type.fromRow,'Seat material first row',1,100),
          toRow:integer(type.toRow,'Seat material last row',1,100),
          sections:sections?[...sections]:null,kind:type.kind};
      });
      return {type:String(raw.type??'').slice(0,80),outline:raw.outline,
        tierProfiles,sectionRules,notches,seatTypes,
        source:String(raw.source??'').slice(0,512),
        notes:String(raw.notes??'').slice(0,600),
        geometryStatus:'chart-informed-unsurveyed'};
    })();
    const rawVoids=input.voids??[];
    if(!Array.isArray(rawVoids)||rawVoids.length>256)throw Error('Too many restricted seating regions');
    const voids=rawVoids.map(v=>{
      const section=integer(v.section,'Void section',1,sections);
      const tier=integer(v.tier,'Void tier',0,tiers.length-1);
      const firstRow=integer(v.firstRow??1,'Void first row',1,tiers[tier].rows);
      const lastRow=integer(v.lastRow??firstRow,'Void last row',firstRow,tiers[tier].rows);
      return {section,tier,firstRow,lastRow,reason:String(v.reason??'reserved').slice(0,100)};
    });
    return {id:String(input.id??'custom').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,60),
      name:String(input.name??'Procedural venue').slice(0,100),surface,field,tiers,sections,
      clearance:tiers[0].frontRadiusOffset,aisleWidth,seatPitch:pitch,roundness:exponent,
      targetCapacity:capacity,capacityTolerance:finite(input.capacityTolerance??.02,'Capacity tolerance',0,.2),
      exterior,interior,
      template:input.template==='open-stadium'?'open-stadium':'indoor-arena',voids,sectionMap};
  },
  create(input){
    const spec=this.normalize(input),{field,roundness}=spec;
    const radial=(angle,rx,rz)=>{
      const c=Math.abs(Math.cos(angle))/rx,s=Math.abs(Math.sin(angle))/rz;
      return Math.pow(Math.pow(c,roundness)+Math.pow(s,roundness),-1/roundness);
    };
    const point=(tier,angle,fraction=0,offset=0)=>{
      const t=spec.tiers[tier];if(!t)throw Error('Invalid tier index');
      if(!Number.isFinite(angle)||!Number.isFinite(fraction))throw Error('Non-finite sampling coordinates');
      const d=t.frontRadiusOffset+t.rows*t.depth*fraction+offset;
      const p=spec.interior?.tierProfiles[tier];
      let r;
      if(p){
        const rx=Math.max(field.width/2+2,(field.width/2+d+p.radialInset)*p.widthScale);
        const rz=Math.max(field.length/2+2,(field.length/2+d+p.radialInset)*p.lengthScale);
        const c=Math.abs(Math.cos(angle)),z=Math.abs(Math.sin(angle));
        switch(spec.interior.outline){
          case 'circle':
            r=Math.max(field.length/2+2,field.length/2+d+p.radialInset);
            break;
          case 'ellipse':
            r=1/Math.hypot(c/rx,z/rz);
            break;
          case 'octagon':
            r=1/Math.max(c/rx,z/rz,(c/rx+z/rz)/Math.SQRT2);
            break;
          case 'rectangle':{
            const box=1/Math.max(c/rx,z/rz);
            r=box*.77+radial(angle,rx,rz)*.23;
            break;
          }
          case 'grandstands':{
            const box=1/Math.max(c/rx,z/rz);
            r=box*.58+radial(angle,rx,rz)*.42;
            break;
          }
          default:r=radial(angle,rx,rz);
        }
        r+=p.wave*Math.cos(4*angle)*(0.25+fraction*.75);
      }else r=radial(angle,field.width/2+d,field.length/2+d);
      return {x:r*Math.cos(angle),
        y:t.baseY+t.rows*t.rise*fraction+(p?.rake??0)*fraction*(1-fraction),
        z:r*Math.sin(angle)};
    };
    const banksForTier=tier=>{
      const groups=spec.sectionMap?.[tier.index];
      if(!groups)return Array.from({length:spec.sections},(_,i)=>({
        sectionId:String(i+1),sectionIndex:i,lo:i*TAU/spec.sections,
        hi:(i+1)*TAU/spec.sections,rowStart:1,rowCount:tier.rows,skipRows:[]
      }));
      const result=[];
      for(const group of groups){
        const total=group.weights.reduce((sum,w)=>sum+w,0);
        let covered=0;
        for(let k=0;k<group.sectionIds.length;k++){
          const lo=group.startAngle+group.spanAngle*covered/total;
          covered+=group.weights[k];
          const hi=group.startAngle+group.spanAngle*covered/total;
          result.push({sectionId:group.sectionIds[k],sectionIndex:result.length,
            lo,hi,rowStart:group.rowStart,rowCount:group.rowCount,
            skipRows:group.skipRows});
        }
      }
      return result;
    };
    const rowIntervals=(tier,bank,slot)=>{
      const {sectionId,rowStart,rowCount,skipRows=[]}=bank;
      let start=bank.lo,end=bank.hi;
      if(slot<0||slot>=rowCount||skipRows.includes(rowStart+slot))return [];
      const rule=spec.interior?.sectionRules.find(r=>
        r.tier===tier.index&&r.id===sectionId);
      if(rule&&(slot<rule.frontRows||slot>=rowCount-rule.rearRows))return [];
      if(rule){
        const t=(slot+.5)/Math.max(1,rowCount),width=
          rule.frontWidth*(1-t)+rule.rearWidth*t;
        const mid=(start+end)/2,span=(end-start)*width;
        start=mid-span/2;end=mid+span/2;
      }
      const center=point(tier.index,(start+end)/2,(slot+.5)/tier.rows);
      const margin=spec.aisleWidth/Math.max(1,Math.hypot(center.x,center.z))*.5;
      let intervals=[[start+margin,end-margin]].filter(([a,b])=>b>a+1e-5);
      for(const notch of spec.interior?.notches??[]){
        if(notch.tier!==tier.index||notch.id!==sectionId||
          rowStart+slot<notch.fromRow||rowStart+slot>notch.toRow)continue;
        const mid=start+(end-start)*notch.at,half=(end-start)*notch.span*.5;
        const low=mid-half,high=mid+half;
        intervals=intervals.flatMap(([a,b])=>[
          [a,Math.min(b,low)],[Math.max(a,high),b]
        ].filter(([p,q])=>q>p+1e-5));
      }
      return intervals;
    };
    const voidAt=(tier,section,row)=>spec.voids.some(v=>v.tier===tier&&v.section===section&&row>=v.firstRow&&row<=v.lastRow);
    const aisleAt=(angle,tier,sectionWidth=spec.aisleWidth)=>{
      const p=point(tier,angle,.5),r=Math.hypot(p.x,p.z);
      const half=sectionWidth/Math.max(r,1)/2,sector=TAU/spec.sections;
      const local=((angle%sector)+sector)%sector;
      return Math.min(local,sector-local)<half;
    };
    return {spec,point,voidAt,aisleAt,banksForTier,rowIntervals,
      sectorAngle:TAU/spec.sections,turn:TAU};
  }
};
export default GeometryEngine;

// Smoothly fit a real rear boundary to actual chair locations. This is
// intentionally reusable across sports and venue contours. It does not change
// seats, capacities, row identifiers, or imported ticket positions.
export function fitRearSeatEnvelope(seats,{tier=null,segments=192,clearance=.42,
  spread=2,referenceRadius=null}={}){
  if(!Array.isArray(seats)||!Number.isInteger(segments)||segments<32||segments>1024)
    throw Error('Invalid rear-envelope seating input or resolution');
  if(!Number.isFinite(clearance)||clearance<.2||clearance>2)
    throw Error('Rear-envelope chair clearance must be between .2 and 2 metres');
  if(!Number.isInteger(spread)||spread<0||spread>8)
    throw Error('Rear-envelope angular spread must be between zero and eight');
  const tau=Math.PI*2,mod=i=>(i+segments)%segments;
  const sampled=new Float64Array(segments).fill(-Infinity);
  for(const seat of seats){
    if(tier!=null&&seat.tier!==tier)continue;
    if(!Number.isFinite(seat.x)||!Number.isFinite(seat.z))
      throw Error('Non-finite chair coordinate in rear-envelope input');
    const angle=(Math.atan2(seat.z,seat.x)+tau)%tau;
    const station=mod(Math.round(angle*segments/tau));
    sampled[station]=Math.max(sampled[station],Math.hypot(seat.x,seat.z));
  }
  if(!sampled.some(Number.isFinite))throw Error('Rear-envelope tier has no valid seats');
  const expanded=Array.from({length:segments},(_,i)=>{
    let rear=-Infinity;
    for(let k=-spread;k<=spread;k++)
      rear=Math.max(rear,sampled[mod(i+k)]);
    return rear;
  });
  // Interpolate the rare completely unoccupied stations, not the interior
  // of an aisle. An aisle inherits the boundary of neighbouring chair banks.
  for(let i=0;i<segments;i++){
    if(Number.isFinite(expanded[i]))continue;
    let before=i,after=i;
    while(!Number.isFinite(expanded[before]))before=mod(before-1);
    while(!Number.isFinite(expanded[after]))after=mod(after+1);
    const distance=(after-before+segments)%segments;
    const step=(i-before+segments)%segments;
    const t=distance?step/distance:0;
    expanded[i]=expanded[before]*(1-t)+expanded[after]*t;
  }
  const radii=Float64Array.from(expanded,(raw,i)=>{
    const prior=expanded[mod(i-2)],next=expanded[mod(i+2)];
    const smooth=(prior+2*expanded[mod(i-1)]+4*raw+
      2*expanded[mod(i+1)]+next)/10;
    // Never reduce a valid occupied sector below its seat clearance.
    return Math.max(raw,smooth)+clearance;
  });
  if(referenceRadius!=null&&typeof referenceRadius!=='function')
    throw Error('Reference radius must be a function');
  return {radii,segments,clearance,radiusAt:angle=>{
    const index=((angle%tau)+tau)%tau*segments/tau;
    const low=Math.floor(index),t=index-low;
    return radii[low]*(1-t)+radii[mod(low+1)]*t;
  }};
}
