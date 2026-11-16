// In-memory, bounded undo/redo for editable venue documents. The saved
// changelog is an attribution trail, not a cryptographically signed audit log.
export function createHistory(limit=24,maxBytes=24_000_000){
  if(!Number.isInteger(limit)||limit<1)throw Error('Invalid revision limit');
  const undo=[],redo=[];let bytes=0;
  const size=v=>JSON.stringify(v).length;
  const snapshot=v=>structuredClone(v);
  const record=(before,action)=>{
    const entry={state:snapshot(before),action:String(action||'Edit').slice(0,100),size:size(before)};
    if(entry.size>maxBytes)throw Error('Current project exceeds undo memory allowance');
    undo.push(entry);bytes+=entry.size;
    while(undo.length>limit||bytes>maxBytes){bytes-=undo.shift().size;}
    redo.length=0;
  };
  const back=current=>{
    if(!undo.length)return null;
    const item=undo.pop();bytes-=item.size;
    redo.push({state:snapshot(current),action:item.action,size:size(current)});
    return {venue:item.state,action:item.action};
  };
  const forward=current=>{
    if(!redo.length)return null;
    const item=redo.pop();record(current,item.action);return {venue:item.state,action:item.action};
  };
  return {record,undo:back,redo:forward,clear:()=>{undo.length=0;redo.length=0;bytes=0;},
    get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;}};
}
