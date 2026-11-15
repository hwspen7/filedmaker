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
    const sections=integer(input.sections??(field.width>30?24:20),'Sections',4,36);
    const aisleWidth=finite(input.aisleWidth??1.1,'Aisle width',.8,5);
    const pitch=finite(input.seatPitch??.54,'Seat pitch',.43,.90);
    const exponent=finite(input.roundness??4.2,'Outline exponent',2,8);
    const capacity=input.targetCapacity==null?null:integer(input.targetCapacity,'Target capacity',1,150000);
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
      template:input.template==='open-stadium'?'open-stadium':'indoor-arena',voids};
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
      const r=radial(angle,field.width/2+d,field.length/2+d);
      return {x:r*Math.cos(angle),y:t.baseY+t.rows*t.rise*fraction,z:r*Math.sin(angle)};
    };
    const voidAt=(tier,section,row)=>spec.voids.some(v=>v.tier===tier&&v.section===section&&row>=v.firstRow&&row<=v.lastRow);
    const aisleAt=(angle,tier,sectionWidth=spec.aisleWidth)=>{
      const p=point(tier,angle,.5),r=Math.hypot(p.x,p.z);
      const half=sectionWidth/Math.max(r,1)/2,sector=TAU/spec.sections;
      const local=((angle%sector)+sector)%sector;
      return Math.min(local,sector-local)<half;
    };
    return {spec,point,voidAt,aisleAt,sectorAngle:TAU/spec.sections,turn:TAU};
  }
};
export default GeometryEngine;
