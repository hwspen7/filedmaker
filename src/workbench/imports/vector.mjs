// Conservative SVG and ASCII DXF geometry ingestion. All results are unverified
// drawing contours, not asserted official section boundaries or ticket positions.
const MAX=4_000_000,MAX_CANDIDATES=500,MAX_POINTS=12000;
const numeric=s=>{
  const n=Number(s);
  if(!Number.isFinite(n)||Math.abs(n)>1e7)throw Error('Invalid vector coordinate');
  return n;
};
const pointsString=s=>{
  const nums=String(s||'').trim().split(/[\s,]+/).filter(Boolean).map(numeric);
  if(nums.length%2||nums.length<6||nums.length>512)throw Error('Invalid polygon coordinates');
  return Array.from({length:nums.length/2},(_,i)=>({x:nums[i*2],y:nums[i*2+1]}));
};
const perimeter=p=>p.reduce((sum,a,i)=>sum+Math.hypot(a.x-p[(i+1)%p.length].x,a.y-p[(i+1)%p.length].y),0);
function shapePath(raw){
  // Only explicitly straight path commands are accepted; do not misinterpret
  // Bezier curves or arc instructions as surveyed straight edges.
  const tokens=String(raw||'').match(/[MLHVZmlhvz]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)||[];
  const clean=String(raw||'').replace(/[, \t\r\n]+/g,'');
  if(tokens.join('')!==clean||tokens.length>3000)throw Error('Unsupported SVG path commands');
  let x=0,y=0,cmd='',start=null,out=[];
  for(let i=0;i<tokens.length;){
    const next=tokens[i];
    if(/^[MLHVZmlhvz]$/.test(next)){cmd=next;i++;if(cmd.toLowerCase()==='z'){break;}continue;}
    if(!cmd||cmd.toLowerCase()==='z')throw Error('Invalid SVG path command');
    const relative=cmd===cmd.toLowerCase(),op=cmd.toLowerCase();
    if(op==='m'||op==='l'){
      if(i+1>=tokens.length||/^[a-z]$/i.test(tokens[i+1]))throw Error('Invalid SVG path point');
      const ax=numeric(tokens[i++]),ay=numeric(tokens[i++]);
      x=relative?x+ax:ax;y=relative?y+ay:ay;
      if(op==='m')cmd=relative?'l':'L';
    }else if(op==='h'){const a=numeric(tokens[i++]);x=relative?x+a:a;}
    else if(op==='v'){const a=numeric(tokens[i++]);y=relative?y+a:a;}
    else throw Error('Unsupported SVG path');
    if(!start)start={x,y};
    out.push({x,y});
  }
  if(out.length>2&&Math.hypot(out[0].x-out.at(-1).x,out[0].y-out.at(-1).y)<1e-9)out.pop();
  return out;
}
function contoursFromSVG(xml){
  const root=new DOMParser().parseFromString(xml,'image/svg+xml');
  if(root.querySelector('parsererror'))throw Error('Malformed SVG document');
  if(root.documentElement.localName!=='svg')throw Error('Expected an SVG root');
  if(root.getElementsByTagName('*').length>12000)throw Error('Too many SVG nodes');
  const vb=String(root.documentElement.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  if(vb.length!==4||vb.some(v=>!Number.isFinite(v))||vb[2]<=0||vb[3]<=0)
    throw Error('SVG needs a valid viewBox for calibration');
  if([...root.getElementsByTagName('*')].some(n=>n.hasAttribute('transform')))
    throw Error('SVG transforms must be flattened by the authoring tool before import');
  const paths=[],tags=new Set(['rect','polygon','polyline','path']);
  for(const item of root.getElementsByTagName('*')){
    if(!tags.has(item.localName))continue;
    let points=[];
    try{
      if(item.localName==='rect'){
        const x=numeric(item.getAttribute('x')||0),y=numeric(item.getAttribute('y')||0);
        const w=numeric(item.getAttribute('width')),h=numeric(item.getAttribute('height'));
        if(w<=0||h<=0)continue;
        points=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
      }else if(item.localName==='path')points=shapePath(item.getAttribute('d'));
      else points=pointsString(item.getAttribute('points'));
    }catch{continue;}
    if(points.length<3||perimeter(points)<5)continue;
    paths.push({id:String(item.getAttribute('id')||item.getAttribute('data-section')||'').slice(0,50),
      points:points.map(p=>({x:p.x-vb[0],y:p.y-vb[1]})),kind:item.localName});
    if(paths.length>MAX_CANDIDATES||paths.reduce((n,p)=>n+p.points.length,0)>MAX_POINTS)
      throw Error('SVG exceeds contour safety limits');
  }
  if(!paths.length)throw Error('No supported vector contours. Flatten curves to straight segments first.');
  return {format:'SVG',width:vb[2],height:vb[3],contours:paths,
    limitations:['Vector contours require staff classification','No transformed or curved path inference']};
}
function contoursFromDXF(raw){
  const lines=raw.replace(/\r/g,'').split('\n');
  const data=[];
  for(let i=0;i+1<lines.length;i+=2)data.push([lines[i].trim(),lines[i+1].trim()]);
  const result=[],layers=new Set();let entity=null;
  const finish=()=>{
    if(!entity)return;
    const points=entity.points??[];
    if(points.length>=3&&perimeter(points)>5){
      result.push({id:entity.layer.replace(/[^A-Za-z0-9_-]+/g,'-').slice(0,50),
        points:points.map(p=>({x:p.x,y:-p.y})),kind:entity.kind,layer:entity.layer});
      layers.add(entity.layer);
    }
    entity=null;
  };
  for(let i=0;i<data.length;i++){
    const [code,value]=data[i];
    if(code==='0'){
      finish();
      if(value==='LWPOLYLINE')entity={kind:value,layer:'',points:[]};
      continue;
    }
    if(!entity)continue;
    if(code==='8')entity.layer=value;
    if(code==='42'&&Math.abs(numeric(value))>1e-8)throw Error('DXF arc bulges require manual conversion');
    if(code==='10')entity.points.push({x:numeric(value),y:0});
    if(code==='20'){
      if(!entity.points.length)throw Error('Malformed DXF polyline');
      entity.points.at(-1).y=numeric(value);
    }
    if(result.length>MAX_CANDIDATES||data.length>150000)throw Error('DXF exceeds safety limits');
  }
  finish();
  if(!result.length)throw Error('No supported DXF LWPOLYLINE contours');
  // CAD units can be mm, inches, feet or metres; the drawing must be
  // calibrated against a known-length court or surveyed control points.
  const all=result.flatMap(s=>s.points);
  const minX=Math.min(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y));
  const maxX=Math.max(...all.map(p=>p.x)),maxY=Math.max(...all.map(p=>p.y));
  return {format:'DXF',width:maxX-minX,height:maxY-minY,
    contours:result.map(item=>({...item,points:item.points.map(p=>({x:p.x-minX,y:p.y-minY}))})),
    layers:[...layers],limitations:['DXF polyline subset only','Drawing scale and axes require independent calibration']};
}
export function parseVectorFile(text,name){
  if(typeof text!=='string'||text.length>MAX)throw Error('Vector file exceeds 4 MB');
  if(/\.svg$/i.test(name)){
    if(typeof DOMParser==='undefined')throw Error('SVG parser requires a browser');
    return contoursFromSVG(text);
  }
  if(/\.dxf$/i.test(name))return contoursFromDXF(text);
  throw Error('Only SVG and ASCII DXF vector drawings are accepted');
}
export function vectorToImage(contours,width,height){
  if(!(width>0&&height>0)||!contours.length)throw Error('Invalid vector drawing');
  const max=1600,scale=Math.min(1,max/Math.max(width,height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width*scale));
  canvas.height=Math.max(1,Math.ceil(height*scale));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f9fbfb';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#46687e';ctx.lineWidth=1;
  for(const item of contours){
    ctx.beginPath();
    item.points.forEach((p,i)=>i?ctx.lineTo(p.x*scale,p.y*scale):ctx.moveTo(p.x*scale,p.y*scale));
    ctx.closePath();ctx.stroke();
  }
  return {url:canvas.toDataURL('image/png'),scale};
}
