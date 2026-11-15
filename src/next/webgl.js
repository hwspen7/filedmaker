// Dependency-free WebGL2 venue renderer with instanced furnishings and optional
// structural deck meshes. No CDN required.
// Embedded eye/view helpers also permit standalone, zero-dependency school exports.
const seatViewAnchors=(seat,posture='seated')=>{const yaw=Number.isFinite(seat.yaw)?seat.yaw:Math.atan2(-seat.x,-seat.z);const f=posture==='leaning'?.38:posture==='standing'?.20:.23;return {eye:{x:seat.x+Math.sin(yaw)*f,y:seat.y+({seated:1.17,leaning:1.23,standing:1.60}[posture]||1.17),z:seat.z+Math.cos(yaw)*f}};};
function viewingTarget(surface,target='center',seat=null,scoreboardHeight=13.6){const x=surface.width/2,z=surface.length/2;
  if(target==='near-rim'||target==='far-rim'){
    const sign=(seat?.z<0?-1:1)*(target==='far-rim'?-1:1);
    return {x:0,y:3.05,z:sign*(z-1.6)};
  }
  if(target==='scoreboard')return{x:0,y:scoreboardHeight,z:0};
  if(target==='near'||target==='far'){const sign=(seat?.z<0?-1:1)*(target==='far'?-1:1);return{x:0,y:surface.sport==='basketball'?3:1.2,z:z*.65*sign};}
  if(target==='left')return{x:-x*.72,y:1.25,z:0};if(target==='right')return{x:x*.72,y:1.25,z:0};return{x:0,y:surface.sport==='basketball'?2.4:1.35,z:0};
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function perspective(fovy,aspect,near=.04,far=3000){const f=1/Math.tan(fovy/2),out=new Float32Array(16);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=2*far*near/(near-far);return out;}
function lookAt(eye,target,up=[0,1,0]){
  const z=norm(eye.map((v,i)=>v-target[i]));let x=norm(cross(up,z));if(Math.hypot(...cross(up,z))<.00001)x=[1,0,0];const y=cross(z,x);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function compile(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
function makeProgram(gl,vertex,fragment){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vertex));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
const VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 aLocal;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aPos;
layout(location=3) in vec3 aSize;
layout(location=4) in float aYaw;
layout(location=5) in vec3 aColor;
layout(location=6) in float aSeatId;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uHuman;
uniform float uRound;
uniform float uDeck;
uniform float uSelected;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorld;
void main(){
  if(uDeck>.5){
    vNormal=aNormal;
    // Separate presentation pedestal from first-person deck geometry.
    // It remains a thin stand under the bowl, never a gray backing shell.
    if(uDeck>20.5)vColor=vec3(.96,.84,.67); // Recessed warm architectural lights
    else if(uDeck>19.5)vColor=vec3(.30,.31,.32); // Structural roof soffit
    else if(uDeck>18.5)vColor=vec3(.47,.43,.40); // Deep fascia and beam edges
    else if(uDeck>17.5)vColor=vec3(.65,.61,.55); // Three-dimensional columns
    else if(uDeck>16.5)vColor=vec3(.27,.29,.30); // Window mullions and frames
    else if(uDeck>15.5)vColor=vec3(.55,.41,.31); // Warm gallery windows
    else if(uDeck>14.5)vColor=vec3(.20,.23,.25); // Recessed dark glazing
    else if(uDeck>13.5)vColor=vec3(.61,.59,.55); // Inner wall with true openings
    else if(uDeck>12.5)vColor=vec3(.64,.61,.57); // Exterior gallery shell
    else if(uDeck>11.5)vColor=vec3(.68,.64,.58); // Reserved for tread risers
    else if(uDeck>10.5)vColor=vec3(.82,.80,.76); // Reserved for aisle surfaces
    else if(uDeck>9.5)vColor=vec3(.72,.64,.54); // Muted champagne fascia trim
    else if(uDeck>8.5)vColor=vec3(.22,.25,.27); // Recessed graphite glazing
    else if(uDeck>7.5)vColor=vec3(.58,.57,.54); // Architectural warm-stone facade
    else if(uDeck>6.5)vColor=vec3(.75,.73,.69); // Continuous tier concourses
    else if(uDeck>5.5)vColor=vec3(.65,.63,.60); // Stepped row fascias
    else if(uDeck>4.5)vColor=vec3(.80,.78,.74); // Row-aligned stone seat decks
    else if(uDeck>2.5)vColor=vec3(.29,.30,.31); // Recessed plinth joints
    else if(uDeck>1.5)vColor=aNormal.y>.5?vec3(.53,.52,.50):vec3(.42,.41,.40);
    else vColor=mix(vec3(.76,.75,.73),vec3(.43,.43,.44),uHuman);
    vWorld=aLocal;
    gl_Position=uVP*vec4(aLocal,1.);
    return;
  }
  vec3 p=aLocal*aSize;
  vec3 n=aNormal;
  if(uRound>.5){
    float radius=min(.027,min(aSize.x,min(aSize.y,aSize.z))*.38);
    vec3 inset=aSize*.5-radius;
    vec3 core=clamp(p,-inset,inset);
    n=normalize(p-core);
    p=core+n*radius;
  }
  float c=cos(aYaw),s=sin(aYaw);
  vec3 r=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
  vec3 world=aPos+r;
  // Overhead elements stay visible from the seat and hidden in the cutaway.
  if(aSeatId == -2. && uHuman < .5){gl_Position=vec4(3.,3.,3.,1.);return;}
  // Nested seating decks expose the interior face of their ribbon and suites.
  if(aSeatId == -3. && uHuman > .5 && dot(uEye.xz-aPos.xz,aPos.xz)>0.){
    gl_Position=vec4(3.,3.,3.,1.);return;
  }
  // Suppress occupied chair and immediate camera-intersecting furniture.
  if(uHuman>.5 && aSeatId>=0. && (abs(aSeatId-uSelected)<.25 || distance(aPos,uEye)<.29)){gl_Position=vec4(3.,3.,3.,1.);return;}
  vNormal=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);
  vColor=aSeatId>=0. && abs(aSeatId-uSelected)<.25 ? vec3(.99,.63,.25) : aColor;
  vWorld=world;
  gl_Position=uVP*vec4(world,1.);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uEye;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal);
  vec3 sun=normalize(vec3(.45,.83,.34));
  float diffuse=max(0.,dot(n,sun));
  float fill=max(0.,dot(n,normalize(vec3(-.6,.45,-.55))));
  float strength=.48+.43*diffuse+.11*fill+.07*max(n.y,0.);
  vec3 base=pow(vColor,vec3(2.2));
  vec3 rgb=pow(base*strength,vec3(1./2.2));
  float haze=smoothstep(50.,245.,distance(vWorld,uEye))*.11;
  outColor=vec4(mix(rgb,vec3(.87,.86,.84),haze),1.);
}`;
const boxGeometry=()=>{
  const sides=[
    [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
    [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
    [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],
    [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
    [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
    [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
  ];
  const data=[];
  for(const [normal,p] of sides)for(const i of [0,1,2,0,2,3])data.push(...p[i],...normal);
  return new Float32Array(data);
};
function bevelGeometry(){
  const vertices=[],inset=.445;
  const triangle=(a,b,c)=>{
    const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
    const outward=a.map((v,i)=>v+b[i]+c[i]);
    const order=dot(cross(ab,ac),outward)>0?[a,b,c]:[a,c,b];
    for(const point of order)vertices.push(...point,0,1,0);
  };
  const quad=(a,b,c,d)=>{triangle(a,b,c);triangle(a,c,d);};
  for(let axis=0;axis<3;axis++){
    const u=(axis+1)%3,v=(axis+2)%3;
    for(const sign of [-1,1]){
      const point=(a,b)=>{
        const p=[0,0,0];
        p[axis]=sign*.5;p[u]=a*inset;p[v]=b*inset;
        return p;
      };
      quad(point(-1,-1),point(1,-1),point(1,1),point(-1,1));
      for(const edge of [-1,1]){
        const other=(length)=>{
          const p=point(edge,length);
          p[axis]=sign*inset;p[u]=edge*.5;
          return p;
        };
        quad(point(edge,-1),point(edge,1),other(1),other(-1));
      }
    }
  }
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
    triangle([x*.5,y*inset,z*inset],[x*inset,y*.5,z*inset],[x*inset,y*inset,z*.5]);
  }
  return new Float32Array(vertices);
}
const cube=boxGeometry(),roundedBox=bevelGeometry();
const instanceAttributes=[[2,3,0],[3,3,12],[4,1,24],[5,3,28],[6,1,40]];
const instanceStride=44;

export class NativeVenueRenderer {
  // Keep the real seat-view deck, not the gray overview backing sheet.
  // The renderer is also bundled as a classic script for offline exports.
  static deckVisibleInMode(plan, mode) {
    return mode === 'human' && Boolean(plan?.arenaInterior && plan?.deckGeometry?.length);
  }
  static pedestalVisibleInMode(plan, mode) {
    return mode !== 'human' && Boolean(plan?.arenaInterior && plan?.pedestalGeometry?.length);
  }
  static architectureVisibleInMode(plan,mode){
    return mode !== 'human' && Boolean(plan?.arenaInterior && plan?.architectureGeometry);
  }
  constructor(canvas,onPick=()=>{}){
    this.canvas=canvas;this.onPick=onPick;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(!gl)throw Error('WebGL2 is not available on this device. Use the 2D map instead.');
    this.gl=gl;
    this.program=makeProgram(gl,VERTEX,FRAGMENT);
    this.locations=Object.fromEntries(['VP','Eye','Human','Round','Selected','Deck']
      .map(name=>[name,gl.getUniformLocation(this.program,'u'+name)]));
    this.instances=gl.createBuffer();
    this.box=this.createMesh(cube);
    this.roundedBox=this.createMesh(roundedBox);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0,0,0,0);
    this.plan=null;this.mode='overview';this.pan=[0,0,0];this.theta=.68;this.phi=.87;this.distance=140;this.humanYaw=0;this.humanPitch=0;this.humanFov=63;this.viewOptions={posture:'seated',target:'center',zoom:1};
    this.bind();this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
  }
  createMesh(data){
    const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    for(let i=0;i<2;i++){
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12);
    }
    return {vao,buffer,vertices:data.length/6};
  }
  bindInstances(mesh,start){
    const gl=this.gl;
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
    for(const [loc,size,offset] of instanceAttributes){
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc,size,gl.FLOAT,false,instanceStride,start*instanceStride+offset);
      gl.vertexAttribDivisor(loc,1);
    }
  }
  load(plan){
    const gl = this.gl;
    for (const mesh of [this.deck,this.pedestal,this.pedestalTrim,...Object.values(this.architecture||{})].filter(Boolean)) {
      gl.deleteBuffer(mesh.buffer);
      gl.deleteVertexArray(mesh.vao);
    }
    this.deck = plan.deckGeometry?.length ? this.createMesh(plan.deckGeometry) : null;
    this.pedestal = plan.pedestalGeometry?.length ? this.createMesh(plan.pedestalGeometry) : null;
    this.pedestalTrim = plan.pedestalTrimGeometry?.length ? this.createMesh(plan.pedestalTrimGeometry) : null;
    this.architecture = Object.fromEntries(Object.entries(plan.architectureGeometry||{}).map(([key,data])=>[key,data.length?this.createMesh(data):null]));
    this.plan=plan;
    this.seatIndices=new Map(plan.seats.map((seat,i)=>[seat.uid,i]));
    this.selectedIndex=-1;
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
    gl.bufferData(gl.ARRAY_BUFFER,plan.instanceData,gl.STATIC_DRAW);
    const rounded=plan.roundedCount||0;
    if(rounded)this.bindInstances(this.roundedBox,0);
    this.bindInstances(this.box,rounded);
    const w=plan.surface.width,l=plan.surface.length;
    let minX=-w/2-2,maxX=w/2+2,minZ=-l/2-2,maxZ=l/2+2,minY=0,maxY=plan.surface.sport==='basketball'?15:9;
    for(const {x,y,z} of plan.seats){
      minX=Math.min(minX,x-1);maxX=Math.max(maxX,x+1);
      minY=Math.min(minY,y-.5);maxY=Math.max(maxY,y+1);
      minZ=Math.min(minZ,z-1);maxZ=Math.max(maxZ,z+1);
    }
    // Include actual visible architecture and pedestal extrema when fitting
    // the camera. Seat-only bounds clipped the lower facade in overview.
    const structureCorners=[];
    for(const mesh of [...Object.values(plan.architectureGeometry||{}),
      plan.pedestalGeometry,plan.pedestalTrimGeometry].filter(x=>x?.length)){
      const vertexCount=mesh.length/6;
      const stride=Math.max(1,Math.floor(vertexCount/550));
      for(let i=0;i<vertexCount;i+=stride){
        const j=i*6,x=mesh[j],y=mesh[j+1],z=mesh[j+2];
        if(!Number.isFinite(x+y+z))continue;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
        structureCorners.push([x,y,z]);
      }
    }
    this.center=[(minX+maxX)/2,(minY+maxY)*.31,(minZ+maxZ)/2];
    this.corners=[minX,maxX].flatMap(x=>[minY,maxY].flatMap(y=>[minZ,maxZ].map(z=>[x,y,z])));
    if(plan.sectionFootprints){
      const stride=Math.max(1,Math.floor(plan.seats.length/800));
      this.corners=plan.seats.filter((_,i)=>i%stride===0).map(s=>[s.x,s.y+.9,s.z]);
      this.corners.push([-w/2,0,-l/2],[w/2,0,l/2],[0,maxY,0]);
    }
    this.corners.push(...structureCorners);
    const deck=plan.deckGeometry;
    for(let i=(deck?.length??0)-6;i>=0&&deck[i+1]<-.5;i-=18){
      this.corners.push([deck[i],deck[i+1],deck[i+2]]);
    }
    this.radius=Math.max(maxX-minX,maxZ-minZ)*.5;
    this.view('overview');
  }
  fitDistance(){
    const isTop=this.mode==='top',theta=isTop?0:this.theta,phi=isTop?Math.PI/2:this.phi;
    const toEye=[Math.sin(theta)*Math.cos(phi),Math.sin(phi),Math.cos(theta)*Math.cos(phi)];
    const right=[Math.cos(theta),0,-Math.sin(theta)];
    const up=cross(toEye,right);
    const vertical=Math.tan(52*Math.PI/360)*.90;
    const horizontal=vertical*Math.max(.15,this.canvas.width/this.canvas.height);
    const distances=this.corners.map(corner=>{
      const p=corner.map((v,i)=>v-this.center[i]);
      return dot(p,toEye)+Math.max(Math.abs(dot(p,right))/horizontal,Math.abs(dot(p,up))/vertical);
    });
    return Math.max(12,...distances);
  }
  highlight(seat){
    const index=this.seatIndices?.get(seat?.uid)??-1;
    if(index===this.selectedIndex)return;
    this.selectedIndex=index;
    this.render();
  }
  resize(){const dpr=Math.min(devicePixelRatio||1,1.5),rect=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.render();}}
  view(mode,seat=null){
    this.mode=mode;
    if(seat)this.selectedIndex=this.seatIndices?.get(seat.uid)??-1;
    if(mode==='human'&&seat){
      this.seat=seat;
      const origin=seatViewAnchors(seat,this.viewOptions.posture).eye;
      const target=viewingTarget(this.plan.surface,this.viewOptions.target,seat,this.plan.scoreboardHeight);
      const dx=target.x-origin.x,dz=target.z-origin.z;
      this.humanYaw=Math.atan2(dx,dz);
      this.humanPitch=Math.atan2(target.y-origin.y,Math.hypot(dx,dz));
      this.humanFov=55;
    }
    if(mode==='section'&&seat){
      this.seat=seat;this.pan=[seat.x,seat.y,seat.z];
      this.distance=23;this.phi=.80;this.theta=seat.yaw+.35;
    }
    if(mode==='overview'){this.theta=1.12;this.phi=this.plan.arenaInterior ? .50 : .79;}
    if(mode==='overview'||mode==='top')this.zoomFactor=mode==='overview'&&this.plan.arenaInterior?.92:1;
    this.render();
  }
  setViewOptions(options){this.viewOptions={...this.viewOptions,...options};if(this.mode==='human'&&this.seat)this.view('human',this.seat);this.render();}
  currentCamera(){
    if(this.mode==='human'&&this.seat){const p=seatViewAnchors(this.seat,this.viewOptions.posture).eye;const eye=[p.x,p.y,p.z];const a=this.humanYaw,b=this.humanPitch;return {eye,target:[eye[0]+Math.cos(b)*Math.sin(a)*50,eye[1]+Math.sin(b)*50,eye[2]+Math.cos(b)*Math.cos(a)*50],up:[0,1,0],fov:clamp(this.humanFov/this.viewOptions.zoom,8,95)};}
    const target=this.mode==='section'?this.pan.map((p,i)=>p+(i===1?1:0)):this.center;
    const distance=this.mode==='section'?this.distance:this.fitDistance()*this.zoomFactor;
    if(this.mode==='top')return {eye:[target[0],target[1]+distance,target[2]],target,up:[0,0,-1],fov:52};
    const cp=Math.cos(this.phi);return {eye:[target[0]+distance*Math.sin(this.theta)*cp,target[1]+distance*Math.sin(this.phi),target[2]+distance*Math.cos(this.theta)*cp],target,up:[0,1,0],fov:52};
  }
  render(){if(!this.plan||!this.gl)return;
    const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);
    // Let the neutral CSS viewport show through instead of drawing a solid background.
    // Use a dim backdrop only for the enclosed human-seat view.
    if(this.plan.arenaInterior&&this.mode==='human')gl.clearColor(.19,.18,.205,1);
    else gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const camera=this.currentCamera(),vp=multiply(perspective(camera.fov*Math.PI/180,this.canvas.width/this.canvas.height,.045,4000),lookAt(camera.eye,camera.target,camera.up));this.vp=vp;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.VP,false,vp);
    gl.uniform3fv(this.locations.Eye,camera.eye);
    gl.uniform1f(this.locations.Human,this.mode==='human'?1:0);
    gl.uniform1f(this.locations.Selected,this.selectedIndex);
    const rounded=this.plan.roundedCount||0;
    if(this.pedestal && NativeVenueRenderer.pedestalVisibleInMode(this.plan,this.mode)){
      gl.uniform1f(this.locations.Deck,2);
      gl.bindVertexArray(this.pedestal.vao);
      gl.drawArrays(gl.TRIANGLES,0,this.pedestal.vertices);
      if(this.pedestalTrim){
        gl.uniform1f(this.locations.Deck,3);
        gl.bindVertexArray(this.pedestalTrim.vao);
        gl.drawArrays(gl.TRIANGLES,0,this.pedestalTrim.vertices);
      }
    }
    if(NativeVenueRenderer.architectureVisibleInMode(this.plan,this.mode)){
      for(const [name,index] of [['decks',5],['fascias',6],['concourse',7],['facade',8],['glazing',9],['trim',10],['aisles',11],['stepEdges',12],['backWall',13],['galleryGlass',15],['galleryGlow',16],['windowFrames',17],['pilasters',18],['roofEdge',19],['soffit',20],['downlights',21]]){
        const mesh=this.architecture?.[name];
        if(!mesh)continue;
        gl.uniform1f(this.locations.Deck,index);
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES,0,mesh.vertices);
      }
    }
    if(this.mode==='human' && this.plan.arenaInterior && this.architecture){
      // Keep the real inner gallery, framing and ceiling in first-person views;
      // external façade and the foundation remain cut away.
      for(const [name,index] of [['backWall',13],['galleryGlass',15],['galleryGlow',16],
        ['windowFrames',17],['pilasters',18],['roofEdge',19],['soffit',20],['downlights',21]]){
        const mesh=this.architecture[name];
        if(!mesh)continue;
        gl.uniform1f(this.locations.Deck,index);
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES,0,mesh.vertices);
      }
    }
    if(this.deck && NativeVenueRenderer.deckVisibleInMode(this.plan,this.mode)){
      gl.uniform1f(this.locations.Deck,1);
      gl.bindVertexArray(this.deck.vao);
      gl.drawArrays(gl.TRIANGLES,0,this.deck.vertices);
    }
    gl.uniform1f(this.locations.Deck,0);
    gl.uniform1f(this.locations.Round,0);
    gl.bindVertexArray(this.box.vao);
    gl.drawArraysInstanced(gl.TRIANGLES,0,this.box.vertices,this.plan.instanceCount-rounded);
    if(rounded){
      gl.uniform1f(this.locations.Round,1);
      gl.bindVertexArray(this.roundedBox.vao);
      gl.drawArraysInstanced(gl.TRIANGLES,0,this.roundedBox.vertices,rounded);
    }
    this.onFrame?.(this);
  }
  projectPoint(pos){if(!this.vp)return null;const m=this.vp,[x,y,z]=pos;const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;
    const px=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,py=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
    return [(px+1)*this.canvas.width*.5,(1-py)*this.canvas.height*.5,w];
  }
  bind(){
    let start=null,changed=false;
    this.canvas.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,theta:this.theta,phi:this.phi,yaw:this.humanYaw,pitch:this.humanPitch};changed=false;this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)>4)changed=true;
      if(this.mode==='human'){this.humanYaw=start.yaw-dx*.004;this.humanPitch=clamp(start.pitch+dy*.004,-1.3,1.3);}else{this.theta=start.theta-dx*.006;this.phi=clamp(start.phi-dy*.005,.10,1.49);}this.render();});
    this.canvas.addEventListener('pointerup',e=>{if(start&&!changed&&this.mode!=='human')this.pick(e);start=null;});
    this.canvas.addEventListener('pointercancel',()=>{start=null;});
    this.canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      const factor=e.deltaY>0?1.10:1/1.10;
      if(this.mode==='human')this.humanFov=clamp(this.humanFov*factor,12,95);
      else if(this.mode==='section')this.distance=clamp(this.distance*factor,4,250);
      else this.zoomFactor=clamp(this.zoomFactor*factor,.25,4);
      this.render();
    },{passive:false});
  }
  pick(e){if(!this.plan)return;const rect=this.canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*this.canvas.width/rect.width,y=(e.clientY-rect.top)*this.canvas.height/rect.height;
    let best=-1,depth=Infinity,dist=13*13*(this.canvas.width/rect.width)**2;
    for(let i=0;i<this.plan.seats.length;i++){
      const s=this.plan.seats[i],p=this.projectPoint([s.x,s.y+.5,s.z]);if(!p)continue;
      const d=(p[0]-x)**2+(p[1]-y)**2;if(d<dist || (d===dist&&p[2]<depth)){dist=d;depth=p[2];best=i;}
    }
    if(best>=0)this.onPick(this.plan.seats[best]);
  }
  capture(){this.render();return this.canvas.toDataURL('image/png');}
  dispose(){
    this.observer.disconnect();
    this.gl.deleteBuffer(this.instances);
    for(const {buffer,vao} of [this.box,this.roundedBox,this.deck,this.pedestal,this.pedestalTrim,...Object.values(this.architecture||{})].filter(Boolean)){
      this.gl.deleteBuffer(buffer);
      this.gl.deleteVertexArray(vao);
    }
    this.gl.deleteProgram(this.program);
  }
}
