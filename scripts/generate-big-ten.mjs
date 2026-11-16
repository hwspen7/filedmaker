#!/usr/bin/env node
// Deterministic, offline Big Ten venue generation. No web scraping or
// assertion that synthetic seats correspond to official ticket positions.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateVenuePackage} from '../src/next/engines/factory.mjs';
import {GeometryEngine} from '../src/next/engines/geometry.mjs';
import {buildOfflineSchoolViewerHTML} from '../src/schoolPublisher.mjs';
import {toBigTenProceduralSpec} from '../src/next/bigTenCatalog.mjs';

const DEFAULT_CATALOG=fileURLToPath(new URL('../data/big-ten/arenas-2026-27.json',import.meta.url));
const SECTION_PROFILES=JSON.parse(readFileSync(
  new URL('../data/big-ten/reference-section-layouts.json',import.meta.url),'utf8')).layouts;
const ARCH_SIGNATURES=JSON.parse(readFileSync(
  new URL('../data/big-ten/architectural-signatures.json',import.meta.url),'utf8')).venues;
const INTERIOR_PROFILES=JSON.parse(readFileSync(
  new URL('../data/big-ten/interior-reconstructions.json',import.meta.url),'utf8')).venues;
const VERIFIED_CHARTS=JSON.parse(readFileSync(
  new URL('../data/big-ten/section-chart-verified-order.json',import.meta.url),'utf8')).venues;
const DEFAULT_OUT='build/big-ten-18';
const DEFAULT_MAX_ERROR=.035;
const fail=message=>{throw Error(message);};
const htmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const isSource=source=>Boolean(source&&typeof source==='object'&&
  /^https:\/\//.test(source.url)&&source.title&&
  /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedOn??''));
const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

export function validateBigTenCatalog(catalog,{require18=true}={}){
  if(!catalog||catalog.schemaVersion!=='1.0.0'||!Array.isArray(catalog.venues))
    fail('Unsupported Big Ten arena catalog version or entries');
  if(catalog.conference?.name!=='Big Ten Conference'||
      catalog.conference?.sport!=='men-basketball'||
      catalog.conference?.season!=='2026-27'||
      !isSource(catalog.conference.membershipSource))
    fail('Catalog must cite the 2026–27 Big Ten membership source');
  if(require18&&catalog.venues.length!==18)fail('Expected precisely 18 Big Ten basketball arenas');
  const ids=new Set(),names=new Set();
  for(const venue of catalog.venues){
    const id=venue?.id;
    if(typeof id!=='string'||!/^[a-z0-9-]+$/.test(id)||ids.has(id))
      fail('Duplicate or invalid school id: '+id);
    ids.add(id);
    if(typeof venue.school?.name!=='string'||names.has(venue.school.name))
      fail('Duplicate or invalid school name: '+id);
    names.add(venue.school.name);
    if(venue.venue?.sport!=='men-basketball'||!venue.venue?.name||
        venue.venue.country!=='USA'||!venue.venue.city||!venue.venue.state)
      fail('Missing home-arena identity for '+id);
    const c=venue.capacity;
    if(c?.configuration!=='men-basketball'||!Number.isInteger(c.published)||
        c.published<1000||c.published>100000||!c.notes)
      fail('Invalid published basketball capacity: '+id);
    if(!Array.isArray(venue.sources)||!venue.sources.length||
        !venue.sources.every(isSource))
      fail('Missing original source URLs: '+id);
    const refs=new Set(venue.sources.map(source=>source.id));
    if(refs.size!==venue.sources.length||!refs.has(c.sourceId))
      fail('Published capacity must reference an actual source: '+id);
    for(const alternate of c.alternates??[]){
      if(!Number.isInteger(alternate.published)||!refs.has(alternate.sourceId))
        fail('Invalid alternate capacity or source: '+id);
    }
    const e=venue.evidence;
    if(!e||!['not-digitized','digitized'].includes(e.seatMap)||
      !['not-available','estimated','verified'].includes(e.sectionCoordinates)||
      !['not-available','estimated','verified'].includes(e.seatRoster)||
      !['not-surveyed','estimated','verified'].includes(e.buildingDimensions))
      fail('Venue must declare seat/chart/architecture evidence levels: '+id);
    if(venue.model?.evidenceLevel!=='estimated-parametric')
      fail('No synthetic model may claim verified seat coordinates: '+id);
    const spec=toProceduralSpec(venue);
    GeometryEngine.normalize(spec);
    if(venue.model.capacityTolerance>DEFAULT_MAX_ERROR)
      fail('Big Ten calibration tolerance must not exceed 3.5%: '+id);
  }
  return {schools:ids.size,arenas:catalog.venues.length,
    publishedCapacityTotal:catalog.venues.reduce((sum,v)=>sum+v.capacity.published,0)};
}

