#!/usr/bin/env node
// Offline inspection for an exported FiledMaker workbench JSON document.
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {generateTracedVenue} from '../src/workbench/generator.mjs';
import {assessSources} from '../src/workbench/sources.mjs';
async function main(){
  const [, ,name,...args]=process.argv;
  if(!name||args.some(a=>a!=='--strict')){
    console.error('Usage: node scripts/audit-workbench.mjs <venue.filedmaker-workbench.json> [--strict]');
    process.exitCode=2;return;
  }
  const path=resolve(name),meta=await stat(path);
  if(meta.size>12_000_000||meta.size<20)throw Error('Project JSON has an invalid size');
  const project=JSON.parse(await readFile(path,'utf8'));
  const result=generateTracedVenue(project);
  const report={
    project:result.venue.venue,sourceType:result.venue.sport,
    originalRows:result.audit.sourceRows,
    derivedSeats:result.audit.mappedSeats,
    publishedCapacity:result.audit.publishedCapacity,
    geometry:result.quality,
    sources:assessSources(result.venue),
    warnings:result.warnings
  };
  console.log(JSON.stringify(report,null,2));
  // All site-unverified drafts fail strict publication review, by design.
  if(result.quality.blockingCount||(args.includes('--strict')&&
    (result.quality.reviewCount||!result.quality.sourceReview.allReviewed)))
    process.exitCode=2;
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=2;});
