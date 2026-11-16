// Reusable source-aware venue furniture and circulation primitives.
// These are generic estimated components, never as-built measurements.
export const STRUCTURE_CATALOG=Object.freeze({
  platform:{label:'Accessible platform',width:3.2,depth:2.4,height:.25,color:'#96aebb'},
  stairs:{label:'Stair flight',width:1.5,depth:3.2,height:1.5,color:'#b8b5ad'},
  rail:{label:'Safety railing',width:4,depth:.15,height:1.1,color:'#71848b'},
  wall:{label:'Partition wall',width:5,depth:.2,height:2.8,color:'#a8a9a7'},
  portal:{label:'Entrance frame',width:2.4,depth:.4,height:2.7,color:'#81959e'},
  scoreboard:{label:'Generic scoreboard',width:3.6,depth:.5,height:2.2,color:'#293e4a'},
  table:{label:'Press / staff desk',width:2.5,depth:.8,height:.8,color:'#776a60'}
});
const num=(value,label,min,max)=>{
  if(value===''||value==null||!Number.isFinite(Number(value))||
    Number(value)<min||Number(value)>max)
    throw Error(label+' must be between '+min+' and '+max);
  return Number(value);
};
const title=(value,label,max)=>{
  const t=String(value??'').trim();
  if(!t||t.length>max)throw Error(label+' is required (up to '+max+' characters)');
  return t;
};
const sizes={width:[.4,30],depth:[.08,24],height:[.08,12]};
export function normalizeStructures(raw){
  if(!Array.isArray(raw)||raw.length>200)throw Error('Maximum 200 operator structures');
  const ids=new Set();
  return raw.map((s,i)=>{
    if(!s||typeof s!=='object'||!Object.hasOwn(STRUCTURE_CATALOG,s.kind))
      throw Error('Invalid venue structure type');
    const id=title(s.id,'Structure ID',30);
    if(ids.has(id.toLowerCase()))throw Error('Duplicate structure ID '+id);
    ids.add(id.toLowerCase());
    const spec=STRUCTURE_CATALOG[s.kind];
    const defaults={width:spec.width,depth:spec.depth,height:spec.height};
    const dims=Object.fromEntries(Object.entries(sizes).map(([key,[min,max]])=>
      [key,num(s[key]??defaults[key],'Structure '+key,min,max)]));
    return {id,kind:s.kind,
      x:num(s.x,'Structure X',-2000,2000),
      z:num(s.z,'Structure Z',-2000,2000),
      y:num(s.y??0,'Structure base height',0,85),
      yaw:num(s.yaw??0,'Structure rotation',-180,180),
      ...dims,label:String(s.label||spec.label).slice(0,80),
      provenance:'operator-estimated/unverified',
      note:String(s.note||'').slice(0,200)};
  });
}
export function structureFootprintContains(s,x,z,margin=0){
  const angle=s.yaw*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);
  const dx=x-s.x,dz=z-s.z;
  const localX=c*dx-sn*dz,localZ=sn*dx+c*dz;
  return Math.abs(localX)<s.width/2+margin&&Math.abs(localZ)<s.depth/2+margin;
}
export function structureSeatInterference(structures,seats){
  const conflicts=[];
  const filtered=structures;
  // The structure has meaningful 3D volume; only compare seats that lie
  // within the same vertical envelope, not an overhead object.
  for(const s of filtered){
    for(const seat of seats){
      if(seat.y+.9<s.y-.08||seat.y-.2>s.y+s.height+.08)continue;
      if(structureFootprintContains(s,seat.x,seat.z,.18)){
        conflicts.push({structure:s.id,seat:seat.id});
        if(conflicts.length>=80)return conflicts;
      }
    }
  }
  return conflicts;
}
const c=(hex)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
export function buildStructureInstances(structures){
  const instances=[];
  const add=(s,dx,cy,dz,width,height,depth,color)=>{
    if(width<=.0001||height<=.0001||depth<=.0001)return;
    const a=s.yaw*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
    const x=s.x+cos*dx+sin*dz,z=s.z-sin*dx+cos*dz;
    instances.push(x,s.y+cy,z,width,height,depth,a,...c(color),-1);
  };
  for(const s of structures){
    const {width:w,depth:d,height:h,kind}=s,base=STRUCTURE_CATALOG[kind].color;
    if(kind==='platform'){
      add(s,0,h-.09,0,w,.18,d,base);
      for(const a of [-1,1])for(const b of [-1,1])
        add(s,a*(w/2-.08),(h-.18)/2,b*(d/2-.08),.10,Math.max(.10,h-.18),.10,'#748791');
    }else if(kind==='stairs'){
      const count=6,step=d/count;
      for(let i=0;i<count;i++){
        const rise=h*(i+1)/count;
        add(s,0,rise/2,-d/2+(i+.5)*step,w,rise,step-.012,
          i%2?'#adb5b7':base);
      }
    }else if(kind==='rail'){
      add(s,0,h-.035,0,w,.07,.08,base);
      for(const offset of [-w/2+.04,0,w/2-.04])
        add(s,offset,h/2,0,.065,h,.065,base);
      add(s,0,h*.44,0,w,.045,.05,'#8fa0a7');
    }else if(kind==='wall'){
      add(s,0,h/2,0,w,h,d,base);
    }else if(kind==='portal'){
      for(const offset of [-w/2+.07,w/2-.07])
        add(s,offset,h/2,0,.14,h,d,base);
      add(s,0,h-.09,0,w,.18,d,base);
    }else if(kind==='scoreboard'){
      add(s,0,h/2,0,w,h,d,base);
      add(s,0,h/2,d/2+.018,w*.89,h*.8,.036,'#3d7294');
      add(s,0,h*.12,d/2+.04,w*.8,.04,.036,'#b6c7cc');
    }else if(kind==='table'){
      add(s,0,h-.05,0,w,.1,d,base);
      for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-d/2+.1,d/2-.1])
        add(s,dx,(h-.1)/2,dz,.10,h-.1,.10,'#495761');
    }
  }
  return new Float32Array(instances);
}
export function nextStructureId(existing,kind){
  const names=new Set(existing.map(s=>s.id.toLowerCase()));
  let i=1;
  while(names.has(kind+'-'+i))i++;
  return kind+'-'+i;
}
