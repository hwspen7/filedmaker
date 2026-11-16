// Reference-driven architectural silhouettes for Big Ten arena reconstructions.
// These meshes are identifiable study geometry, NOT surveyed CAD buildings.
// Every output is a triangle list of XYZ + outward vertex normals.
const TAU=Math.PI*2;
const v=(x,y,z)=>[x,y,z];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function tri(out,a,b,c,n){
  if(dot(cross(sub(b,a),sub(c,a)),n)<0)[b,c]=[c,b];
  const m=Math.hypot(...n)||1,N=n.map(x=>x/m);
  out.push(...a,...N,...b,...N,...c,...N);
}
const quad=(out,a,b,c,d,n)=>{tri(out,a,b,c,n);tri(out,a,c,d,n);};
function box(out,center,tangent,outward,width,depth,low,high){
  const p=(s,r,y)=>v(center[0]+s*tangent[0]+r*outward[0],
    y,center[2]+s*tangent[2]+r*outward[2]);
  const a=p(-width/2,-depth/2,low),b=p(width/2,-depth/2,low),
    c=p(width/2,depth/2,low),d=p(-width/2,depth/2,low);
  const A=p(-width/2,-depth/2,high),B=p(width/2,-depth/2,high),
    C=p(width/2,depth/2,high),D=p(-width/2,depth/2,high);
  quad(out,a,b,B,A,outward.map(x=>-x));quad(out,b,c,C,B,tangent);
  quad(out,c,d,D,C,outward);quad(out,d,a,A,D,tangent.map(x=>-x));
  quad(out,A,B,C,D,[0,1,0]);quad(out,d,c,b,a,[0,-1,0]);
}
function roofHeight(style,rise,t,a){
  const dome=(1-t*t);
  switch(style){
    case 'folded-dome':return rise*dome+.33*dome*Math.cos(32*a);
    case 'copper-dome':return rise*Math.sqrt(Math.max(0,1-t*t));
    case 'saddle':return rise*(.44*dome+.28*dome*t*t*Math.cos(2*a));
    case 'truss-arch':return rise*(1-t*t)**.72;
    case 'barrel':return rise*dome*(.75+.25*Math.cos(a)**2);
    case 'gable':
    case 'gable-skylight':return rise*dome*(.80+.20*Math.abs(Math.sin(a)));
    case 'trapezoid':return rise*dome*(.65+.35*Math.abs(Math.cos(a)));
    case 'swept':return rise*dome*(.8+.2*t*Math.cos(a));
    case 'oval-low':return rise*dome;
    case 'low-crown':return rise*dome*.75;
    default:return rise*dome*.35;
  }
}
const rooffinish={white:'roofWhite',copper:'roofCopper',slate:'roofSlate',pale:'roofPale'};
export const SignatureArchitectureEngine={
  build(geometry,{segments=128,galleryWidth=5.1,roofY}={}){
    const {spec,point}=geometry,signature=spec.exterior?.signature;
    if(!signature)return null;
    const {roof,finish,feature,roofRise,entryAngle}=signature;
    const last=spec.tiers.length-1,base=Number(roofY),rise=Number(roofRise);
    const output=Object.fromEntries(['roofWhite','roofCopper','roofSlate','roofPale','radialBeams',
      'entryMasonry','entryGlass','entryFrames','entryCanopy','entryDoors',
      'towerBrick','towerWindows','brickPiers'].map(name=>[name,[]]));
    const perimeter=a=>point(last,a,1,galleryWidth+.1);
    const sample=(t,a)=>{const p=perimeter(a);
      return v(p.x*t,base+roofHeight(roof,rise,t,a),p.z*t);
    };
    const roofTarget=output[rooffinish[finish]??'roofSlate'],rings=22;
    for(let j=0;j<rings;j++){
      const u=.018+(1-.018)*j/rings,w=.018+(1-.018)*(j+1)/rings;
      for(let i=0;i<segments;i++){
        const a=i*TAU/segments,b=(i+1)*TAU/segments;
        quad(roofTarget,sample(u,a),sample(u,b),sample(w,b),sample(w,a),[0,1,0]);
      }
    }
    const edgeColor=output.radialBeams;
    if(['folded-dome','truss-arch','barrel','saddle','gable-skylight'].includes(roof)){
      const count=roof==='folded-dome'?32:roof==='truss-arch'?22:roof==='barrel'?18:roof==='saddle'?14:12;
      for(let i=0;i<count;i++){
        const a=i*TAU/count;
        for(let j=0;j<18;j++){
          const u=.08+.87*j/18,w=.08+.87*(j+1)/18,da=.005;
          const p=t=>sample(t,a);
          const x=p(u),y=p(w);
          const p1=v(x[0],x[1]+.11,x[2]),p2=v(y[0],y[1]+.11,y[2]);
          const q1=v(p1[0]+Math.sin(a)*da*20,p1[1],p1[2]-Math.cos(a)*da*20);
          const q2=v(p2[0]+Math.sin(a)*da*20,p2[1],p2[2]-Math.cos(a)*da*20);
          quad(edgeColor,p1,p2,q2,q1,[0,1,0]);
        }
      }
    }
    const frame=(angle,offset=1.5)=>{
      const p=perimeter(angle),out=v(Math.cos(angle),0,Math.sin(angle));
      const tan=v(-Math.sin(angle),0,Math.cos(angle));
      return {out,tan,center:v(p.x+offset*out[0],0,p.z+offset*out[2])};
    };
    const {out,tan,center}=frame(entryAngle,2.1);
    const entryWidth=feature==='multi-story-glass'?31:
      feature==='curved-glass'?42:feature==='terracotta-glass'?34:
      feature==='glass-oval'?21:feature==='roman-arches'?30:26;
    const tall=['multi-story-glass','curved-glass','glass-oval','south-glass-atrium'].includes(feature);
    const entryHeight=Math.min(base-1,tall?18:12.5);
    // Cut-through-looking front curtain wall with actual mullion geometry.
    const front=v(center[0]+out[0]*1.55,0,center[2]+out[2]*1.55);
    const pp=(s,y)=>v(front[0]+tan[0]*s,y,front[2]+tan[2]*s);
    if(feature==='roman-arches'){
      for(let i=0;i<5;i++){
        const s=(i-2)*5.4;
        quad(output.entryGlass,pp(s-2.05,2.2),pp(s+2.05,2.2),
          pp(s+2.05,8.7),pp(s-2.05,8.7),out);
        // Semi-circular stone arch (a sequence of raised pointed lintel facets).
        for(let k=0;k<12;k++){
          const a=Math.PI*k/12,b=Math.PI*(k+1)/12;
          const q=x=>pp(s+2.06*Math.cos(x),8.7+2.06*Math.sin(x));
          const Q=x=>pp(s+2.44*Math.cos(x),8.7+2.44*Math.sin(x));
          quad(output.entryMasonry,q(a),q(b),Q(b),Q(a),out);
        }
        box(output.brickPiers,v(pp(s-2.6,0)[0],0,pp(s-2.6,0)[2]),tan,out,.5,.75,0,12);
      }
    }else{
      const top=feature==='historic-brick'?9:entryHeight;
      for(let i=0;i<12;i++){
        const a=entryWidth*(i/12-.5),b=entryWidth*((i+1)/12-.5);
        quad(output.entryGlass,pp(a,.6),pp(b,.6),pp(b,top),pp(a,top),out);
        if(i<11){
          const x=b;
          quad(output.entryFrames,pp(x-.09,.6),pp(x+.09,.6),
            pp(x+.09,top),pp(x-.09,top),out);
        }
      }
      box(output.entryFrames,front,tan,out,entryWidth+.6,.25,top,top+.34);
      if(feature==='glass-oval'){
        // Thirty-six-foot entrance glazed oval is vertically expressed in the facade.
        for(let i=0;i<24;i++){
          const a=i*TAU/24,b=(i+1)*TAU/24;
          const p=t=>pp(10.5*Math.cos(t),9+8.8*Math.sin(t));
          const P=t=>pp(10.8*Math.cos(t),9+9.1*Math.sin(t));
          quad(output.entryFrames,p(a),p(b),P(b),P(a),out);
        }
      }
      if(feature!=='metal-overhang'){
        const canopy=v(front[0]+out[0]*2.1,0,front[2]+out[2]*2.1);
        box(output.entryCanopy,canopy,tan,out,entryWidth+5,4.2,5.25,5.54);
      }
    }
    for(const s of [-1,1]){
      const p=v(front[0]+tan[0]*s*(entryWidth/2+1.3),0,
        front[2]+tan[2]*s*(entryWidth/2+1.3));
      box(output.entryMasonry,p,tan,out,2.15,4,0,entryHeight+1);
    }
    if(feature==='four-turrets'){
      for(let i=0;i<4;i++){
        const a=Math.PI/4+i*Math.PI/2,{center:c,out:o,tan:t}=frame(a,.4);
        box(output.towerBrick,c,t,o,8.8,8.8,0,Math.max(17,base+1));
        box(output.entryMasonry,c,t,o,10,10,Math.max(17,base+1),Math.max(17,base+1)+.6);
      }
    }
    if(feature==='ring-glass-and-radial-pylons'){
      for(let i=0;i<24;i++){
        const a=i*TAU/24,{center:c,out:o,tan:t}=frame(a,-.8);
        box(output.entryMasonry,c,t,o,2.2,4.6,0,Math.min(base,11.3));
      }
    }
    if(feature==='southeast-pavilion'||feature==='multi-story-glass'){
      const pavilion=feature==='southeast-pavilion'?frame(5.48,5.8):frame(entryAngle,5);
      box(output.entryGlass,pavilion.center,pavilion.tan,pavilion.out,
        feature==='multi-story-glass'?27:21,7.5,0,Math.min(base,20));
    }
    if(feature==='exposed-truss'){
      // External roof diagonals, present on the real Carver-Hawkeye entrance elevation.
      for(let i=0;i<12;i++){
        const a=i*TAU/12,p=sample(.95,a),q=sample(.40,a+.14);
        const above=x=>v(x[0],x[1]+.38,x[2]);
        const P=above(p),Q=above(q);
        quad(output.radialBeams,P,Q,v(Q[0]+.28,Q[1],Q[2]),v(P[0]+.28,P[1],P[2]),[0,1,0]);
      }
    }
    return Object.fromEntries(Object.entries(output).map(([k,a])=>[k,new Float32Array(a)]));
  }
};
export default SignatureArchitectureEngine;
