// Pure arena feature plans. Every coordinate below is design interpretation,
// not a verified architectural measurement or licensed digital twin.
import {getNBAArena} from './nbaCatalog.mjs';
import {resolveTiers,SURFACES} from './model.mjs';
export function nbaArenaId(project){
 const ref=project?.venueReference?.id||'';
 if(typeof ref!=='string'||!ref.startsWith('nba:'))return null;
 return getNBAArena(ref.slice(4))?.id||null;
}
export function nbaArchitecturePlan(project){
 const id=nbaArenaId(project);if(!id)return null;
 const tiers=resolveTiers(project);
 const top=Math.max(...tiers.map(t=>t.startHeight+t.rows*t.rise));
 const ceiling=top+9;
 const base={id,top,ceiling,geometryQuality:'conceptual, non-survey',
  rimHeightM:3.048,courtWidthM:SURFACES.nba.width,courtLengthM:SURFACES.nba.length,
  scoreboard:{kind:'center-hung',y:Math.max(15,top*.56),width:5.4,height:3.2},
  premiumBands:[],bridges:[],wall:null};
 if(id==='clippers'){
  base.scoreboard={kind:'halo',y:Math.max(20,top*.72),radius:11.5,height:2.8};
  base.wall={sectorStart:135,sectorEnd:225,rows:51,orientation:'baseline-side',source:'Intuit Dome public press information'};
 }else if(id==='knicks'){
  base.bridges=[{x:-20,y:top+3.5,span:42},{x:20,y:top+3.5,span:42}];
  base.scoreboard={kind:'center-hung',y:top*.58,width:6.2,height:3.5};
 }else if(id==='lakers'){
  base.premiumBands=[12,19,24];
 }else if(id==='bulls'){
  base.premiumBands=[16];
 }else if(id==='warriors'){
  base.premiumBands=[11.5];
 }
 return base;
}
