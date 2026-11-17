#!/usr/bin/env node
// Rebuild the five demonstration venue JSON datasets from the existing Big Ten
// chart and interior profiles. Source identity and geometry assumptions stay
// explicit; no images are scanned and no target-capacity fitting is performed.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BIG_TEN_CASES,prepareBigTenExample}
  from '../src/reconstruction/bigTenShowcase.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=filename=>JSON.parse(readFileSync(join(root,'data','big-ten',filename),'utf8'));
export function prepareAll({out=join(root,'data','reconstruction-showcase'),dry=false}={}){
  const source={
    venues:read('arenas-2026-27.json').venues,
    layouts:read('reference-section-layouts.json').layouts,
    charts:read('section-chart-verified-order.json').venues,
    interiors:read('interior-reconstructions.json').venues,
  };
  const cases=[],ids=new Set();
  if(!dry)mkdirSync(out,{recursive:true});
  for(const entry of BIG_TEN_CASES){
    if(ids.has(entry.id))throw Error('Duplicate Big Ten showcase ID');
    ids.add(entry.id);
    const venue=prepareBigTenExample(entry.id,source);
    if(!dry)writeFileSync(join(out,entry.id+'.json'),JSON.stringify(venue,null,2)+'\n');
    cases.push({id:entry.id,school:venue.school,venue:venue.venue,
      sections:venue.totals.sections,rows:venue.totals.rows,seats:venue.totals.seats,
      publishedCapacity:venue.officialCapacity,
      note:'All 3D seat positions and unmeasured bank contours are modeled estimates'});
  }
  const manifest={description:'Five independently prepared Big Ten basketball venue interior geometry drafts; no official seat XYZ or claimed surveyed fidelity',
    venues:cases.map(({id})=>({id,path:id+'.json'}))};
  if(!dry)writeFileSync(join(out,'catalog.json'),JSON.stringify(manifest,null,2)+'\n');
  return {output:out,dry,venues:cases};
}
function main(args=process.argv.slice(2)){
  const flag=args.indexOf('--out');
  const out=flag>=0?resolve(args[flag+1]):join(root,'data','reconstruction-showcase');
  if(flag>=0&&!args[flag+1])throw Error('Missing --out directory');
  const result=prepareAll({out,dry:args.includes('--dry-run')});
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error('Showcase generation failed:',error.message);process.exitCode=1;}
}
