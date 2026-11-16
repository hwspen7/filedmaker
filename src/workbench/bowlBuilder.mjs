// Parametric, entirely synthetic seating bowls for training and operator drafts.
// These placements are NOT verified school seat maps or construction drawings.
import {newVenue,normalizeVenue,SPORT_DEFAULTS} from './contract.mjs';

export const BOWL_STARTERS=Object.freeze({
  'school-end-stands':{
    label:'Compact school gym',description:'Two short elevated bleacher banks with open sidelines',
    sport:'nfhs-basketball',shape:'ends',sectors:12,rows:[9],clearance:2.6,
    rowDepth:.73,aisleEvery:4,seatWidth:.53,rises:[.26]
  },
  'four-side-fieldhouse':{
    label:'Four-side fieldhouse',description:'Continuous four-sided lower bowl with generous court apron',
    sport:'ncaa',shape:'full',sectors:16,rows:[13],clearance:3.8,
    rowDepth:.82,aisleEvery:4,seatWidth:.52,rises:[.31]
  },
  'college-two-tier':{
    label:'Two-tier college arena',description:'Separated lower and upper bowl with continuous corner seating',
    sport:'ncaa',shape:'full',sectors:24,rows:[17,15],clearance:3.5,
    rowDepth:.80,aisleEvery:6,seatWidth:.52,rises:[.31,.39],tierGap:2.2
  },
  'metro-three-tier':{
    label:'Three-tier indoor arena',description:'Dense multi-level seating bowl with wider upper concourse breaks',
    sport:'ncaa',shape:'full',sectors:28,rows:[15,17,16],clearance:4.5,
    rowDepth:.84,aisleEvery:7,seatWidth:.51,rises:[.30,.38,.43],tierGap:2.8
  },
  'horseshoe-football':{
    label:'Open-end football stadium',description:'One open end with curved sideline and end-zone seating',
    sport:'nfhs-football',shape:'horseshoe',sectors:24,rows:[16,14],
    clearance:5.5,rowDepth:.86,aisleEvery:6,seatWidth:.54,
    rises:[.32,.40],tierGap:2.5
  },
  'grandstand-football':{
    label:'Two-sided football grandstands',description:'Long sideline stands separated from the playing field',
    sport:'ncaa-football',shape:'sidelines',sectors:24,rows:[22,16],
    clearance:6.5,rowDepth:.89,aisleEvery:6,seatWidth:.55,
    rises:[.33,.42],tierGap:3
  }
});

