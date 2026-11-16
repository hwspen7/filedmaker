// Source-preserving row furniture, aisle gaps and nonsequential seat labels.
// Missing layout details are estimates; known voids are never filled with seats.
const finite=(x,label,min,max)=>{
  const v=Number(x);
  if(x===''||x==null||!Number.isFinite(v)||v<min||v>max)
    throw Error('Invalid '+label+'; expected '+min+'–'+max);
  return v;
};
export function rowAttributes(record,count){
  const raw=record.gaps??record.aisle_gaps??[];
  let parsed;
  if(typeof raw==='string'){
    parsed=raw.trim()?raw.split('|').map(t=>{
      const m=/^(\d+):(\d+(?:\.\d+)?)$/.exec(t.trim());
      if(!m)throw Error('Aisle gaps must use AFTER:WIDTH_M separated by |');
      return {after:Number(m[1]),width:Number(m[2])};
    }):[];
  }else if(Array.isArray(raw))parsed=raw;
  else throw Error('Invalid aisle gap list');
  const gaps=parsed.map(g=>{
    const after=finite(g.after,'aisle position',1,count-1);
    const width=finite(g.width,'aisle width metres',.5,5);
    if(!Number.isInteger(after))throw Error('Aisle must follow an integer seat position');
    return {after,width};
  });
  if(gaps.length>10)throw Error('A row cannot contain more than ten aisle gaps');
  gaps.sort((a,b)=>a.after-b.after);
  if(new Set(gaps.map(g=>g.after)).size!==gaps.length)
    throw Error('Duplicate aisle positions in a row');
  const rawNumbers=record.seat_numbers??record.seatNumbers??[];
  const seatNumbers=typeof rawNumbers==='string'?
    (rawNumbers.trim()?rawNumbers.split('|').map(s=>s.trim()):[]):
    (Array.isArray(rawNumbers)?rawNumbers.map(s=>String(s).trim()):null);
  if(!seatNumbers||seatNumbers.length&&seatNumbers.length!==count)
    throw Error('Explicit seat identifiers must match the row seat count');
  if(seatNumbers.some(s=>!s||s.length>30||/[\r\n\t]/.test(s)))
    throw Error('Invalid explicit seat identifier');
  if(new Set(seatNumbers).size!==seatNumbers.length)
    throw Error('Duplicate seat label in a row');
  const direction=String(record.seat_direction||record.seatDirection||'forward').trim().toLowerCase();
  if(!['forward','reverse'].includes(direction))throw Error('Seat direction must be forward or reverse');
  const insetStartM=finite(record.inset_start_m??record.insetStartM??0,'row start inset metres',0,30);
  const insetEndM=finite(record.inset_end_m??record.insetEndM??0,'row end inset metres',0,30);
  const depthOffsetM=finite(record.depth_offset_m??record.depthOffsetM??0,'row depth offset metres',-3,3);
  const rawElevation=record.elevation_m??record.elevation??null;
  const elevation=rawElevation==null||rawElevation===''?null:
    finite(rawElevation,'row elevation metres',0,100);
  return {gaps,seatNumbers,seatDirection:direction,elevation,insetStartM,insetEndM,depthOffsetM};
}
export function rowStations(row,width){
  const gaps=row.gaps||[],count=row.seats;
  const reserved=gaps.reduce((sum,g)=>sum+g.width,0)+(row.insetStartM??0)+(row.insetEndM??0);
  const usable=width-reserved;
  if(usable<=0||usable/count<.25)
    throw Error('Row '+row.section+'/'+row.row+' cannot fit source seats and documented aisle gaps');
  const pitch=usable/count;
  const positions=Array.from({length:count},(_,i)=>{
    const inserted=gaps.filter(g=>g.after<=i).reduce((sum,g)=>sum+g.width,0);
    const numberIndex=row.seatDirection==='reverse'?count-i-1:i;
    return {distance:(row.insetStartM??0)+(i+.5)*pitch+inserted,
      label:row.seatNumbers?.length?row.seatNumbers[numberIndex]:
        String(row.first+numberIndex)};
  });
  return {pitch,gaps,positions,usable};
}
