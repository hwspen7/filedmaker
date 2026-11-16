// Reusable source-aware venue furniture and circulation primitives.
// These are generic estimated components, never as-built measurements.
export const STRUCTURE_CATALOG=Object.freeze({
  platform:{label:'Accessible platform',width:3.2,depth:2.4,height:.25,color:'#96aebb'},
  stairs:{label:'Stair flight',width:1.5,depth:3.2,height:1.5,color:'#b8b5ad'},
  rail:{label:'Safety railing',width:4,depth:.15,height:1.1,color:'#71848b'},
  wall:{label:'Partition wall',width:5,depth:.2,height:2.8,color:'#a8a9a7'},
  portal:{label:'Entrance frame',width:2.4,depth:.4,height:2.7,color:'#81959e'},
  scoreboard:{label:'Generic scoreboard',width:3.6,depth:.5,height:2.2,color:'#293e4a'},
  table:{label:'Press / staff desk',width:2.5,depth:.8,height:.8,color:'#776a60'},
  ramp:{label:'Access ramp (schematic)',width:1.5,depth:5,height:.75,color:'#a5afb3',category:'access'},
  landing:{label:'Elevated landing',width:3,depth:3,height:.65,color:'#8b9ca6',category:'access'},
  tunnel:{label:'Player tunnel',width:3,depth:4,height:3.5,color:'#76858e',category:'access'},
  gate:{label:'Double entry gate',width:2.8,depth:.25,height:2.6,color:'#687c86',category:'access'},
  fence:{label:'Perimeter fence',width:6,depth:.1,height:2.2,color:'#6d8590',category:'access'},
  glass:{label:'Glazed divider',width:4,depth:.12,height:2.5,color:'#6793a5',category:'structure'},
  column:{label:'Structural column',width:.65,depth:.65,height:5,color:'#8f9292',category:'structure'},
  beam:{label:'Overhead support beam',width:7,depth:.7,height:.45,color:'#6b7883',category:'structure'},
  gantry:{label:'Service gantry',width:6,depth:2,height:2.5,color:'#7b8790',category:'structure'},
  canopy:{label:'Entrance canopy',width:5,depth:3,height:3.2,color:'#a1a9ae',category:'structure'},
  roof:{label:'Roof segment',width:10,depth:5,height:.35,color:'#9ea7ad',category:'structure'},
  bleacher:{label:'Five-step stand',width:5,depth:3,height:1.5,color:'#9eabb3',category:'seating'},
  bench:{label:'Team bench',width:3,depth:.75,height:.95,color:'#687780',category:'seating'},
  lighting:{label:'Lighting mast',width:1.2,depth:.75,height:7,color:'#8c969f',category:'equipment'},
  sign:{label:'Directional sign',width:2,depth:.16,height:1,color:'#426176',category:'equipment'},
  door:{label:'Double door',width:2.4,depth:.24,height:2.6,color:'#768b95',category:'equipment'}
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
    }else if(kind==='ramp'){
      // Bounded stepped panels approximate a continuous incline in the current
      // box-instancing renderer. This is not a compliant construction detail.
      const steps=14;
      for(let i=0;i<steps;i++){
        const at=-d/2+(i+.5)*d/steps,rise=Math.max(.08,h*(i+1)/steps);
        add(s,0,rise-.035,at,w,.07,d/steps+.006,base);
      }
      for(const side of [-w/2+.06,w/2-.06]){
        add(s,side,h*.65,0,.07,.07,d,'#758995');
        for(const z of [-d/2+.12,0,d/2-.12])
          add(s,side,(h+.08)/2,z,.06,h+.08,.06,'#758995');
      }
    }else if(kind==='landing'){
      add(s,0,h-.07,0,w,.14,d,base);
      for(const dx of [-w/2+.10,w/2-.10])for(const dz of [-d/2+.10,d/2-.10])
        add(s,dx,(h-.14)/2,dz,.15,Math.max(.08,h-.14),.15,'#6e818c');
    }else if(kind==='tunnel'){
      for(const x of [-w/2+.12,w/2-.12])
        add(s,x,h/2,0,.24,h,d,base);
      add(s,0,h-.12,0,w,.24,d,'#a4adb1');
      for(const z of [-d/2+.06,d/2-.06])
        add(s,0,h-.14,z,w,.20,.10,'#536772');
    }else if(kind==='gate'||kind==='door'){
      const post=.12;
      for(const x of [-w/2+post/2,w/2-post/2])
        add(s,x,h/2,0,post,h,d,base);
      add(s,0,h-post/2,0,w,post,d,base);
      add(s,-w/4,h*.46,0,w/2-.16,h*.80,.06,'#527082');
      add(s,w/4,h*.46,0,w/2-.16,h*.80,.06,'#527082');
      add(s,0,h*.46,d/2+.03,.04,.65,.05,'#b9c2c4');
    }else if(kind==='fence'){
      add(s,0,h-.045,0,w,.09,.08,base);
      add(s,0,h*.4,0,w,.07,.08,base);
      const posts=Math.max(2,Math.min(24,Math.ceil(w/1.1)+1));
      for(let i=0;i<posts;i++)
        add(s,-w/2+i*w/(posts-1),h/2,0,.06,h,.06,base);
    }else if(kind==='glass'){
      add(s,0,h/2,0,w-.08,h-.08,Math.min(d,.045),base);
      for(const x of [-w/2+.05,w/2-.05])
        add(s,x,h/2,0,.10,h,.10,'#516472');
      for(const y of [.05,h-.05])
        add(s,0,y,0,w,.10,.11,'#516472');
    }else if(kind==='column'){
      add(s,0,h/2,0,w*.78,h,d*.78,base);
      add(s,0,.08,0,w,.16,d,'#747b83');
      add(s,0,h-.08,0,w,.16,d,'#747b83');
    }else if(kind==='beam'){
      add(s,0,h/2,0,w,h,d,base);
      add(s,0,.075,0,w,.15,d,'#4e6069');
      add(s,0,h-.075,0,w,.15,d,'#4e6069');
    }else if(kind==='gantry'){
      for(const y of [.12,h-.12]){
        add(s,0,y,0,w,.16,d,base);
        for(const dz of [-d/2+.08,d/2-.08])
          add(s,0,y,dz,w,.12,.10,'#4c5e6b');
      }
      for(const x of [-w/2+.10,w/2-.10])
        for(const dz of [-d/2+.08,d/2-.08])
          add(s,x,h/2,dz,.15,h,.15,'#657582');
    }else if(kind==='canopy'){
      add(s,0,h-.12,0,w,.24,d,base);
      for(const x of [-w/2+.13,w/2-.13])
        for(const z of [-d/2+.13,d/2-.13])
          add(s,x,(h-.24)/2,z,.18,Math.max(.10,h-.24),.18,'#7c8b93');
      add(s,0,h-.26,0,w,.08,d,'#536772');
    }else if(kind==='roof'){
      add(s,0,h/2,0,w,h,d,base);
      const beams=Math.max(2,Math.min(12,Math.ceil(w/2)));
      for(let i=0;i<beams;i++)
        add(s,-w/2+(i+.5)*w/beams,.07,0,.09,.14,d,'#687782');
    }else if(kind==='bleacher'){
      const steps=5;
      for(let i=0;i<steps;i++){
        const rise=h*(i+1)/steps;
        add(s,0,rise/2,-d/2+(i+.5)*d/steps,
          w,rise,d/steps-.012,i%2?'#b7c0c4':base);
        add(s,0,rise-.04,-d/2+(i+.5)*d/steps,
          w,.08,d/steps-.01,'#707f88');
      }
    }else if(kind==='bench'){
      add(s,0,h*.50,0,w,.13,d,base);
      add(s,0,h*.74,-d/2+.06,w,.4,.12,'#405e6b');
      for(const x of [-w/2+.12,w/2-.12])
        add(s,x,h*.24,0,.12,h*.48,.12,'#465762');
    }else if(kind==='lighting'){
      add(s,0,h/2,0,w*.18,h,d*.18,base);
      add(s,0,h-.15,0,w,.28,d,'#4d6878');
      for(const x of [-w*.28,w*.28])
        add(s,x,h-.03,d*.34,w*.25,.22,.12,'#f0e4b1');
    }else if(kind==='sign'){
      add(s,0,h/2,0,w,h,d,base);
      add(s,0,h/2,d/2+.018,w*.89,h*.75,.035,'#d9e2e4');
      add(s,-w*.20,h/2,d/2+.05,w*.25,.06,.04,'#4d7888');
      add(s,w*.20,h/2,d/2+.05,w*.25,.06,.04,'#4d7888');
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
