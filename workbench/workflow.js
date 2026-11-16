// Four-stage navigation is presentation only. Existing importer, geometry and
// export logic remain in the workbench controller; nothing is auto-certified.
const STAGES=[
 {id:'source',counter:'STEP 1 OF 4',title:'Drawing workspace',subtitle:'Import documents and row lists'},
 {id:'calibrate',counter:'STEP 2 OF 4',title:'Calibrate & trace',subtitle:'Verify section edges and elevations'},
 {id:'model',counter:'STEP 3 OF 4',title:'3D model preview',subtitle:'Click an individual seat to inspect'},
 {id:'review',counter:'STEP 4 OF 4',title:'Review evidence',subtitle:'Export only after checking the model'}
];
export function setupWorkflow({onStageChange}={}){
  const $=id=>document.getElementById(id);
  let current='source';
  const go=id=>{
    const stage=STAGES.find(x=>x.id===id);
    if(!stage)throw Error('Unknown workflow stage');
    current=id;
    document.documentElement.dataset.activeStage=id;
    document.querySelectorAll('[data-open-stage]').forEach(node=>{
      if(node.dataset.openStage===id)node.setAttribute('aria-current','step');
      else node.removeAttribute('aria-current');
    });
    document.querySelectorAll('[data-stage-panel]').forEach(node=>{
      node.hidden=node.dataset.stagePanel!==id;
    });
    document.querySelectorAll('[data-aside-stage]').forEach(node=>{
      node.hidden=node.dataset.asideStage!==id;
    });
    $('stageCounter').textContent='· '+stage.counter;
    $('canvasTitle').textContent=stage.title;
    $('canvasDescription').textContent=stage.subtitle;
    onStageChange?.(id);
    return id;
  };
  document.querySelectorAll('[data-open-stage]').forEach(node=>
    node.addEventListener('click',()=>go(node.dataset.openStage)));
  const steps={sourceNext:'calibrate',backToSource:'source',
    calibrateNext:'model',backToCalibrate:'calibrate',
    modelNext:'review',backToModel:'model'};
  for(const [button,id] of Object.entries(steps)){
    $(button).addEventListener('click',()=>go(id));
  }
  go('source');
  return {go,get current(){return current},stages:STAGES.map(x=>x.id)};
}
