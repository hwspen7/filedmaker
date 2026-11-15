// Generic architectural assembly from analytic tiers, independent of OSU references.
import { GeometryEngine } from './geometry.mjs';
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
    const layers={decks:[],fascias:[],concourse:[],facade:[],glazing:[],trim:[],aisles:[],stepEdges:[]};
    const strip=(out,fn1,fn2,n=up)=>{
      for(let i=0;i<segments;i++){
        const a=i*TAU/segments,b=(i+1)*TAU/segments;
        const p=fn1(a),q=fn1(b),r=fn2(b),s=fn2(a);
        quad(out,arr(p),arr(q),arr(r),arr(s),n);
      }
    };
    for(const tier of spec.tiers){
      for(let j=0;j<bands;j++){
        const u=j/bands,v=(j+1)/bands;
        for(let i=0;i<segments;i++){
          const a=i*TAU/segments,b=(i+1)*TAU/segments;
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
        const p=point(tier.index,a,frac),q=point(tier.index,b,frac);
        vertical(layers.fascias,p,q,p.y-.65,p.y-.15);
      }
      const outer=a=>point(tier.index,a,1,.12);
      const beyond=a=>point(tier.index,a,1,.36);
      strip(layers.trim,a=>({...outer(a),y:outer(a).y+.05}),a=>({...beyond(a),y:beyond(a).y+.05}));
    }
    for(let t=0;t<spec.tiers.length-1;t++){
      const first=a=>point(t,a,1),second=a=>point(t+1,a,0);
      // Each circulation deck is flat, with height determined by the lower tier.
      const y=spec.tiers[t].baseY+spec.tiers[t].rows*spec.tiers[t].rise+.18;
      strip(layers.concourse,a=>({...first(a),y}),a=>({...second(a),y}));
    }
    const outerTier=spec.tiers.length-1;
    const outer=a=>point(outerTier,a,1,.72);
    for(let i=0;i<segments;i++){
      const a=i*TAU/segments,b=(i+1)*TAU/segments,p=outer(a),q=outer(b),top=Math.min(p.y,q.y)-.28;
      const glazing=spec.template==='indoor-arena';
      const windows=glazing?[[2.5,3.35],[8.5,9.6],[15,16.1]]:[];
      let previous=0;
      for(const [low,high] of windows){
        if(low>=top)break;
        if(low>previous)vertical(layers.facade,p,q,previous,low);
        const roof=Math.min(high,top);
        if(roof>low)vertical(layers.glazing,p,q,low,roof);
        previous=roof;
      }
      if(top>previous)vertical(layers.facade,p,q,previous,top);
      if(i%8===0)vertical(layers.trim,p,q,.05,top);
    }
    // Aisles are real unoccupied angular wedges in SeatingEngine, not raised
    // meshes spanning occupied chairs. Architectural overlays stay on the deck.
    for(const tier of spec.tiers)for(let section=0;section<spec.sections;section++){
      const angle=section*TAU/spec.sections;
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
    return Object.fromEntries(Object.entries(layers).map(([key,data])=>[key,new Float32Array(data)]));
  }
};
export default ArchitectureEngine;
