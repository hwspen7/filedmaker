// Audit publicly documented school venues without guessing missing row seats.
// This is an evidence inventory, not a structural, accessibility or ticketing certificate.
const name=s=>String(s??'').trim();
const count=(v,label)=>{
  if(!Number.isSafeInteger(v)||v<0||v>40000)throw Error('Invalid '+label);
  return v;
};
export function auditPublicVenueCase(entry){
  if(!entry||typeof entry!=='object'||!entry.id||!entry.name||
    !/^https:\/\//.test(entry.source?.url??''))throw Error('A source URL and venue name are required');
  const banks=entry.banks??[];
  if(!Array.isArray(banks)||banks.length<1||banks.length>40)throw Error('Invalid seating bank collection');
  const seen=new Set(),verified=[],unknown=[];
  for(const bank of banks){
    const id=name(bank.id);
    if(!id||seen.has(id.toLowerCase()))throw Error('Duplicate or missing bank identity');
    seen.add(id.toLowerCase());
    if(bank.netSeats==null)unknown.push(id);
    else verified.push({id,seats:count(bank.netSeats,'net seat count')});
    if(bank.grossSeats!=null)count(bank.grossSeats,'gross seat count');
    if(bank.grossSeats!=null&&bank.netSeats!=null&&bank.grossSeats<bank.netSeats)
      throw Error('Gross capacity cannot be below net capacity');
  }
  const declared=entry.documentedSeats==null?null:count(entry.documentedSeats,'published capacity');
  const known=verified.reduce((n,b)=>n+b.seats,0);
  if(declared!==null&&unknown.length===0&&entry.precision==='exact'&&declared!==known)
    throw Error('Published net capacity does not reconcile with source bank totals');
  const hasCertifiedRowInventory=entry.rowRecords?.every?.(r=>
    Number.isInteger(r.seats)&&r.seats>0&&typeof r.section==='string') &&
    entry.rowRecords.length>0 &&entry.rowEvidenceReviewed===true;
  const hasMeasuredGeometry=entry.geometryEvidenceReviewed===true&&
    entry.courtCalibrationVerified===true;
  const complete=!!hasCertifiedRowInventory&&!!hasMeasuredGeometry&&unknown.length===0;
  return {
    caseId:entry.id,venue:entry.name,source:entry.source.url,
    documentedSeats:declared,bankNetSeats:known,unknownBanks:unknown,
    precision:entry.precision??'unknown',bankCount:banks.length,
    exactBankReconciliation:unknown.length===0&&declared===known&&entry.precision==='exact',
    canPublishExactModel:false, // independent site review isn't performed by the test harness
    canBuildDraft:complete,readyForHumanReview:true,
    missingEvidence:[
      ...(!hasCertifiedRowInventory?['verified row-by-row seating inventory']:[]),
      ...(!hasMeasuredGeometry?['independently calibrated section geometry']:[]),
      ...(unknown.length?['unreported bank capacities']:[])
    ],accessiblePositions:entry.accessiblePositions??null,
    warnings:[
      ...(entry.precision!=='exact'?['Capacity is approximate or unknown']:[]),
      ...(entry.accessiblePositions!=null?['Accessible spaces must remain distinct from ordinary seats']:[]),
      ...(entry.notes??[])
    ]
  };
}