const bounded=(value,min,max,name)=>{
  if(!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max)
    throw Error(name+' must be between '+min+' and '+max);
  return Number(value);
};
const point=(angle,rx,rz)=>{
  const a=Math.sin(angle),b=Math.cos(angle);
  // Superellipse-like footprint yields long sideline banks and rounded
  // corners without substituting an invented official section chart.
  const power=.84;
  return {x:rx*Math.sign(a)*Math.abs(a)**power,
    z:rz*Math.sign(b)*Math.abs(b)**power};
};
const length=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function buildSyntheticBowl(options={}){
  const template=String(options.template??'college-two-tier');
  const spec=BOWL_STARTERS[template];
  if(!spec)throw Error('Unsupported starter venue');
  const sport=spec.sport;
  const settings=SPORT_DEFAULTS[sport];
  const sectors=bounded(options.sectors??spec.sectors,8,32,'Sector count');
  const levelCount=bounded(options.levels??spec.rows.length,1,3,'Tier count');
  if(!Number.isInteger(sectors)||!Number.isInteger(levelCount))
    throw Error('Sectors and tiers must be integers');
  if(sectors*levelCount>160)throw Error('Maximum 160 editable sections');
  const rowCount=bounded(options.rowsPerTier??spec.rows[0],4,34,'Rows per tier');
  if(!Number.isInteger(rowCount))throw Error('Rows per tier must be an integer');
  const rows=options.rowsPerTier==null?
    [...spec.rows.slice(0,levelCount)]:Array.from({length:levelCount},()=>rowCount);
  while(rows.length<levelCount)rows.push(rows.at(-1));
  const step=bounded(options.rowDepth??spec.rowDepth,.55,1.35,'Row depth');
  const seatWidth=bounded(options.seatWidth??spec.seatWidth,.43,.85,'Seat pitch');
  const clearance=bounded(options.clearance??spec.clearance,1,15,'Playing-area clearance');
  const slope=bounded(options.rowRise??spec.rises[0],.10,.8,'Row elevation rise');
  const pitchRises=options.rowRise==null?
    [...spec.rises.slice(0,levelCount)]:Array.from({length:levelCount},()=>slope);
  while(pitchRises.length<levelCount)pitchRises.push(pitchRises.at(-1));
  const v=newVenue(sport);
  v.school='Synthetic design study';
  v.venue=spec.label+' · training only';
  v.notes=[
    'COMPLETELY SYNTHETIC geometry and seat counts. Not Ohio State or any real institution.',
    'Section IDs, rows, capacity, elevation and circulation are provisional examples.',
    'Manual source registration, sightline, ingress and accessibility review are required.'
  ];
  const innerX=settings.width/2+clearance;
  const innerZ=settings.length/2+clearance;
  let radialOffset=0,heightOffset=.55;
  for(let tierIndex=0;tierIndex<levelCount;tierIndex++){
    const depth=rows[tierIndex]*step;
    const frontX=innerX+radialOffset,frontZ=innerZ+radialOffset;
    const backX=frontX+depth,backZ=frontZ+depth;
    const baseHeight=Math.min(75,heightOffset);
    const rise=pitchRises[tierIndex];
    for(let i=0;i<sectors;i++){
      const mid=2*Math.PI*(i+.5)/sectors;
      // A few intentionally omitted banks create the realistic open ends;
      // they are not silently replaced with fictional source seats.
      if(spec.shape==='horseshoe'&&Math.cos(mid)<-.84)continue;
      if(spec.shape==='sidelines'&&Math.abs(Math.sin(mid))<.72)continue;
      if(spec.shape==='ends'&&Math.abs(Math.cos(mid))<.83)continue;
      const a=2*Math.PI*i/sectors,b=2*Math.PI*(i+1)/sectors;
      const inner=[point(a,frontX,frontZ),point(b,frontX,frontZ)];
      const outer=[point(a,backX,backZ),point(b,backX,backZ)];
      const average=(length(inner[0],inner[1])+length(outer[0],outer[1]))/2;
      const seats=Math.max(3,Math.min(200,Math.floor((average-.5)/seatWidth)));
      const id='T'+(tierIndex+1)+'-'+String(i+1).padStart(2,'0');
      v.sections.push({id,front:inner,back:outer,trace:[],
        baseHeight,rowRise:rise,provenance:'synthetic-parametric/unverified'});
      for(let rowIndex=0;rowIndex<rows[tierIndex];rowIndex++){
        const row=String(rowIndex+1);
        const perRow=Math.max(3,seats-((rowIndex%5===4)?1:0));
        v.rows.push({section:id,row,seats:perRow,first:1,tier:'T'+(tierIndex+1),
          seatType:template==='school-end-stands'?'bleacher':'chair',
          sourceSeats:null,operatorEdited:true,operatorAdded:true});
      }
    }
    radialOffset+=depth+(spec.tierGap??1.8);
    heightOffset+=rows[tierIndex]*rise+(tierIndex===0?2:3);
  }
  if(!v.sections.length||!v.rows.length)throw Error('Starter has no visible spectator banks');
  const count=v.rows.reduce((n,r)=>n+r.seats,0);
  if(count>40000)throw Error('Starter exceeds 40,000-seat preview budget');
  return normalizeVenue(v);
}
