// Dependency-free WebGL2 venue renderer: one instanced mesh for chairs,
// bleachers, treads, court, goalposts and scoreboards. No CDN required.
// Embedded eye/view helpers also permit standalone, zero-dependency school exports.
const seatViewAnchors=(seat,posture='seated')=>{const yaw=Number.isFinite(seat.yaw)?seat.yaw:Math.atan2(-seat.x,-seat.z);const f=posture==='leaning'?.38:posture==='standing'?.20:.23;return {eye:{x:seat.x+Math.sin(yaw)*f,y:seat.y+({seated:1.17,leaning:1.23,standing:1.60}[posture]||1.17),z:seat.z+Math.cos(yaw)*f}};};
function viewingTarget(surface,target='center',seat=null){const x=surface.width/2,z=surface.length/2;
  if(target==='near-rim')return {x:0,y:3.05,z:z-1.6};if(target==='far-rim')return {x:0,y:3.05,z:-z+1.6};if(target==='scoreboard')return{x:0,y:15.5,z:0};
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
out vec3 vColor;
out vec3 vNormal;
void main(){
  vec3 p=aLocal*aSize;
  float c=cos(aYaw),s=sin(aYaw);
  vec3 r=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);
  vec3 world=aPos+r;
  // Suppress occupied chair and immediate camera-intersecting furniture.
  if(uHuman>.5 && aSeatId>=0. && distance(aPos,uEye)<.83){gl_Position=vec4(3.,3.,3.,1.);return;}
  vec3 n=aNormal;
  vNormal=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);
  vColor=aColor;
  gl_Position=uVP*vec4(world,1.);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
