import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
test('venue CLI writes an editable project, provenance audit and standalone architectural preview',()=>{
  const output=mkdtempSync(join(tmpdir(),'filedmaker-venue-'));
  try{
    const log=execFileSync(process.execPath,['scripts/generate-venue.mjs',
      '--demo','arena','--out',output,'--html'],{cwd:root,encoding:'utf8',timeout:60000});
    const status=JSON.parse(log.trim());
    const project=JSON.parse(readFileSync(join(output,'project.filedmaker.json'),'utf8'));
    const report=JSON.parse(readFileSync(join(output,'geometry-report.json'),'utf8'));
    const html=readFileSync(join(output,'venue-preview.html'),'utf8');
    assert.ok(status.seats>5000);
    assert.equal(project.proceduralVenue.id,'demo-arena');
    assert.equal(report.verification.passed,true);
    assert.equal(report.verification.stats.seats,status.seats);
    assert.equal(report.sourceLevel,'estimated');
    assert.equal(report.reference.coordinatesCertified,false);
    assert.match(html,/packedArchitecture/);
    assert.match(html,/NativeVenueRenderer/);
    assert.ok(html.length>100000);
  }finally{rmSync(output,{recursive:true,force:true});}
});
