// Explicitly fictional stress fixture. Never use it as a real school's seat map.
import {newVenue} from './contract.mjs';
export function fictionalGym(){
  const v=newVenue('nfhs-basketball');
  v.school='Fictional High School';v.venue='1,500-seat model exercise';
  const ranges=[[-13.2,-.2],[.2,13.2]];
  for(const sign of [-1,1])for(let half=0;half<2;half++){
    const id=(sign<0?'WEST':'EAST')+'-'+(half+1),[low,high]=ranges[half];
    const frontX=sign*10.2,rearX=sign*22.2;
    v.sections.push({id,front:[{x:frontX,z:low},{x:frontX,z:high}],
      back:[{x:rearX,z:low},{x:rearX,z:high}],trace:[],
      baseHeight:.48,rowRise:.29,provenance:'fictional-test-fixture'});
    for(let row=1;row<=15;row++)v.rows.push({
      section:id,row:String(row),seats:25,first:1,tier:'T1',seatType:'bleacher'
    });
  }
  return v;
}
