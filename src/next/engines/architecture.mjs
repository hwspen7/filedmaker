// Generic architectural assembly from analytic tiers, independent of OSU references.
import { GeometryEngine } from './geometry.mjs';
import { addRoundVolume } from '../structuralMesh.mjs';
import { ExteriorEngine } from './exterior.mjs';
import { SignatureArchitectureEngine } from './signatureArchitecture.mjs';
const TAU=Math.PI*2;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function triangle(out,a,b,c,normal){
  if(dot(cross(sub(b,a),sub(c,a)),normal)<0)[b,c]=[c,b];
  const len=Math.hypot(...normal)||1,n=normal.map(v=>v/len);
  out.push(...a,...n,...b,...n,...c,...n);
}
const quad=(out,a,b,c,d,n)=>{triangle(out,a,b,c,n);triangle(out,a,c,d,n);};
const arr=p=>[p.x,p.y,p.z];
const up=[0,1,0];
const outside=(a,b)=>{const x=a.x+b.x,z=a.z+b.z,r=Math.hypot(x,z)||1;return [x/r,0,z/r];};
function vertical(out,a,b,bottom,top){
  const n=outside(a,b);
  quad(out,[a.x,bottom,a.z],[b.x,bottom,b.z],[b.x,top,b.z],[a.x,top,a.z],n);
}
export const ArchitectureEngine={
  build(input,{segments=128,bands=10}={}){
    const geometry=input?.spec&&typeof input.point==='function'?input:GeometryEngine.create(input);
    const {spec,point}=geometry;
    if(!Number.isInteger(segments)||segments<32||segments>512)throw Error('Invalid architecture resolution');
    if(!Number.isInteger(bands)||bands<2||bands>32)throw Error('Invalid architecture bands');
    const layers={decks:[],fascias:[],concourse:[],facade:[],glazing:[],trim:[],aisles:[],stepEdges:[],backWall:[],pilasters:[],soffit:[],roofDeck:[],buildingRoof:[],brickBase:[],brickPiers:[],entryMasonry:[],entryGlass:[],towerFrames:[],towerCrown:[],towerRibs:[],entryBrick:[],entryCurtain:[],entryFrames:[],entryCanopy:[],entryDoors:[],externalTrim:[]};
    const insideTier=(tier,angle)=>{
      const map=spec.sectionMap?.[tier];
      if(!map)return true;
      return map.some(group=>{
        const offset=((angle-group.startAngle)%TAU+TAU)%TAU;
        return offset<=group.spanAngle+1e-8;
      });
    };
    const strip=(out,fn1,fn2,n=up,predicate=()=>true)=>{
      for(let i=0;i<segments;i++){
        const a=i*TAU/segments,b=(i+1)*TAU/segments;
        if(!predicate((a+b)/2))continue;
        const p=fn1(a),q=fn1(b),r=fn2(b),s=fn2(a);
        quad(out,arr(p),arr(q),arr(r),arr(s),n);
      }
    };
    for(const tier of spec.tiers){
      for(let j=0;j<bands;j++){
        const u=j/bands,v=(j+1)/bands;
        for(let i=0;i<segments;i++){
          const a=i*TAU/segments,b=(i+1)*TAU/segments;
          if(!insideTier(tier.index,(a+b)/2))continue;
          const p=point(tier.index,a,u),q=point(tier.index,b,u),r=point(tier.index,b,v),s=point(tier.index,a,v);
          const mid=(a+b)/2,rise=tier.rows*tier.rise,depth=tier.rows*tier.depth;
          const grade=rise/depth;
          const normal=[-Math.cos(mid)*grade,1,-Math.sin(mid)*grade];
          const push=x=>[x.x,x.y-.20,x.z];
          quad(layers.decks,push(p),push(q),push(r),push(s),normal);
        }
      }
      for(const frac of [0,1])for(let i=0;i<segments;i++){
        const a=i*TAU/segments,b=(i+1)*TAU/segments;
        if(!insideTier(tier.index,(a+b)/2))continue;
        const p=point(tier.index,a,frac),q=point(tier.index,b,frac);
        vertical(layers.fascias,p,q,p.y-.65,p.y-.15);
      }
      const outer=a=>point(tier.index,a,1,.12);
      const beyond=a=>point(tier.index,a,1,.36);
      strip(layers.trim,a=>({...outer(a),y:outer(a).y+.05}),
        a=>({...beyond(a),y:beyond(a).y+.05}),up,
        angle=>insideTier(tier.index,angle));
    }
    for(let t=0;t<spec.tiers.length-1;t++){
      const first=a=>point(t,a,1),second=a=>point(t+1,a,0);
      // Each circulation deck is flat, with height determined by the lower tier.
      const y=spec.tiers[t].baseY+spec.tiers[t].rows*spec.tiers[t].rise+.18;
      strip(layers.concourse,a=>({...first(a),y}),a=>({...second(a),y}),up,
        angle=>insideTier(t,angle)&&insideTier(t+1,angle));
    }
    const outerTier=spec.tiers.length-1;
    const indoor=spec.template==='indoor-arena';
    const rearY=point(outerTier,0,1).y;
    const slabY=rearY-.20;
    const roofY=rearY+4.85;
    const galleryWidth=indoor?5.1:4.2;
    const inner=a=>point(outerTier,a,1,.15);
    const outer=a=>point(outerTier,a,1,galleryWidth);
    strip(layers.concourse,a=>({...inner(a),y:slabY}),a=>({...outer(a),y:slabY}));
    strip(layers.soffit,a=>({...inner(a),y:slabY-.32}),a=>({...outer(a),y:slabY-.32}),[0,-1,0]);
    if(indoor){
      const overhang=a=>point(outerTier,a,1,galleryWidth+.32);
      strip(layers.roofDeck,a=>({...inner(a),y:roofY}),a=>({...overhang(a),y:roofY}));
      strip(layers.soffit,a=>({...inner(a),y:roofY-.38}),a=>({...overhang(a),y:roofY-.38}),[0,-1,0]);
      // Preserve the perimeter canopy but keep the central arena open so
      // seats and the full exterior can be inspected together in overview.
    }
    for(let i=0;i<segments;i++){
      const a=i*TAU/segments,b=(i+1)*TAU/segments,p=outer(a),q=outer(b);
      const top=indoor?roofY:rearY+.98;
      const windows=indoor?[[2.5,3.35],[8.5,9.6],[slabY+1,roofY-.65]]
        .filter(([low,high])=>low>0&&low<high).sort(([x],[y])=>x-y):[];
      const pier=i%8===0;
      const inset=angle=>point(outerTier,angle,1,galleryWidth-.18);
      let previous=0;
      for(const [low,high] of windows){
        if(low>=top)break;
        const sill=Math.max(previous,low),head=Math.min(high,top);
        if(head<=sill)continue;
        if(sill>previous)vertical(layers.facade,p,q,previous,sill);
        if(pier)vertical(layers.facade,p,q,sill,head);
        else vertical(layers.glazing,inset(a),inset(b),sill,head);
        previous=head;
      }
      if(top>previous)vertical(layers.facade,p,q,previous,top);
      vertical(layers.trim,p,q,slabY-.32,slabY);
      const ia=inner(a),ib=inner(b),n=outside(ia,ib).map(v=>-v);
      quad(layers.backWall,[ia.x,slabY-.32,ia.z],[ib.x,slabY-.32,ib.z],
        [ib.x,slabY+.55,ib.z],[ia.x,slabY+.55,ia.z],n);
      if(pier){
        const post=point(outerTier,(a+b)/2,1,galleryWidth-1.25);
        addRoundVolume(layers.pilasters,post.x,post.z,.33,0,indoor?roofY-.36:slabY-.32);
      }
    }
    // Aisles are real unoccupied angular wedges in SeatingEngine, not raised
    // meshes spanning occupied chairs. Architectural overlays stay on the deck.
    for(const tier of spec.tiers){
      const angles=spec.sectionMap?.[tier.index]
        ?spec.sectionMap[tier.index].flatMap(group=>{
          const total=group.weights.reduce((sum,w)=>sum+w,0);
          let offset=0;
          return group.sectionIds.map((_,index)=>{
            const angle=group.startAngle+group.spanAngle*offset/total;
            offset+=group.weights[index];
            return angle;
          });
        })
        :Array.from({length:spec.sections},(_,i)=>i*TAU/spec.sections);
      for(const angle of angles){
      for(let row=0;row<tier.rows;row++){
        const u=row/tier.rows,v=(row+1)/tier.rows;
        const p=point(tier.index,angle,u),q=point(tier.index,angle,v);
        const width=spec.aisleWidth*.40;
        const dx=-Math.sin(angle)*width,dz=Math.cos(angle)*width;
        const a=[p.x-dx,p.y-.185,p.z-dz],b=[p.x+dx,p.y-.185,p.z+dz],
          c=[q.x+dx,q.y-.185,q.z+dz],d=[q.x-dx,q.y-.185,q.z-dz];
        quad(layers.aisles,a,b,c,d,up);
        const delta=.02;
        quad(layers.stepEdges,[d[0],d[1]+delta,d[2]],[c[0],c[1]+delta,c[2]],
          [c[0],c[1]+delta+.015,c[2]],[d[0],d[1]+delta+.015,d[2]],[Math.cos(angle),0,Math.sin(angle)]);
      }
      }
    }
    // An optional exterior profile reuses the identical mesh-building code
    // used for OSU. Existing generic venues without a profile retain their
    // original neutral shell and can be upgraded by editing JSON only.
    if(spec.exterior){
      const generated=ExteriorEngine.build({
        footprint:angle=>{
          const p=point(outerTier,angle,1,galleryWidth);
          return {x:p.x,z:p.z};
        },
        height:Math.max(8,indoor?roofY:rearY+.98),
        segments,
        profile:spec.exterior.profile,
        entrances:spec.exterior.entrances
      });
      layers.facade=[...generated.metalPanels];
      layers.glazing=[...generated.baseWindows];
      layers.externalTrim=[...generated.metalSeams];
      layers.brickBase=[...generated.brickBase];
      layers.brickPiers=[...generated.brickPiers];
      layers.entryMasonry=[...generated.towerBrick];
      layers.entryGlass=[...generated.towerWindows];
      for(const key of ['towerFrames','towerCrown','towerRibs','entryBrick',
        'entryCurtain','entryFrames','entryCanopy','entryDoors']){
        layers[key]=[...generated[key]];
      }
    }
    // Distinct roof envelopes, signature entry forms and landmark structures.
    // They never reuse the generic rotunda used by the earlier placeholders.
    const signatureMesh=SignatureArchitectureEngine.build(geometry,
      {segments,galleryWidth,roofY});
    if(signatureMesh)for(const [key,mesh] of Object.entries(signatureMesh)){
      if(!layers[key])layers[key]=[];
      for(const value of mesh)layers[key].push(value);
    }
    return Object.fromEntries(Object.entries(layers).map(([key,data])=>[key,new Float32Array(data)]));
  }
};
export default ArchitectureEngine;
