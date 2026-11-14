// Ohio Stadium reference reconstruction; individual seat coordinates are not surveyed.
import { createProject, createCustomOutline, validateProject, makeSections } from './model.mjs';
export const OHIO_STADIUM=Object.freeze({
 id:'ohio-stadium',name:'Ohio Stadium',city:'Columbus',state:'Ohio',country:'United States',
 lengthM:919*.3048,widthM:679*.3048,heightM:136*.3048,pressBoxRoofM:183*.3048,
 publishedCapacity:102041,scoreboardWidthM:125*.3048,scoreboardHeightM:42*.3048,
 sources:['https://ohiostatebuckeyes.com/sports/2023/6/2/ohio-stadium','https://ohiostatebuckeyes.com/sports/2022/8/17/maps','https://library.osu.edu/a-walk-in-our-shoe/renovations','https://ohiostatebuckeyes.com/news/2022/2/7/new-ohio-stadium-field-turf-design-announced']
});
export const isOhioReference=p=>p?.venueReference?.id===OHIO_STADIUM.id;
export function ohioSectionRegion(angleDegrees){
 const a=((angleDegrees%360)+360)%360;
 if(a>=48&&a<132)return 'south';
 if(a>=228&&a<312)return 'north';
 return a<180?'east':'west';
}
export function ohioTierRowCount(id,a,rows){
 const region=ohioSectionRegion(a);
 if(region==='south'&&id==='T4')return 0;
 if(region==='south'&&id==='T3')return Math.min(rows,10);
 return rows;
}
export function ohioFactReport(p,generatedCount=0){return{
 venue:OHIO_STADIUM.name,publishedDimensions:`${OHIO_STADIUM.lengthM.toFixed(1)} × ${OHIO_STADIUM.widthM.toFixed(1)} m`,
 publishedCapacity:OHIO_STADIUM.publishedCapacity,generatedReferenceSeats:generatedCount,officialSeatCoordinatesAvailable:false,
 reconstructionStatus:'architectural interpretation — not surveyed',
 notes:['Historic horseshoe, permanent South Stands, western press/suite structures and north rotunda follow documented stadium facts.','Exact seat centers, steps, heights, aisles and section boundaries remain estimates.','Generated seats are NOT official capacity.'],
 sources:[...OHIO_STADIUM.sources]
};}
export function createOhioStadiumProject(){
 const p=createProject('nfl');
 Object.assign(p,{title:'Ohio Stadium — architectural reference',city:'Columbus',country:'United States',shape:3.15,seatPitch:.55,aisleWidth:1.34,roof:false,detailLevel:'high',showExterior:true,showFixtures:true,
 venueReference:{id:OHIO_STADIUM.id,dataLevel:'documented-architecture/estimated-seating',seatNumbering:'synthetic',measurementNotice:'Architectural reference only. Exact section boundaries, seat locations and risers require survey.'}});
 p.sections=makeSections(32).map((s,i)=>{const r=ohioSectionRegion((s.start+s.end)/2);return{...s,label:`${r[0].toUpperCase()+r.slice(1)} bowl sector ${String(i+1).padStart(2,'0')}`,color:i%6<2?'#a9293d':i%6===4?'#a4a9a9':'#778387'};});
 p.tiers=[
 {id:'T1',label:'AA deck / field-level interpretation',rows:12,depth:.80,rise:.28,offset:4.5,height:.9,gap:2,heightGap:1.9},
 {id:'T2',label:'A deck / lower bowl interpretation',rows:25,depth:.81,rise:.34,offset:0,height:0,gap:2.4,heightGap:2.5},
 {id:'T3',label:'B / club-tier interpretation',rows:12,depth:.83,rise:.38,offset:0,height:0,gap:2.4,heightGap:3.1},
 {id:'T4',label:'C / upper horseshoe interpretation',rows:22,depth:.86,rise:.52,offset:0,height:0,gap:0,heightGap:0}];
 p.outline=createCustomOutline(p,48);
 p.outline.points=p.outline.points.map(point=>({x:Number((point.x*(point.z<0?1.025:.995)).toFixed(3)),z:Number((point.z*(point.z<0?1.025:1.015)).toFixed(3))}));
 p.sectionProfiles=[];
 for(const sec of p.sections)for(const tier of p.tiers){const rows=ohioTierRowCount(tier.id,(sec.start+sec.end)/2,tier.rows);if(rows!==tier.rows)p.sectionProfiles.push({sectionId:sec.id,tierId:tier.id,rows,frontShift:0,heightShift:0,rise:tier.rise,depth:tier.depth});}
 p.aisles=Array.from({length:14},(_,i)=>({id:`illustrative-aisle-${i+1}`,angle:Number(((i+.5)*360/14).toFixed(3)),width:1.45,tier:'all'}));
 p.portals=[{id:'illustrative-east-lower',tierId:'T2',angle:9,width:5,firstRow:11,lastRow:17},{id:'illustrative-west-lower',tierId:'T2',angle:171,width:5,firstRow:11,lastRow:17},{id:'illustrative-north-lower',tierId:'T2',angle:270,width:5,firstRow:11,lastRow:17},{id:'illustrative-east-upper',tierId:'T4',angle:345,width:5,firstRow:9,lastRow:14},{id:'illustrative-west-upper',tierId:'T4',angle:195,width:5,firstRow:9,lastRow:14}];
 p.survey.venue='Ohio Stadium';p.survey.source='Ohio State official architectural facts and seating maps; interpretive sector geometry';p.survey.sourceUrl=OHIO_STADIUM.sources[0];p.survey.mode='generated';
 return validateProject(p);
}
