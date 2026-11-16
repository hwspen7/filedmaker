// QA-only operator draft for Aiken High School, NOT an official seating model.
// Exactly the bank totals are documented. All row allocation, dimensions,
// elevations, and seat identifiers below are explicitly INVENTED test assumptions.
import {newVenue,normalizeVenue} from '../contract.mjs';
const URL='https://core-docs.s3.us-east-1.amazonaws.com/documents/asset/uploaded_file/4726/district/4317364/AHS_Gym_Renovation_Design_Development__04_18_19_.pdf';
const banks=[
  {id:'BANK A',count:284,rows:6,x0:-17.8,x1:-22.6,z0:-16,z1:16,base:3.2},
  {id:'BANK B',count:431,rows:9,x0:-9.8,x1:-16.4,z0:-16,z1:16,base:.48},
  {id:'BANK C',count:431,rows:9,x0:9.8,x1:16.4,z0:-16,z1:16,base:.48},
  {id:'BANK D',count:272,rows:6,x0:17.8,x1:22.6,z0:-16,z1:16,base:3.2}
];
export function makeAikenUnverifiedOperatorDraft(){
  const v=newVenue('nfhs-basketball');
  v.school='Aiken High School (illustrative QA input)';
  v.venue='Taylor Gymnasium — operator-estimated geometry';
  v.officialCapacity=1418;
  v.capacitySource=URL;
  v.notes=[
    'QA ONLY: bank totals come from the published 2019 renovation drawing.',
    'ALL 30 modeled row counts, individual labels, traced footprints and heights are arbitrary engineering assumptions.',
    'These are not the real official row counts or ticket identities.',
    'Human inspection and authentic per-row records are required before delivery.'
  ];
  for(const bank of banks){
    v.sections.push({id:bank.id,
      front:[{x:bank.x0,z:bank.z0},{x:bank.x0,z:bank.z1}],
      back:[{x:bank.x1,z:bank.z0},{x:bank.x1,z:bank.z1}],
      trace:[],baseHeight:bank.base,rowRise:.28,
      provenance:'qa-only/human-assumed-footprint'});
    const minimum=Math.floor(bank.count/bank.rows);
    const remainder=bank.count%bank.rows;
    for(let i=0;i<bank.rows;i++){
      const count=minimum+(i>=bank.rows-remainder?1:0);
      v.rows.push({section:bank.id,row:'ASSUMED-'+(i+1),
        seats:count,first:1,seatType:'bleacher',
        tier:bank.base>1?'T2':'T1'});
    }
  }
  return normalizeVenue(v);
}
