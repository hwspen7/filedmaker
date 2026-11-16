#!/usr/bin/env node
// Batch-export source-driven venue interiors without image ingestion.
// Each input is a manually prepared FiledMaker reconstruction JSON project.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeReconstruction, generateReconstruction } from '../src/reconstruction/core.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const safeSlug=s=>String(s).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80);
function flag(args,name){
  const i=args.indexOf(name);
  if(i<0)return null;
  const value=args[i+1];
  if(!value||value.startsWith('--'))throw Error('Missing value for '+name);
  return value;
}
export function parseReconstructionArgs(args){
  if(args.includes('--help')||args.includes('-h'))return {help:true};
  const input=flag(args,'--input'),catalog=flag(args,'--catalog');
  if(Boolean(input)===Boolean(catalog))
    throw Error('Supply exactly one of --input or --catalog');
  return {
    input:input?resolve(input):null,
    catalog:catalog?resolve(catalog):null,
    out:resolve(flag(args,'--out')||'build/reconstructed'),
    dry:args.includes('--dry-run'),
  };
}
const csvCell=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
export function seatsCSV(seats){
  const rows=['seat_id,section,row,seat,level,x_m,y_m,z_m,coordinate_status'];
  for(const s of seats){
    rows.push([
      s.id,s.section,s.row,s.number,s.tier,
      s.x.toFixed(4),s.y.toFixed(4),s.z.toFixed(4),
      'operator_entered_geometry_unverified',
    ].map(csvCell).join(','));
  }
  return rows.join('\r\n')+'\r\n';
}
export function generateBatch(inputs,{out,dry=false}={}){
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>1000)
    throw Error('Batch input requires between 1 and 1,000 venues');
  const results=[],names=new Set();
  if(!dry)mkdirSync(out,{recursive:true});
  for(const entry of inputs){
    const source=resolve(entry.path),raw=JSON.parse(readFileSync(source,'utf8'));
    const project=normalizeReconstruction(raw);
    const slug=safeSlug(entry.id||project.venue)||'venue';
    if(names.has(slug))throw Error('Duplicate batch output ID: '+slug);
    names.add(slug);
    const generated=generateReconstruction(project,{preview:false});
    const report={
      project:project.venue,school:project.school,
      coordinateStatus:'manual-section-curves/unsurveyed-elevation',
      dataLevel:'operator-supplied/needs-independent-verification',
      sectionCount:project.totals.sections,rowCount:project.totals.rows,
      generatedSeats:generated.seats.length,
      publishedCapacity:project.officialCapacity,
      capacityDifference:project.officialCapacity===null?null:
        generated.seats.length-project.officialCapacity,
      capacityFitting:false,
      renderExterior:false,
      quality:generated.quality,
      warnings:generated.warnings,
      sourceFile:source,
    };
    if(!dry){
      const dest=join(out,slug);mkdirSync(dest,{recursive:true});
      writeFileSync(join(dest,'reconstruction.json'),JSON.stringify(project,null,2)+'\n');
      writeFileSync(join(dest,'seat-coordinates.csv'),seatsCSV(generated.seats));
      writeFileSync(join(dest,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
    }
    results.push({id:slug,school:project.school,venue:project.venue,
      sections:report.sectionCount,rows:report.rowCount,seats:report.generatedSeats,
      capacityDifference:report.capacityDifference,sourceFile:source,
      reportPath:slug+'/validation-report.json'});
  }
  const manifest={format:'filedmaker-reconstruction-batch',count:results.length,
    geometryStatus:'staff-supplied/unverified',capacityFitting:false,exteriorBuilt:false,
    venues:results};
  if(!dry)writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
export function main(args=process.argv.slice(2)){
  const opts=parseReconstructionArgs(args);
  if(opts.help){
    console.log('Usage: node scripts/generate-reconstruction.mjs --input path/to/venue.json --out build/venue');
    console.log('Or: node scripts/generate-reconstruction.mjs --catalog path/to/catalog.json --out build/venues');
    return null;
  }
  let inputs;
  if(opts.input)inputs=[{path:opts.input}];
  else{
    const catalog=JSON.parse(readFileSync(opts.catalog,'utf8'));
    if(!Array.isArray(catalog.venues))throw Error('Catalog requires a venues array');
    inputs=catalog.venues.map(item=>({
      id:item.id,
      path:resolve(dirname(opts.catalog),item.path),
    }));
  }
  const result=generateBatch(inputs,opts);
  console.log(JSON.stringify({output:opts.out,dryRun:opts.dry,
    count:result.count,seats:result.venues.reduce((s,v)=>s+v.seats,0)},null,2));
  return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(e){console.error('Reconstruction failed:',e.message);process.exitCode=1;}
}
