import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VENUE_CASES,getVenueCase} from '../src/workbench/caseCatalog.mjs';
import {REAL_SCHOOL_CASES} from './fixtures/actual-school-cases.mjs';

const source=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,source),'utf8');
test('case library includes all documented live cases, two OSU refs and fictional demo',()=>{
  assert.equal(VENUE_CASES.length,10);
  assert.equal(VENUE_CASES.filter(c=>c.group==='references').length,2);
  assert.equal(VENUE_CASES.filter(c=>c.group==='schools').length,6);
  assert.equal(VENUE_CASES.filter(c=>c.group==='extended').length,1);
  assert.equal(VENUE_CASES.filter(c=>c.group==='demos').length,1);
  assert.equal(new Set(VENUE_CASES.map(c=>c.id)).size,10);
  assert.equal(getVenueCase('aiken-high').capacity,1418);
  assert.equal(getVenueCase('northview').capacity,534);
  assert.equal(getVenueCase('wills-point').capacity,null);
  assert.equal(getVenueCase('missing'),null);
});
test('source-backed school cards preserve original documentary source links',()=>{
  const lookup=new Map([
    ['aiken-high','aiken-high-taylor-gym'],
    ['sanderson-high','sanderson-high-main-gym'],
    ['hatton-high','hatton-school-gym'],
    ['howard-ms20','howard-county-ms20'],
    ['northview','northview-junior-academy'],
    ['wills-point','wills-point-main-gym']
  ]);
  for(const [cardId,sourceId] of lookup){
    const card=getVenueCase(cardId),sourceCase=REAL_SCHOOL_CASES.find(c=>c.id===sourceId);
    assert.equal(card.source,sourceCase.source.url,cardId+' provenance link mismatch');
    assert.equal(card.capacity,sourceCase.documentedSeats);
    assert.equal(card.statusType,cardId==='aiken-high'?'draft':'source');
  }
  assert.match(getVenueCase('aiken-high').description,/assumed rows/i);
  assert.match(getVenueCase('sanderson-high').description,/net seats/i);
  assert.match(getVenueCase('howard-ms20').description,/wheelchair/i);
  assert.match(getVenueCase('wills-point').description,/no complete seat inventory/i);
});
test('case library is linked from both home and workbench, no fabricated certification',()=>{
  const cases=read('cases/index.html'),home=read('index.html'),workbench=read('workbench/index.html');
  assert.match(cases,/id="caseGrid"/);
  assert.match(cases,/Search venues/);
  assert.match(cases,/id="detailView"/);
  assert.match(cases,/View original document/);
  const controller=read('cases/cases.js');
  assert.match(controller,/anchor\.href=caseTarget\(c\)/);
  assert.match(controller,/encodeURIComponent\(c\.id\)/);
  assert.match(home,/\.\/cases\//);
  assert.match(workbench,/\.\.\/cases\//);
  assert.doesNotMatch(cases,/certified 3D seat inventory available/i);
});
test('workbench groups all original tool controls into four unique stages',()=>{
  const html=read('workbench/index.html');
  const stages=[...html.matchAll(/data-stage-panel="([^"]+)"/g)].map(m=>m[1]);
  const aside=[...html.matchAll(/data-aside-stage="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(stages,['source','calibrate','model','review']);
  assert.deepEqual(aside,stages);
  const oldControls=['school','venue','sport','courtWidth','courtLength','pdfFile','pdfPage',
    'planFile','vectorFile','sourceName','pdfStatus','pdfLabels','rowsFile','sheetSelect',
    'csvExample','fixture','capacity','capacitySource','calibrate','trace','matchVectors',
    'sectionSelect','baseHeight','rowRise','applySection','removeSection','checkPX','checkPY',
    'checkX','checkZ','addCheck','generate','undo','redo','saveProject','openProject',
    'compareProject','saveSeats','saveReport','publish','showPlan','show3d','showEye',
    'planCanvas','modelCanvas','canvasOverlay','modeLabel','sourceLedger','qa','delta',
    'reviewChecklist','seatDetails','rowCount','mappedCount','sectionCount','publishedCount',
    'workspaceName','workStatus','openExisting','projectActivity','exportActivity','emptyCanvas','emptyUpload',
    'detailsToggle','detailsClose','detailsBackdrop','projectInspector','quickStats'];
  for(const id of oldControls)assert.match(html,new RegExp('id="'+id+'"'),id+' has no DOM anchor');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate UI ID could break event handlers');
});
test('source view keeps extra controls behind a detail disclosure',()=>{
  const html=read('workbench/index.html');
  assert.match(html,/data-stage-panel="source"/);
  assert.match(html,/<details class="disclosure">/);
  assert.match(html,/data-open-stage="review"/);
  assert.match(html,/id="sourceNext"/);
  assert.match(html,/id="modelNext"/);
});
test('old conference catalogue remains retired from the product navigation',()=>{
  const homepage=read('index.html'),cases=read('cases/index.html');
  assert.doesNotMatch(homepage,/data-bigten=/);
  assert.doesNotMatch(cases,/data-bigten=/);
});

test('every case is an entire link and incomplete schools have details',()=>{
  const code=read('cases/cases.js'),view=read('cases/index.html');
  assert.match(code,/const anchor=node\('a','case-card'\)/);
  assert.match(code,/anchor\.href=caseTarget\(c\)/);
  assert.match(code,/showDetail\(selected\)/);
  assert.match(view,/id="detailSource"/);
  assert.match(view,/id="detailWorkbench"/);
  assert.doesNotMatch(view,/class="sidebar"/);
});
test('workbench is two-column with a closable details drawer',()=>{
  const view=read('workbench/index.html'),style=read('workbench/workbench.css');
  assert.match(view,/id="detailsToggle"/);
  assert.match(view,/id="detailsClose"/);
  assert.match(view,/class="topbar studio-header"/);
  assert.doesNotMatch(view,/class="steps-strip"/);
  assert.doesNotMatch(view,/aside class="sidebar"/);
  assert.match(style,/\.layout\.details-open \.inspector/);
});

test('operator measurement and individual seat controls are kept discoverable but compact',()=>{
  const page=read('workbench/index.html');
  for(const id of ['measureTools','measureTool','measureClear','measureResult',
    'seatAdvanced','seatEditNumber','seatShiftX','seatShiftY','seatShiftZ',
    'seatApplyOffset','seatResetOffset'])
    assert.match(page,new RegExp('id="'+id+'"'),id);
  assert.match(page,/<details class="disclosure" id="measureTools"/);
  assert.match(page,/<details class="disclosure" id="seatAdvanced"/);
});

test('model tool modes and 3D navigation remain compact and operable',()=>{
  const page=read('workbench/index.html'),script=read('workbench/workbench.js'),
    style=read('workbench/workbench.css');
  const modes=['rows','seats','batch','preview'];
  for(const mode of modes){
    assert.match(page,new RegExp('data-model-tool="'+mode+'"'));
    assert.match(page,new RegExp('data-model-tool-pane="'+mode+'"'));
  }
  for(const id of ['batchSection','batchPreview','batchApplyStyle','batchApplyInsets',
    'cameraFit','cameraTop','cameraFocus','cameraZoom','cameraCapture','toggleTools',
    'modelCanvas','seatToolSection','seatToolRow']){
    assert.match(page,new RegExp('id="'+id+'"'),id+' missing');
  }
  assert.match(script,/activateModelTool/);
  assert.match(script,/applyVenueBatchEdit/);
  assert.match(script,/cameraFit/);
  assert.match(style,/\.content-grid\.tools-collapsed/);
});

test('single command bar owns workflow, project status and navigation',()=>{
  const html=read('workbench/index.html'),css=read('workbench/workbench.css');
  assert.match(html,/class="topbar studio-header"/);
  assert.match(html,/id="workspaceName"/);
  assert.match(html,/id="stageCounter"/);
  assert.match(html,/data-open-stage="model"/);
  assert.match(html,/id="buildTag"/);
  assert.doesNotMatch(html,/class="workspace-top"/);
  assert.doesNotMatch(html,/class="steps-strip"/);
  assert.match(css,/\.topbar\.studio-header/);
});
test('modeling supports a real seven-kind component library',()=>{
  const html=read('workbench/index.html'),js=read('workbench/workbench.js');
  const kinds=['platform','stairs','rail','wall','portal','scoreboard','table'];
  for(const kind of kinds)assert.match(html,new RegExp('data-structure-kind="'+kind+'"'));
  for(const id of ['structureSelect','structureAdd','structurePickOnPlan',
    'structureApply','structureDuplicate','structureRotate','structureRemove'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,/editVenueStructure/);
  assert.match(js,/activateModelTool\('structures'\)/);
});

test('source-case context is placed inside the collapsed project menu',()=>{
  const markup=read('workbench/index.html');
  const menu=markup.indexOf('class="top-menu-content"');
  const context=markup.indexOf('id="caseContext"');
  const dropdownEnd=markup.indexOf('</details>',menu);
  assert.ok(menu>=0&&context>menu&&context<dropdownEnd);
  assert.doesNotMatch(markup,/<div class="steps-strip"/);
});