export function toProceduralSpec(venue){
  return toBigTenProceduralSpec(venue,SECTION_PROFILES,ARCH_SIGNATURES,INTERIOR_PROFILES);
}

function reportFor(venue,packageResult){
  const {model,reference,audit}=packageResult;
  const target=venue.capacity.published,generated=model.seats.length;
  const relativeError=Math.abs(generated-target)/target;
  return {
    schoolId:venue.id,school:venue.school.name,
    arena:venue.venue.name,city:venue.venue.city,state:venue.venue.state,
    modelStatus:'estimated-parametric',
    interiorProfile:INTERIOR_PROFILES[venue.id]?{type:INTERIOR_PROFILES[venue.id].type,
      outline:INTERIOR_PROFILES[venue.id].outline,
      source:INTERIOR_PROFILES[venue.id].source,
      status:'chart-informed-unsurveyed'}:null,
    sectionMapStatus:model.proceduralSpec.sectionMap?'official-section-ids/estimated-angles':'uniform-estimate',
    architectureSignature:ARCH_SIGNATURES[venue.id]?{roof:ARCH_SIGNATURES[venue.id].roof,
      feature:ARCH_SIGNATURES[venue.id].feature,source:ARCH_SIGNATURES[venue.id].source,
      evidence:'profile-not-surveyed'}:null,
    modeledSectionIdCount:model.proceduralSpec.sectionMap
      ?model.proceduralSpec.sectionMap.flatMap(groups=>groups.flatMap(group=>group.sectionIds)).length
      :model.proceduralSpec.sections,
    osuVisualParity:{
      complete:false,
      chartSectionIdsVerified:Boolean(SECTION_PROFILES[venue.id]?.chartIds==='documented'),
      sectionBoundariesDigitized:false,
      sectionRowTopologyVerified:false,
      exteriorPhotoCalibrated:false,
      seatViewReferenceValidated:false,
      reason:'Capacity-fitting and chart labels do not establish the hand-traced bowl and building fidelity of the OSU example.'
    },
    publishedCapacity:{value:target,configuration:venue.capacity.configuration,
      notes:venue.capacity.notes,sourceId:venue.capacity.sourceId,
      alternates:venue.capacity.alternates??[]},
    generatedSeats:generated,
    capacityDifference:generated-target,
    capacityErrorPct:Number((relativeError*100).toFixed(3)),
    withinTolerance:relativeError<=venue.model.capacityTolerance,
    optimizedSeatPitchMetres:model.optimization.pitch,
    modeledTierRows:model.proceduralSpec.tiers.map(t=>t.rows),
    modeledSections:model.proceduralSpec.sections,
    sources:venue.sources,
    evidence:venue.evidence,
    sectionReference:SECTION_PROFILES[venue.id]?{
      url:SECTION_PROFILES[venue.id].source,
      chartStatus:SECTION_PROFILES[venue.id].chartIds,
      rowLabelStatus:SECTION_PROFILES[venue.id].rowLabels,
      geometryStatus:SECTION_PROFILES[venue.id].geometry,
      layoutType:SECTION_PROFILES[venue.id].layout,
      notes:SECTION_PROFILES[venue.id].notes
    }:null,
    reference,verification:audit,
    warnings:[...new Set([...audit.warnings,
      ...(relativeError>venue.model.capacityTolerance?['Generated capacity exceeds the 3.5% tolerance']:[])])],
    notice:'Published capacity is sourced. Section IDs may be chart-derived; individual XYZ, angular section boundaries, actual row availability and architectural details remain estimated.'
  };
}

