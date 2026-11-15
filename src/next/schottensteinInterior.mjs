// Native visual geometry for the Schottenstein Center basketball configuration.
// Metres are modeled estimates except for regulation court and published ribbon height.
const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const deckBottom=[-.28,6.75,12.99];
const rowHeightAt=(profile,point)=>{
  const depth=-profile.nx*point.x-profile.nz*point.z;
  const row=Math.max(0,Math.min(profile.depthRows-1,(depth-profile.near)/profile.treadDepth-.5));
  return profile.frontHeight+row*profile.rise;
};
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

function addDeckRims(add,footprints,fascia,edge) {
  for(let tier=0;tier<deckBottom.length;tier++){
    const deck=footprints.filter(profile=>profile.tier===tier);
    if(!deck.length)continue;
    const rim=deck.flatMap(profile=>profile.corners.slice(0,2)).sort((a,b)=>
      Math.atan2(a.z,a.x)-Math.atan2(b.z,b.x));
    const top=deck[0].frontHeight-.055,bottom=deckBottom[tier];
    for(let i=0;i<rim.length;i++){
      const a=rim[i],b=rim[(i+1)%rim.length];
      if(distance(a,b)<.06)continue;
      spanBox(add,a,b,(top+bottom)*.5,top-bottom,.23,fascia);
      spanBox(add,a,b,top-.06,.075,.25,edge);
    }
  }
}

export function addSchottensteinBowl(add,color,footprints,rows,features,spanAt) {
  const tread=color('#a0a0a4'), fascia=color('#393237'), edge=color('#bcb9b8');
  const rail=color('#211f23'), suite=color('#574e4b'), glass=color('#887e71');
  const red=color('#a51c30'), led=color('#c94b41');
  if(rows.length)addDeckRims(add,footprints,fascia,edge);
  for(const row of rows){
    const {left,right,y,depth,rise}=row;
    const forward={x:Math.sin(row.yaw),z:Math.cos(row.yaw)};
    const a={x:left.x+forward.x*.025,z:left.z+forward.z*.025};
    const b={x:right.x+forward.x*.025,z:right.z+forward.z*.025};
    const slab=Math.min(y-deckBottom[row.tier],Math.max(.52,rise*1.8));
    spanBox(add,a,b,y-slab*.5,slab,depth*1.025,tread);
    const noseA={x:a.x+forward.x*depth/2,z:a.z+forward.z*depth/2};
    const noseB={x:b.x+forward.x*depth/2,z:b.z+forward.z*depth/2};
    spanBox(add,noseA,noseB,y-.028,.052,.048,edge);
  }
  const profileBySection=new Map(footprints.map(profile=>[profile.id,profile]));
  for(const row of rows){
    const profile=profileBySection.get(row.sectionId);
    const front=row.slot===0, rear=row.slot===profile.depthRows-1;
    if(front){
      if(row.tier>0){
        spanBox(add,row.left,row.right,row.y+.49,.045,.052,rail);
        for(let q=0;q<=1;q+=.25){
          const p=mix(row.left,row.right,q);
          add([p.x,row.y+.23,p.z],[.045,.53,.045],0,rail);
        }
      }
    }
    if(rear)spanBox(add,row.left,row.right,row.y-.36,.5,.27,fascia);
  }
  const pressSide=profileBySection.get('323');
  if(pressSide){
    const {corners:[a,b,c,d],frontHeight,depthRows,rise}=pressSide;
    // Section 323's published gap behind row B remains a circulation break.
    for(let depth=2;depth<5;depth++){
      const t=(depth+.5)/depthRows, x=mix(a,c,t), z=mix(b,d,t);
      const panelDepth=(distance(a,c)+distance(b,d))/2/depthRows;
      spanBox(add,x,z,frontHeight+rise*.95,.27,panelDepth*1.03,tread);
    }
  }

  const aisleEdges=footprints.flatMap(profile=>{
    const [a,b,c,d]=profile.corners;
    return [{front:a,back:c,profile},{front:b,back:d,profile}];
  });
  const matched=new Set();
  for(let i=0;i<aisleEdges.length;i++){
    const a=aisleEdges[i];
    if(matched.has(i)) continue;
    let best=-1,bestCost=Infinity;
    for(let j=i+1;j<aisleEdges.length;j++){
      const b=aisleEdges[j];
      if(matched.has(j)||a.profile.tier!==b.profile.tier)continue;
      const front=distance(a.front,b.front),back=distance(a.back,b.back);
      if(front<.45||front>2.95||back<.45||back>3.25||Math.abs(a.profile.frontHeight-b.profile.frontHeight)>.08)continue;
      if(front+back<bestCost){best=j;bestCost=front+back;}
    }
    if(best<0)continue;
    const b=aisleEdges[best];
    matched.add(i);matched.add(best);
    const steps=Math.min(a.profile.depthRows,b.profile.depthRows);
    const stepDepth=(distance(a.front,a.back)+distance(b.front,b.back))/(2*steps);
    for(let j=0;j<steps;j++){
      const t=(j+.5)/steps;
      const p=mix(a.front,a.back,t),q=mix(b.front,b.back,t);
      const width=distance(p,q);
      if(width<.42||width>3.15)continue;
      const height=(rowHeightAt(a.profile,p)+rowHeightAt(b.profile,q))*.5;
      spanBox(add,mix(p,q,.08),mix(p,q,.92),height-.095,.19,stepDepth*.97,tread);
      const m=mix(p,q,.5);
      if(j%3===0)add([m.x,height+.36,m.z],[.038,.72,.038],0,rail);
      if(j>0){
        const prevT=(j-.5)/steps;
        const prev=mix(mix(a.front,a.back,prevT),mix(b.front,b.back,prevT),.5);
        spanBox(add,prev,m,height+.65,.048,.044,rail);
      }
    }
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
    spanBox(add,mix(p,q,.10),mix(p,q,.88),12.51,1.03,.49,glass,INWARD_FACING);
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
