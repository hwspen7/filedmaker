import {VENUE_CASES,getVenueCase} from '../src/workbench/caseCatalog.mjs';

const $=id=>document.getElementById(id);
const MODEL_IDS=new Set(['osu-basketball','osu-football','fictional-gym','aiken-high',
  ...VENUE_CASES.filter(c=>c.group==='demos').map(c=>c.id)]);
const validFilters=new Set(['all','models','schools']);
let filter=new URLSearchParams(location.search).get('group')||'all';
if(filter==='references'||filter==='demos')filter='models';
if(!validFilters.has(filter))filter='all';
const node=(tag,className,text)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!=null)el.textContent=String(text);
  return el;
};
const isModel=c=>MODEL_IDS.has(c.id);
const caseTarget=c=>isModel(c)?c.action:'./?case='+encodeURIComponent(c.id);

function graphic(c){
  const container=node('div','art art-'+c.preview);
  container.setAttribute('aria-hidden','true');
  container.append(node('div','seating-ring'));
  if(c.preview==='auditorium')container.append(node('div','stage-shape'));
  return container;
}

function card(c){
  // The entire card is ONE real anchor. There are no nested links or
  // tiny hotspots: pointer, keyboard and open-in-new-tab all work.
  const anchor=node('a','case-card');
  anchor.href=caseTarget(c);
  anchor.dataset.case=c.id;
  anchor.setAttribute('aria-label','Open '+c.title+' – '+c.subtitle);
  const description=node('div','card-copy');
  const head=node('div','card-heading');
  head.append(node('strong','',c.title),node('span','arrow','↗'));
  description.append(head,node('p','school',c.subtitle));
  const meta=node('div','card-meta');
  const status=isModel(c)?c.status:c.id==='bay-port-pac'?'PDF source':'Source documents';
  meta.append(node('span','status',status));
  if(c.capacity!=null)meta.append(node('span','capacity',
    (c.id==='northview'?'Approx. ':'')+c.capacity.toLocaleString('en-US')+' seats'));
  else meta.append(node('span','capacity','Capacity unknown'));
  description.append(meta);
  anchor.append(graphic(c),description);
  return anchor;
}

function render(){
  const query=$('searchCases').value.trim().toLowerCase();
  const results=VENUE_CASES.filter(c=>
    (filter==='all'||(filter==='models'&&isModel(c))||
    (filter==='schools'&&c.group==='schools'))&&
    [c.title,c.subtitle,c.kind,c.description].join(' ').toLowerCase().includes(query));
  $('caseGrid').replaceChildren(...results.map(card));
  $('emptyCases').hidden=results.length>0;
  document.querySelectorAll('[data-filter]').forEach(button=>
    button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
}

function showDetail(c){
  $('listView').hidden=true;
  $('detailView').hidden=false;
  document.title=c.title+' · FiledMaker';
  $('detailKind').textContent=c.kind;
  $('detailTitle').textContent=c.title;
  $('detailSubtitle').textContent=c.subtitle;
  $('detailStatus').textContent=c.status;
  $('detailDescription').textContent=c.description;
  $('detailGraphic').replaceChildren(graphic(c));
  const facts=$('detailFacts');
  const sourceCapacity=c.capacity==null?'Not published':
    (c.id==='northview'?'Approximately ':'')+c.capacity.toLocaleString('en-US')+' seats';
  const data=[
    ['Documented capacity',sourceCapacity],
    ['Evidence','Original document or project profile'],
    ['3D model','Not yet verified or generated']
  ];
  facts.replaceChildren(...data.map(([label,value])=>{
    const row=node('div','fact');
    row.append(node('span','',label),node('strong','',value));
    return row;
  }));
  $('detailSource').href=c.source;
  $('detailWorkbench').href=c.action;
}

const currentCase=new URLSearchParams(location.search).get('case');
const selected=currentCase?getVenueCase(currentCase):null;
if(selected&&!isModel(selected))showDetail(selected);
else {
  if(currentCase&&selected&&isModel(selected))location.replace(selected.action);
  document.querySelectorAll('[data-filter]').forEach(button=>
    button.addEventListener('click',()=>{
      filter=button.dataset.filter;
      const url=new URL(location.href);
      if(filter==='all')url.searchParams.delete('group');
      else url.searchParams.set('group',filter);
      history.replaceState(null,'',url);
      render();
    }));
  $('searchCases').addEventListener('input',render);
  render();
}
document.documentElement.dataset.casesReady='true';