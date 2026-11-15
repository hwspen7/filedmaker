// Native visual geometry for the Schottenstein Center basketball configuration.
// Metres are modeled estimates except for regulation court and published ribbon height.
import { SCHOTTENSTEIN_TERRACE_RIM, schottensteinDeckHeight, schottensteinDeckPoint } from '../schottensteinSeating.mjs';
const mix = (a,b,t) => ({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const roofHeight = SCHOTTENSTEIN_TERRACE_RIM.rear + 4.85;
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
    const tint=color(feature.kind==='press'?'#696258':feature.kind==='band'?'#5e594f':'#898073');
    for(let i=0;i<segments;i++){
      const x=near+(i+.5)*depth;
      for(const [lo,hi] of spanAt([feature.outline],x)){
        add([x,feature.y-.081,(lo+hi)/2],[depth+.003,.16,hi-lo],0,tint);
      }
    }
  }
}

// Filter the whole circle, then carry any remaining chair clearance out
// over neighbouring stations. The correction uses a rounded falloff so an
// isolated outer chair does not turn into a spur in the visible edge.
function smoothDeckEdge(rim, property, direction) {
  const radius = 6;
  const wraps = index => (index + rim.length) % rim.length;
  const smoothed = rim.map((_, i) => {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      sum += (radius + 1 - Math.abs(offset)) * rim[wraps(i + offset)][property];
    }
    return sum / (radius + 1) ** 2;
  });
  const clearance = rim.map((r, i) => Math.max(0, direction * (r[property] - smoothed[i])));
  return smoothed.map((r, i) => {
    let correction = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      const weight = .5 + .5 * Math.cos(Math.PI * offset / radius);
      correction = Math.max(correction, weight * clearance[wraps(i + offset)]);
    }
    return r + direction * correction;
  });
}

// Use one continuous mesh per elevated deck, including the surface across
// section boundaries. The outer edge closes around the press-side cutout.
export function buildSchottensteinDecks(seats, footprints, showDecks) {
  const segments = 256, bands = 20, turn = 2 * Math.PI;
  const data = [];
  for (const tier of showDecks ? [1, 2] : []) {
    const rim = Array.from({length: segments}, (_, i) => {
      const angle = i * turn / segments;
      const front = schottensteinDeckPoint(tier, angle, 0);
      const rear = schottensteinDeckPoint(tier, angle, 1);
      return {angle, near: Math.hypot(front.x, front.z), far: Math.hypot(rear.x, rear.z)};
    });
    for (const {x,z,tier:seatTier} of seats) {
      if (seatTier !== tier) continue;
      const index = Math.floor((Math.atan2(z,x) / turn + 1) * segments) % segments;
      const r = Math.hypot(x,z);
      // Both sides of a mesh cell must extend beyond the chair's footprint.
      for (let i = -1; i <= 2; i++) {
        const edge = rim[(index+i+segments)%segments];
        edge.near = Math.min(edge.near, r - .55);
        edge.far = Math.max(edge.far, r + .60);
      }
    }
    const vertex = (x,z) => {
      const height = (x,z) => schottensteinDeckHeight(tier,{x,z}) - .12;
      const y = height(x,z), d = .10;
      const dx = (height(x+d,z) - height(x-d,z)) / (2*d);
      const dz = (height(x,z+d) - height(x,z-d)) / (2*d);
      const length = Math.hypot(dx,1,dz);
      return [x,y,z,-dx/length,1/length,-dz/length];
    };
    const inner = smoothDeckEdge(rim, 'near', -1);
    const outer = smoothDeckEdge(rim, 'far', 1);
    const grid = rim.map(({angle}, i) => Array.from({length: bands + 1}, (_, j) => {
      const r = inner[i] + (outer[i] - inner[i]) * j / bands;
      return vertex(r*Math.cos(angle),r*Math.sin(angle));
    }));
    const quad = (a,b,c,d) => data.push(...a,...b,...c,...a,...c,...d);
    for (let i = 0; i < segments; i++) {
      const a = grid[i], b = grid[(i+1)%segments];
      for (let j = 0; j < bands; j++) quad(a[j],b[j],b[j+1],a[j+1]);
      for (const [j,sign] of [[0,-1],[bands,1]]) {
        const edge = (station, drop) => {
          const point = grid[station % segments][j];
          const previous = grid[(station + segments - 1) % segments][j];
          const next = grid[(station + 1) % segments][j];
          const dx = next[0] - previous[0], dz = next[2] - previous[2];
          const length = Math.hypot(dx,dz);
          return [point[0],point[1]-drop,point[2],sign*dz/length,0,-sign*dx/length];
        };
        const x = edge(i,0), y = edge(i+1,0);
        const c = edge(i+1,.39), d = edge(i,.39);
        if (sign<0) quad(y,x,d,c);
        else quad(x,y,c,d);
      }
    }
  }
  // A thin presentation base, sized to the bowl rather than the floor diagram.
  const outlines = footprints.filter(section => section.tier === 2).flatMap(section => section.outlines.flat());
  const rx = Math.max(...outlines.map(point => Math.abs(point.x))) + 6;
  const rz = Math.max(...outlines.map(point => Math.abs(point.z))) + 7;
  const edge = (i, height, normal) => {
    const angle = i * turn / segments;
    const c = Math.cos(angle), s = Math.sin(angle);
    return [rx*c,height,rz*s,...normal];
  };
  for (let i = 0; i < segments; i++) {
    const angle = (i+.5) * turn / segments;
    const normal = [Math.cos(angle)/rx,0,Math.sin(angle)/rz];
    const top = -.54, bottom = -1.0;
    const a = edge(i,top,normal), b = edge(i+1,top,normal);
    const c = edge(i+1,bottom,normal), d = edge(i,bottom,normal);
    data.push(...a,...b,...c,...a,...c,...d);
    data.push(0,top,0,0,1,0,...edge(i+1,top,[0,1,0]),...edge(i,top,[0,1,0]));
  }
  return new Float32Array(data);
}