function makeIndex(reports,conference){
  const rows=reports.map(r=>`<tr><td><a href="./${encodeURIComponent(r.schoolId)}/venue-preview.html">${htmlEscape(r.school)}</a>
  <small>${htmlEscape(r.arena)}</small></td><td>${r.publishedCapacity.value.toLocaleString('en-US')}</td>
  <td>${r.generatedSeats.toLocaleString('en-US')}</td><td>${r.capacityErrorPct.toFixed(2)}%</td>
  <td>${r.withinTolerance?'Within tolerance':'Needs review'}</td></tr>`).join('\n');
  const total=reports.reduce((sum,r)=>sum+r.generatedSeats,0);
  const target=reports.reduce((sum,r)=>sum+r.publishedCapacity.value,0);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport"
  content="width=device-width,initial-scale=1"><title>FiledMaker — Big Ten 18 Arenas</title>
  <style>body{font:15px/1.55 system-ui,-apple-system,sans-serif;margin:0;color:#202932;background:#f6f7f7}
  main{max-width:1120px;margin:auto;padding:32px 22px 80px}h1{font-size:34px;line-height:1.1;margin-bottom:12px}
  p{color:#53606c;max-width:930px}table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d9e1e6;border-radius:12px;overflow:hidden}
  td,th{border-bottom:1px solid #e5eaec;text-align:left;padding:12px 16px}th{background:#edf2f4;font-size:13px}small{display:block;color:#667581}
  a{color:#1b6680;font-weight:650;text-decoration:none}a:hover{text-decoration:underline}footer{margin-top:22px;color:#697782}
  @media(max-width:700px){table{font-size:12px}td,th{padding:8px}}</style></head><body>
  <main><h1>Big Ten — 18 basketball arenas</h1><p>${htmlEscape(conference.season)}
  · Men’s basketball · ${reports.length} independently generated 3D previews.
  Each link opens a complete offline 3D/2D/seat-view model.</p>
  <p><strong>Reference capacities:</strong> ${target.toLocaleString('en-US')}.
  <strong>Generated positions:</strong> ${total.toLocaleString('en-US')}.
  Published capacity is sourced, but individual row contours, seat locations,
  levels and exteriors are estimated. This is not an official venue model or seat-selection inventory.</p>
  <table><thead><tr><th>School / venue</th><th>Published</th><th>Generated</th>
  <th>Deviation</th><th>QA</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>FiledMaker data specification v1.0.0 · For source links and alternate
  capacity configurations see each venue's geometry-report.json and the batch manifest.</footer>
  </main></body></html>`;
}

function flag(argv,name,fallback=null){
  const i=argv.indexOf(name);
  if(i<0)return fallback;
  if(!argv[i+1]||argv[i+1].startsWith('--'))fail('Missing value for '+name);
  return argv[i+1];
}
function parseArgs(argv){
  if(argv.includes('--help')||argv.includes('-h'))return {help:true};
  const catalogPath=resolve(flag(argv,'--catalog',DEFAULT_CATALOG));
  const out=resolve(flag(argv,'--out',DEFAULT_OUT));
  const only=flag(argv,'--only');
  const strict=argv.includes('--strict');
  const html=argv.includes('--html');
  const dry=argv.includes('--dry-run');
  const maxError=Number(flag(argv,'--max-error',String(DEFAULT_MAX_ERROR)));
  if(!Number.isFinite(maxError)||maxError<0||maxError>.05)fail('Max capacity error must be 0–0.05');
  return {catalogPath,out,only,strict,html,dry,maxError};
}
export function generateBigTenBatch(catalog,{out,only=null,html=false,strict=false,
  maxError=DEFAULT_MAX_ERROR,dry=false}={}){
  const inputSummary=validateBigTenCatalog(catalog);
  const venues=only?catalog.venues.filter(v=>v.id===only):catalog.venues;
  if(!venues.length)fail('Unknown school id: '+only);
  if(html&&!out)fail('HTML generation requires an output folder');
  if(!dry&&!out)fail('Batch generation requires an output folder');
  if(!dry)mkdirSync(out,{recursive:true});
  const renderer=html&&!dry?readFileSync(new URL('../src/next/webgl.js',import.meta.url),'utf8'):null;
  const reports=[];
  for(const venue of venues){
    const spec=toProceduralSpec(venue);
    const result=generateVenuePackage(spec);
    if(!result.audit.passed)fail(venue.id+': invalid model geometry: '+result.audit.errors.join('; '));
    const report=reportFor(venue,result);
    const path=out?join(out,venue.id):null;
    if(!dry){
      mkdirSync(path,{recursive:true});
      writeFileSync(join(path,'venue-spec.json'),JSON.stringify(spec,null,2)+'\n');
      writeFileSync(join(path,'project.filedmaker.json'),JSON.stringify(result.project,null,2)+'\n');
      writeFileSync(join(path,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');
      if(html)writeFileSync(join(path,'venue-preview.html'),
        buildOfflineSchoolViewerHTML(result.project,renderer));
    }
    reports.push(report);
    console.log(venue.id+': '+report.generatedSeats+' / '+report.publishedCapacity.value+
      ' ('+report.capacityErrorPct.toFixed(2)+'%), '+(report.withinTolerance?'OK':'REVIEW'));
  }
  const manifest={
    schemaVersion:catalog.schemaVersion,
    conference:catalog.conference,
    generatedAt:new Date().toISOString(),
    dataLevel:'published-capacity+estimated-geometry',
    schoolCount:reports.length,conferenceSchoolCount:inputSummary.schools,
    referenceCapacityTotal:reports.reduce((s,r)=>s+r.publishedCapacity.value,0),
    generatedSeatTotal:reports.reduce((s,r)=>s+r.generatedSeats,0),
    withinTolerance:reports.every(r=>r.capacityErrorPct/100<=maxError),
    acceptedCapacityError: maxError,
    venues:reports.map(r=>({schoolId:r.schoolId,school:r.school,arena:r.arena,
      publishedCapacity:r.publishedCapacity.value,generatedSeats:r.generatedSeats,
      capacityErrorPct:r.capacityErrorPct,withinTolerance:r.capacityErrorPct/100<=maxError,
      report:r.schoolId+'/geometry-report.json',
      html:html?r.schoolId+'/venue-preview.html':null})),
    chartIdentifiedArenas:reports.filter(r=>r.sectionMapStatus==='official-section-ids/estimated-angles').length,
    osuParityCompleted:reports.filter(r=>r.osuVisualParity.complete).length,
    notice:'No official section-level or seat-level coordinates are asserted. OSU-level visual parity requires digitized section outlines and per-venue building calibration.'
  };
  if(!dry){
    writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    if(html)writeFileSync(join(out,'index.html'),makeIndex(reports,catalog.conference));
  }
  if(strict&&!manifest.withinTolerance)
    fail('Batch exceeds max capacity deviation: '+reports.filter(r=>r.capacityErrorPct/100>maxError)
      .map(r=>r.schoolId+' '+r.capacityErrorPct.toFixed(2)+'%').join(', '));
  return manifest;
}
export function main(argv=process.argv.slice(2)){
  const options=parseArgs(argv);
  if(options.help){
    console.log('Usage: npm run generate:big-ten -- --out build/big-ten-18 [--html] [--strict] [--only michigan] [--dry-run]');
    return;
  }
  const data=JSON.parse(readFileSync(options.catalogPath,'utf8'));
  const result=generateBigTenBatch(data,options);
  console.log(JSON.stringify({output:options.out,schoolCount:result.schoolCount,
    referenceCapacityTotal:result.referenceCapacityTotal,
    generatedSeatTotal:result.generatedSeatTotal,withinTolerance:result.withinTolerance}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error('Big Ten generation failed:',error.message);process.exitCode=1;}
}
