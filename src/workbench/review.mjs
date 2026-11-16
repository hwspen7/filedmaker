// Semi-automatic venue workflow: suggestions never create seats or geometry
// until a staff member explicitly confirms evidence and traces boundaries.
const canonical=s=>String(s??'').trim().toUpperCase().replace(/\s+/g,' ');
export function reviewReadiness({rows,sections,calibration,plan}){
  const rowNames=new Set((rows??[]).map(r=>canonical(r.section)));
  const traced=new Set((sections??[]).map(s=>canonical(s.id)));
  const missing=[...rowNames].filter(s=>!traced.has(s));
  const unexpected=[...traced].filter(s=>!rowNames.has(s));
  const hasDrawing=Boolean(plan?.name);
  const calibrated=(calibration?.corners?.length===4);
  const conditions={drawing:hasDrawing,seatRows:!!rows?.length,courtCalibration:calibrated,
    sectionCoverage:missing.length===0&&rowNames.size>0};
  const ready=Object.values(conditions).every(Boolean);
  const steps=[
    {id:'source',done:hasDrawing,label:'Upload a drawing'},
    {id:'rows',done:conditions.seatRows,label:'Import row counts'},
    {id:'calibration',done:calibrated,label:'Calibrate the court'},
    {id:'sections',done:conditions.sectionCoverage,label:'Trace each row-bearing section'}
  ];
  return {ready,conditions,steps,missingSections:missing,
    unmatchedContours:unexpected,reviewRequired:true};
}
export function suggestionQueue(labels,rows,sections){
  const rowIDs=new Map((rows??[]).map(r=>[canonical(r.section),r.section]));
  const existing=new Set((sections??[]).map(s=>canonical(s.id)));
  const seen=new Set();
  return labels.filter(label=>{
    const key=canonical(label.id);
    if(!rowIDs.has(key)||existing.has(key)||seen.has(key))return false;
    seen.add(key);return true;
  }).map(label=>({...label,id:rowIDs.get(canonical(label.id)),
    recommendedAction:'Inspect label and trace exact section boundaries'}));
}
