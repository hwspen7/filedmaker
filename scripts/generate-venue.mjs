#!/usr/bin/env node
// Offline CLI for data-driven arena/stadium previews. No network or ticket claims.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { generateVenuePackage, PROCEDURAL_DEMOS } from '../src/next/engines/factory.mjs';
import { buildOfflineSchoolViewerHTML } from '../src/schoolPublisher.mjs';

function main(argv){
  const readFlag=(flag,fallback=null)=>{const index=argv.indexOf(flag);return index>=0?argv[index+1]??fallback:fallback;};
  const example=readFlag('--demo'),file=readFlag('--input')??argv.find(v=>v.endsWith('.json'));
  if(!example&&!file){
    console.error('Usage: npm run generate:venue -- --input examples/procedural-arena.json --out build/arena [--html] [--strict]');
    console.error('Or: npm run generate:venue -- --demo arena --out build/arena --html');
    process.exitCode=2;return;
  }
  if(example&&!Object.hasOwn(PROCEDURAL_DEMOS,example))throw Error('Unknown demo: '+example);
  const data=example?PROCEDURAL_DEMOS[example]:JSON.parse(readFileSync(resolve(file),'utf8'));
  const out=resolve(readFlag('--out','build/venue'));
  const {project,model,plan,reference,audit}=generateVenuePackage(data);
  if(!audit.passed)throw Error('Invalid venue geometry: '+audit.errors.join(', '));
  if(argv.includes('--strict')&&audit.warnings.length)throw Error('Strict capacity validation: '+audit.warnings.join(', '));
  mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'project.filedmaker.json'),JSON.stringify(project,null,2)+'\n');
  const report={venue:project.title,schemaVersion:project.schemaVersion,
    generatedPositions:model.seats.length,sourceLevel:'estimated',
    verification:audit,reference,optimization:model.optimization,
    exportedAt:new Date().toISOString()};
  writeFileSync(join(out,'geometry-report.json'),JSON.stringify(report,null,2)+'\n');
  if(argv.includes('--html')){
    const renderer=readFileSync(new URL('../src/next/webgl.js',import.meta.url),'utf8');
    const page=buildOfflineSchoolViewerHTML(project,renderer);
    writeFileSync(join(out,'venue-preview.html'),page);
  }
  console.log(JSON.stringify({output:out,seats:model.seats.length,triangles:audit.stats.meshTriangles,
    capacityError:audit.stats.capacityError,warnings:audit.warnings}));
}
try{main(process.argv.slice(2));}catch(e){console.error('Venue generation failed:',e.message);process.exitCode=1;}
