import {VENUE_CASES} from '../src/workbench/caseCatalog.mjs';
const $=id=>document.getElementById(id);
let filter=new URLSearchParams(location.search).get('group')||'all';
if(!['all','references','schools','demos','extended'].includes(filter))filter='all';
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node;};
function picture(kind){
  const container=element('div','art art-'+kind);
  container.setAttribute('aria-hidden','true');
  const frame=element('div','arena-shape');
  if(kind==='auditorium'){
    container.append(element('div','stage-shape'));
  }
  container.append(frame,element('div','art-caption','Illustrative diagram'));
  return container;
}
function card(c){
  const article=element('article','case-card');
  const box=element('div','body');
  const top=element('div','card-top');
  top.append(element('span','kind',c.kind),element('span','badge '+c.statusType,c.status));
  box.append(top,element('h3','',c.title),element('div','subtitle',c.subtitle),
    element('p','description',c.description));
  const info=element('div','numbers');
  const capacity=element('div');
  capacity.append(element('small','', 'Documented capacity'),
    element('strong','',c.capacity==null?'Not established':
      (c.id==='northview'?'Approx. ':'')+c.capacity.toLocaleString('en-US')));
  const model=element('div');
  model.append(element('small','','Model status'),element('strong','',c.status));
  info.append(capacity,model);box.append(info);
  const actions=element('div','links');
  const open=element('a','view',c.group==='references'?'View reference':
    c.id==='fictional-gym'?'Try editable demo':
    c.id==='aiken-high'?'Explore estimated 3D':'Review source in workbench');
  open.href=c.action;actions.append(open);
  if(c.source){
    const source=element('a','source','Source document');
    source.href=c.source;source.target='_blank';source.rel='noopener noreferrer';
    actions.append(source);
  }
  box.append(actions);article.append(picture(c.preview),box);return article;
}
function redraw(){
  const term=$('searchCases').value.trim().toLowerCase();
  const visible=VENUE_CASES.filter(c=>(filter==='all'||c.group===filter)&&
    [c.title,c.subtitle,c.kind,c.description].join(' ').toLowerCase().includes(term));
  $('caseCount').textContent=String(visible.length);
  $('caseGrid').replaceChildren(...visible.map(card));
  $('emptyCases').hidden=visible.length!==0;
  document.querySelectorAll('[data-filter]').forEach(b=>
    b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.filter;
  redraw();
  const url=new URL(location.href);
  if(filter==='all')url.searchParams.delete('group');
  else url.searchParams.set('group',filter);
  history.replaceState(null,'',url);
}));
$('searchCases').addEventListener('input',redraw);
redraw();