export function addSchottensteinBowl(add,color,footprints,rows,features,spanAt) {
  const tread=color('#81786d'), fascia=color('#575248');
  const suite=color('#a09783'), glass=color('#6c665b');
  const red=color('#962c3a'), led=color('#9f4650');
  // The entry level has distinct seating banks close to the court.
  // The elevated tiers use the continuous decks instead of row slabs.
  for(const {left,right,y,depth,tier} of rows){
    if(tier!==0)continue;
    const slab=Math.min(y+.28,.82);
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
  // Keep the ribbon below the forward edge of the reconstructed terrace.
  const ribbonTop = SCHOTTENSTEIN_TERRACE_RIM.front - .67;
  const outerTrim = SCHOTTENSTEIN_TERRACE_RIM.rear + 1.35;
  const outerWallBottom = 19.25;
  // Recessed suite band, ribbon and upper fascia observed in the arena photos.
  for(let i=0;i<64;i++){
    const a=i*2*Math.PI/64,b=(i+1)*2*Math.PI/64;
    const p=schottensteinDeckPoint(2,a,0),q=schottensteinDeckPoint(2,b,0);
    spanBox(add,p,q,ribbonTop-1.59,1.9,.48,suite,INWARD_FACING);
    const face=pos=>{
      const radius=Math.hypot(pos.x,pos.z);
      return {x:pos.x-.27*pos.x/radius,z:pos.z-.27*pos.z/radius};
    };
    spanBox(add,face(mix(p,q,.10)),face(mix(p,q,.88)),ribbonTop-1.54,1.03,.045,glass,INWARD_FACING);
    spanBox(add,p,q,ribbonTop-.58,.9144,.39,led,INWARD_FACING);
    spanBox(add,p,q,ribbonTop-.07,.14,.43,fascia,INWARD_FACING);
    const outerA=point(a,outerX,outerZ),outerB=point(b,outerX,outerZ);
    spanBox(add,outerA,outerB,(outerWallBottom+outerTrim)/2,outerTrim-outerWallBottom,.95,color('#353139'),HIDDEN_IN_CUTAWAY);
    spanBox(add,outerA,outerB,outerTrim+.16,.33,.90,red,HIDDEN_IN_CUTAWAY);
  }
  // Interior overhead structure is visible from the spectator camera.
  const ceiling=color('#27262b'), truss=color('#535057'), light=color('#ddd8cf');
  const roofBays=Math.ceil(outerZ*2/8),bayDepth=outerZ*2/roofBays;
  for(let i=0;i<roofBays;i++){
    const z=-outerZ+(i+.5)*bayDepth;
    const half=Math.max(outerX*.55,outerX-Math.max(0,Math.abs(z)-outerZ*.58)*.6);
    add([0,roofHeight,z],[half*2,.36,bayDepth+.05],0,ceiling,HIDDEN_IN_CUTAWAY);
    add([0,roofHeight-.95,z],[half*2,.34,.37],0,truss,HIDDEN_IN_CUTAWAY);
    add([0,roofHeight-1.8,z],[half*2,.12,.18],0,truss,HIDDEN_IN_CUTAWAY);
    for(let x=-half+5;x<half;x+=6){
      add([x,roofHeight-1.4,z],[.16,.90,.17],0,truss,HIDDEN_IN_CUTAWAY);
      if(Math.abs(x)<26&&Math.abs(z)<31)add([x,roofHeight-1.9,z],[1.22,.078,.21],0,light,HIDDEN_IN_CUTAWAY);
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
  const hangerBottom = 18.15, hangerTop = roofHeight - .95;
  for(const x of [-1.19,1.19])for(const z of [-1.19,1.19]){
    add([x,13.83,z],[2.19,.035,2.19],0,color('#bc4250'));
    add([x*1.65,(hangerBottom+hangerTop)/2,z*1.65],[.042,hangerTop-hangerBottom,.042],0,housing);
  }
}
