// Native visual geometry for the Schottenstein Center basketball configuration.
// Metres are modeled estimates except for regulation court and published ribbon height.
const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const deckBottom=[-.28,6.75,12.99];
const HIDDEN_IN_CUTAWAY = -2;
const INWARD_FACING = -3;

function spanBox(add,a,b,y,height,depth,color,id=-1) {
  add([(a.x+b.x)/2,y,(a.z+b.z)/2],[distance(a,b)+.018,height,depth],
    Math.atan2(a.z-b.z,b.x-a.x),color,id);
}

function addChartRegions(add,color,features,spanAt) {
  for(const feature of features){
    const limits=feature.outline.map(p=>p.x);
    const near=Math.min(...limits),far=Math.max(...limits);
    const segments=Math.ceil((far-near)/.40), depth=(far-near)/segments;
    const tint=color(feature.kind==='press'?'#54525a':feature.kind==='band'?'#60636b':'#9498a2');
    for(let i=0;i<segments;i++){
      const x=near+(i+.5)*depth;
      for(const [lo,hi] of spanAt([feature.outline],x)){
        add([x,feature.y-.081,(lo+hi)/2],[depth+.003,.16,hi-lo],0,tint);
      }
    }
  }
}

export function addSchottensteinBowl(add,color,footprints,rows,features,spanAt) {
  const tread=color('#79767d'), fascia=color('#393237');
  const suite=color('#574e4b'), glass=color('#887e71');
  const red=color('#a51c30'), led=color('#c94b41');
  // The bowl renders only the slabs under the seat-bearing row runs.
  // Leave circulation gaps open where the chart shows a break.
  for(const {left,right,y,depth,tier} of rows){
    const slab=Math.min(y-deckBottom[tier],.82);
    spanBox(add,left,right,y-slab*.5,slab,depth,tread);
  }

  addChartRegions(add,color,features,spanAt);

  const point=(angle,rx,rz)=>{
    const x=Math.cos(angle),z=Math.sin(angle);
    return {x:rx*Math.sign(x)*Math.abs(x)**.68,z:rz*Math.sign(z)*Math.abs(z)**.68};
  };
  const terracePoints=footprints.filter(section=>section.tier===2).flatMap(section=>section.outlines.flat());
  const outerX=Math.max(...terracePoints.map(p=>Math.abs(p.x)))+1.5;
  const outerZ=Math.max(...terracePoints.map(p=>Math.abs(p.z)))+2.5;
  // Recessed suite band, ribbon and upper fascia observed in the arena photos.
  for(let i=0;i<64;i++){
    const a=i*2*Math.PI/64,b=(i+1)*2*Math.PI/64;
    const p=point(a,outerX*.67,outerZ*.72),q=point(b,outerX*.67,outerZ*.72);
    spanBox(add,p,q,12.46,1.9,.48,suite,INWARD_FACING);
    const face=pos=>{
      const radius=Math.hypot(pos.x,pos.z);
      return {x:pos.x-.27*pos.x/radius,z:pos.z-.27*pos.z/radius};
    };
    spanBox(add,face(mix(p,q,.10)),face(mix(p,q,.88)),12.51,1.03,.045,glass,INWARD_FACING);
    spanBox(add,p,q,13.47,.9144,.39,led,INWARD_FACING);
    spanBox(add,p,q,13.98,.14,.43,fascia,INWARD_FACING);
    const outerA=point(a,outerX,outerZ),outerB=point(b,outerX,outerZ);
    spanBox(add,outerA,outerB,22.6,6.7,.95,color('#353139'),HIDDEN_IN_CUTAWAY);
    spanBox(add,outerA,outerB,26.1,.33,.90,red,HIDDEN_IN_CUTAWAY);
  }
  // Interior overhead structure is visible from the spectator camera.
  const ceiling=color('#27262b'), truss=color('#535057'), light=color('#ddd8cf');
  const roofBays=Math.ceil(outerZ*2/8),bayDepth=outerZ*2/roofBays;
  for(let i=0;i<roofBays;i++){
    const z=-outerZ+(i+.5)*bayDepth;
    const half=Math.max(outerX*.55,outerX-Math.max(0,Math.abs(z)-outerZ*.58)*.6);
    add([0,30.5,z],[half*2,.36,bayDepth+.05],0,ceiling,HIDDEN_IN_CUTAWAY);
    add([0,29.55,z],[half*2,.34,.37],0,truss,HIDDEN_IN_CUTAWAY);
    add([0,28.7,z],[half*2,.12,.18],0,truss,HIDDEN_IN_CUTAWAY);
    for(let x=-half+5;x<half;x+=6){
      add([x,29.1,z],[.16,.90,.17],0,truss,HIDDEN_IN_CUTAWAY);
      if(Math.abs(x)<26&&Math.abs(z)<31)add([x,28.6,z],[1.22,.078,.21],0,light,HIDDEN_IN_CUTAWAY);
    }
  }
}

export function addSchottensteinBoard(add,color) {
  const housing=color('#232228'), trim=color('#981a2b'), led=color('#321e27');
  const panel=color('#3d212c'), ribbon=color('#b5273c');
  const center=16.3, height=3.9, half=3.68, bow=.42;
  add([0,center-.05,0],[6.85,4.05,6.85],0,housing);
  for(const sign of [-1,1]){
    for(const side of [false,true]){
      const point=(x,out=0)=>{
        const ext=sign*(3.73+bow*(1-(x/half)**2)+out);
        return side?{x:ext,z:x}:{x,z:ext};
      };
      for(let i=0;i<16;i++){
        const a=point(-half+i*half/8),b=point(-half+(i+1)*half/8);
        spanBox(add,a,b,center,height,.32,i%4===0?panel:led);
        const outerA=point(-half+i*half/8,.17),outerB=point(-half+(i+1)*half/8,.17);
        spanBox(add,outerA,outerB,center+1.23,.86,.055,trim);
        spanBox(add,outerA,outerB,center-1.15,.66,.059,ribbon);
        spanBox(add,a,b,center-height/2-.14,.27,.37,trim);
        spanBox(add,a,b,center+height/2+.09,.18,.33,housing);
      }
    }
  }
  add([0,14.03,0],[5.3,.37,5.3],0,housing);
  for(const x of [-1.19,1.19])for(const z of [-1.19,1.19]){
    add([x,13.83,z],[2.19,.035,2.19],0,color('#bc4250'));
    add([x*1.65,22.6,z*1.65],[.042,8.9,.042],0,housing);
  }
}
