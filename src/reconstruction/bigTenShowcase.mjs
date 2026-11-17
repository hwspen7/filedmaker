// Build demonstrator venue datasets from existing, cited Big Ten section charts.
// This is not image recognition and is not a surveyed reconstruction.
// Section names and adjacency originate in source catalogs. Angles, radii,
// heights, row allocations and seat positions remain editable estimates.
import {normalizeReconstruction} from './core.mjs';

export const BIG_TEN_CASES=Object.freeze([
  {id:'illinois',title:'Illinois · State Farm Center',difference:'Circular lower bowl, split mezzanine, 48-sector upper ring'},
  {id:'indiana',title:'Indiana · Assembly Hall',difference:'Two opposing, separated steep grandstands'},
  {id:'michigan',title:'Michigan · Crisler Center',difference:'Elliptical two-tier bowl with an offset lower perimeter'},
  {id:'purdue',title:'Purdue · Mackey Arena',difference:'Compact circular continuous seating bowl'},
  {id:'wisconsin',title:'Wisconsin · Kohl Center',difference:'Faceted three-tier bowl with raised balcony levels'},
]);

// Sketch radii, height positions and seat pitch are manual modeling assumptions.
// The listed official ticket IDs must not be mistaken for surveyed seat XYZ.
const CONFIG={
  illinois:{type:'circle',rx:20.8,rz:20.8,offsets:[0,13.4,23.2],
    height:[.62,7.6,13.5],pitch:.55,depth:[.82,.81,.83],rise:[.32,.36,.42]},
  indiana:{type:'grandstands',rx:21.6,rz:21.8,offsets:[0,38],
    height:[.62,19.1],pitch:.56,depth:[.80,.82],rise:[.40,.48]},
  michigan:{type:'ellipse',rx:20.3,rz:26.2,offsets:[0,19.0],
    height:[.56,8.6],pitch:.55,depth:[.82,.83],rise:[.34,.43]},
  purdue:{type:'circle',rx:21.5,rz:21.5,offsets:[0,17.6],
    height:[.58,8.8],pitch:.54,depth:[.82,.83],rise:[.34,.43]},
  wisconsin:{type:'octagon',rx:22.5,rz:27.0,offsets:[0,16.7,20.2],
    height:[.58,10.5,17.8],pitch:.54,depth:[.82,.83,.85],rise:[.32,.42,.45]},
};
const TWO_PI=Math.PI*2;
function polar(angle,rx,rz,shape){
  let exponent=2;
  if(shape==='grandstands')exponent=8;
  if(shape==='ellipse')exponent=2.2;
  const c=Math.cos(angle),s=Math.sin(angle);
  // Radius in a superellipse, parameterized by the geometric direction.
  const factor=Math.pow(Math.pow(Math.abs(c)/rx,exponent)+
    Math.pow(Math.abs(s)/rz,exponent),-1/exponent);
  let x=c*factor,z=s*factor;
  if(shape==='octagon'){
    let t=(angle%(Math.PI/4)+Math.PI/4)%(Math.PI/4);
    const r=Math.cos(Math.PI/8)/Math.cos(t-Math.PI/8);
    x*=r;z*=r;
  }
  return {x:+x.toFixed(4),z:+z.toFixed(4)};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function curveLength(a,b,rx,rz,type){
  let length=0,prev=polar(a,rx,rz,type);
  for(let j=1;j<=16;j++){
    const p=polar(a+(b-a)*j/16,rx,rz,type);
    length+=distance(prev,p);prev=p;
  }
  return length;
}
function polyline(a,b,rx,rz,shape){
  const segments=Math.max(2,Math.ceil(Math.abs(b-a)/.075));
  return Array.from({length:segments+1},(_,i)=>
    polar(a+(b-a)*i/segments,rx,rz,shape));
}
const checkRaw=data=>{
  if(!data||!Array.isArray(data.venues))throw Error('Missing Big Ten catalog');
  if(!data.layouts||!data.interiors)throw Error('Missing source-backed section profiles');
};
export function prepareBigTenExample(id,data){
  checkRaw(data);
  const v=data.venues.find(x=>x.id===id),profile=data.layouts[id],cfg=CONFIG[id];
  if(!v||!profile||!cfg)throw Error('Unknown showcase venue or missing section catalog: '+id);
  const chart=data.charts?.[id];
  const groups=chart?.tierGroups??profile.tiers;
  const ids=new Set(),sections=[];
  let seatTotal=0;
  for(let tierIndex=0;tierIndex<groups.length;tierIndex++){
    const tierGroups=groups[tierIndex],rise=cfg.rise[tierIndex],
      depth=cfg.depth[tierIndex],offset=cfg.offsets[tierIndex],
      baseHeight=cfg.height[tierIndex];
    if(!Number.isFinite(rise)||!Number.isFinite(offset))
      throw Error('No manually defined tier geometry for '+id+' T'+(tierIndex+1));
    for(const group of tierGroups){
      const names=group.sectionIds;
      const weights=group.weights??names.map(()=>1);
      if(weights.length!==names.length)throw Error('Invalid section weights');
      const sum=weights.reduce((n,w)=>n+w,0);
      let cursor=group.startAngle;
      const officialRowCount=group.rowCount;
      if(!Number.isInteger(officialRowCount)||officialRowCount<1||officialRowCount>120)
        throw Error('Invalid source section row count');
      for(let j=0;j<names.length;j++){
        const name=String(names[j]),angleSpan=group.spanAngle*weights[j]/sum,
          start=cursor,end=cursor+angleSpan;
        cursor=end;
        if(ids.has(name))throw Error('Repeated section identity in this model: '+name);
        ids.add(name);
        const rx=cfg.rx+offset,rz=cfg.rz+offset;
        const front=polyline(start,end,rx,rz,cfg.type);
        const back=polyline(start,end,rx+officialRowCount*depth,
          rz+officialRowCount*depth,cfg.type);
        // Per-section row width determines *estimated* seats, not the target
        // venue capacity. Reserve small ends for section-side circulation.
        const rows=Array.from({length:officialRowCount},(_,k)=>{
          // Real bank width increases with row depth. Estimate each row
          // independently, never squeezing the front row to accommodate a
          // fixed count inferred from a wider middle row.
          const rowDepth=(k+.5)*depth;
          const rowWidth=curveLength(start,end,rx+rowDepth,rz+rowDepth,cfg.type);
          const usable=Math.max(.7,rowWidth-.7);
          const seats=Math.max(1,Math.min(130,Math.floor(usable/cfg.pitch)));
          return {
            label:String((group.rowStart??1)+k),
            seats,first:1,seatType:'chair',
            seatDirection:'forward',gaps:[],seatNumbers:[],
            elevation:null,insetStartM:.35,insetEndM:.35,depthOffsetM:0,
          };
        });
        seatTotal+=rows.reduce((n,row)=>n+row.seats,0);
        sections.push({
          id:name,tier:'T'+(tierIndex+1),front,back,
          baseHeight,rowRise:rise,rows,
          source:(chart?.source??profile.source??'unknown').slice(0,240),
        });
      }
    }
  }
  const source=v.sources.find(s=>s.id===v.capacity.sourceId)??v.sources[0];
  const profileText={
    circle:'circular seating contour',
    grandstands:'separate opposed grandstands with open ends',
    ellipse:'elongated oval bowl',
    octagon:'faceted octagonal plan',
  }[cfg.type];
  return normalizeReconstruction({
    format:'filedmaker-reconstruction',
    school:v.school.name,venue:v.venue.name,sport:'ncaa',
    court:{width:15.24,length:28.6512},
    officialCapacity:v.capacity.published,capacitySource:source.url,
    sections,
    notes:'BIG TEN SHOWCASE | '+id+' | '+profileText+
      ' | NOT AN OFFICIAL 3D VENUE | Section labels/order are chart-informed. '+
      'Bank curves, row footprint, elevation, seating counts, accessibility and seat XY/XYZ are estimated. '+
      'Source: '+(chart?.source??profile.source??'unspecified')+
      ' | Original legacy seating allocation estimate: '+seatTotal+'.',
    exterior:{enabled:false,provider:null,parameters:null},
  });
}