out vec4 outColor;
void main(){
  vec3 sun=normalize(vec3(.38,.82,.44));
  float diffuse=max(0.,dot(normalize(vNormal),sun));
  float strength=.69+.31*diffuse;
  vec3 rgb=pow(vColor,vec3(2.2))*strength;
  outColor=vec4(pow(rgb,vec3(1./2.2)),1.);
}`;
const cube=(()=>{
  const sides=[
    [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
    [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
    [[1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]]],
    [[-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]],
    [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
    [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]]
  ];
  const a=[];for(const [normal,p] of sides)for(const i of [0,1,2,0,2,3])a.push(...p[i],...normal);return new Float32Array(a);
})();

export class NativeVenueRenderer {
  constructor(canvas,onPick=()=>{}){
    this.canvas=canvas;this.onPick=onPick;
    const gl=canvas.getContext('webgl2',{antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(!gl)throw Error('WebGL2 is not available on this device. Use the 2D map instead.');
    this.gl=gl;this.program=makeProgram(gl,VERTEX,FRAGMENT);this.locations={vp:gl.getUniformLocation(this.program,'uVP'),eye:gl.getUniformLocation(this.program,'uEye'),human:gl.getUniformLocation(this.program,'uHuman')};
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    this.cubeBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.cubeBuffer);gl.bufferData(gl.ARRAY_BUFFER,cube,gl.STATIC_DRAW);
    for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12);}
    this.instances=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
    const entries=[[2,3,0],[3,3,12],[4,1,24],[5,3,28],[6,1,40]];
    for(const [loc,size,offset] of entries){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,44,offset);gl.vertexAttribDivisor(loc,1);}
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);
    this.plan=null;this.mode='overview';this.pan=[0,0,0];this.theta=.68;this.phi=.87;this.distance=140;this.humanYaw=0;this.humanPitch=0;this.humanFov=63;this.viewOptions={posture:'seated',target:'center',zoom:1};
    this.bind();this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);
  }
  load(plan){
    this.plan=plan;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferData(gl.ARRAY_BUFFER,plan.instanceData,gl.STATIC_DRAW);
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,maxY=-Infinity;
    for(const s of plan.seats){minX=Math.min(minX,s.x);maxX=Math.max(maxX,s.x);minZ=Math.min(minZ,s.z);maxZ=Math.max(maxZ,s.z);maxY=Math.max(maxY,s.y);}
    const w=plan.surface.width,l=plan.surface.length;
    minX=Math.min(-w/2,minX);maxX=Math.max(w/2,maxX);minZ=Math.min(-l/2,minZ);maxZ=Math.max(l/2,maxZ);
    this.center=[(minX+maxX)/2,Math.max(1,Math.min(14,(maxY||8)*.32)),(minZ+maxZ)/2];
    this.radius=Math.max(maxX-minX,maxZ-minZ)*.77+12;
    this.distance=Math.max(35,this.radius*1.85);this.phi=.94;this.theta=.67;this.mode='overview';this.render();
  }
  resize(){const dpr=Math.min(devicePixelRatio||1,1.5),rect=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.render();}
  view(mode,seat=null){this.mode=mode;
    if(mode==='human'&&seat){this.seat=seat;const origin=seatViewAnchors(seat,this.viewOptions.posture).eye;const target=viewingTarget(this.plan.surface,this.viewOptions.target,seat);const dx=target.x-origin.x,dz=target.z-origin.z;this.humanYaw=Math.atan2(dx,dz);this.humanPitch=Math.atan2(target.y-origin.y,Math.hypot(dx,dz));this.humanFov=64;}
    if(mode==='top'){this.distance=this.radius*1.7;}
    if(mode==='section'&&seat){this.seat=seat;this.pan=[seat.x,seat.y,seat.z];this.distance=24;this.phi=1;this.theta=seat.yaw+Math.PI;}
    if(mode==='overview'){this.pan=[0,0,0];this.distance=this.radius*1.85;this.theta=.67;this.phi=.94;}
    this.render();
  }
  setViewOptions(options){this.viewOptions={...this.viewOptions,...options};if(this.mode==='human'&&this.seat)this.view('human',this.seat);this.render();}
  currentCamera(){
    if(this.mode==='human'&&this.seat){const p=seatViewAnchors(this.seat,this.viewOptions.posture).eye;const eye=[p.x,p.y,p.z];const a=this.humanYaw,b=this.humanPitch;return {eye,target:[eye[0]+Math.cos(b)*Math.sin(a)*50,eye[1]+Math.sin(b)*50,eye[2]+Math.cos(b)*Math.cos(a)*50],up:[0,1,0],fov:this.humanFov/this.viewOptions.zoom};}
    const target=this.mode==='section'?this.pan.map((p,i)=>p+(i===1?1:0)):this.center;
    if(this.mode==='top')return {eye:[target[0]+.001,target[1]+this.distance,target[2]],target,up:[0,0,-1],fov:54};
    const cp=Math.cos(this.phi);return {eye:[target[0]+this.distance*Math.sin(this.theta)*cp,target[1]+this.distance*Math.sin(this.phi),target[2]+this.distance*Math.cos(this.theta)*cp],target,up:[0,1,0],fov:52};
  }
  render(){if(!this.plan||!this.gl)return;
    const gl=this.gl;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const camera=this.currentCamera(),vp=multiply(perspective(camera.fov*Math.PI/180,this.canvas.width/this.canvas.height,.045,4000),lookAt(camera.eye,camera.target,camera.up));this.vp=vp;
    gl.useProgram(this.program);gl.uniformMatrix4fv(this.locations.vp,false,vp);gl.uniform3fv(this.locations.eye,camera.eye);gl.uniform1f(this.locations.human,this.mode==='human'?1:0);gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.plan.instanceCount);
  }
  projectPoint(pos){if(!this.vp)return null;const m=this.vp,[x,y,z]=pos;const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;
    const px=(m[0]*x+m[4]*y+m[8]*z+m[12])/w,py=(m[1]*x+m[5]*y+m[9]*z+m[13])/w;
    return [(px+1)*this.canvas.width*.5,(1-py)*this.canvas.height*.5];
  }
  bind(){
    let start=null,changed=false;
    this.canvas.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,theta:this.theta,phi:this.phi,yaw:this.humanYaw,pitch:this.humanPitch};changed=false;this.canvas.setPointerCapture(e.pointerId);});
    this.canvas.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.hypot(dx,dy)>4)changed=true;
      if(this.mode==='human'){this.humanYaw=start.yaw-dx*.004;this.humanPitch=clamp(start.pitch+dy*.004,-1.3,1.3);}else{this.theta=start.theta-dx*.006;this.phi=clamp(start.phi-dy*.005,.10,1.49);}this.render();});
    this.canvas.addEventListener('pointerup',e=>{if(start&&!changed&&this.mode!=='human')this.pick(e);start=null;});
    this.canvas.addEventListener('wheel',e=>{e.preventDefault();if(this.mode==='human')this.humanFov=clamp(this.humanFov*(e.deltaY>0?1.07:.93),25,95);else this.distance=clamp(this.distance*(e.deltaY>0?1.11:.90),4,1200);this.render();},{passive:false});
  }
  pick(e){if(!this.plan)return;const rect=this.canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*this.canvas.width/rect.width,y=(e.clientY-rect.top)*this.canvas.height/rect.height;
    let best=-1,dist=13*13*(this.canvas.width/rect.width)**2;
    for(let i=0;i<this.plan.seats.length;i++){
      const s=this.plan.seats[i],p=this.projectPoint([s.x,s.y+.5,s.z]);if(!p)continue;
      const d=(p[0]-x)**2+(p[1]-y)**2;if(d<dist){dist=d;best=i;}
    }
    if(best>=0)this.onPick(this.plan.seats[best]);
  }
  capture(){this.render();return this.canvas.toDataURL('image/png');}
  dispose(){this.observer.disconnect();this.gl.deleteBuffer(this.instances);this.gl.deleteBuffer(this.cubeBuffer);this.gl.deleteVertexArray(this.vao);this.gl.deleteProgram(this.program);}
}
