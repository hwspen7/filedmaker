// The Big Ten batch generator and Seat Studio use the same venue conversion.
// Building and section provenance stay separate from unsurveyed seat XYZ.
export function toBigTenProceduralSpec(venue,sectionProfiles,architecturalSignatures,interiorProfiles={}){
  if(!venue?.model||!venue.venue||!venue.capacity||!venue.id)
    throw Error('Cannot generate a venue without identity, capacity and geometry');
  const {evidenceLevel,...model}=venue.model;
  const layout=sectionProfiles?.[venue.id]??null;
  const signature=architecturalSignatures?.[venue.id]??null;
  const interior=interiorProfiles?.[venue.id]??null;
  const base=structuredClone(model);
  if(interior)base.interior=structuredClone(interior);
  if(signature){
    base.exterior={...base.exterior,entrances:[],signature:structuredClone(signature)};
  }
  if(layout){
    base.tiers=structuredClone(layout.tiersOverride);
    base.sectionMap=structuredClone(layout.tiers);
    if(interior){
      if(interior.upperSubsections){
        if(base.sectionMap.length!==2||base.sectionMap[1].length!==1)
          throw Error('Unsupported upper subsection replacement for '+venue.id);
        base.sectionMap[1][0].sectionIds=[...interior.upperSubsections];
      }
      for(let tier=0;t<base.sectionMap.length;t++){
        const groups=base.sectionMap[tier],sets=interior.sectionWeights?.[tier];
        if(!sets||sets.length!==groups.length)
          throw Error('Incomplete interior section-width map: '+venue.id+' tier '+tier);
        for(let k=0;k<groups.length;k++){
          if(sets[k].length!==groups[k].sectionIds.length)
            throw Error('Interior section weights do not match chart: '+venue.id+' tier '+tier);
          groups[k].weights=[...sets[k]];
        }
      }
    }
    base.sections=Math.max(...layout.tiers.map(groups=>
      groups.reduce((sum,group)=>sum+group.sectionIds.length,0)));
  }
  return {...base,
    id:'big-ten-'+venue.id,
    name:venue.venue.name,
    targetCapacity:venue.capacity.published,
    sources:venue.sources.map(s=>({url:s.url,title:s.title,date:s.verifiedOn})),
    provenance:{
      category:'estimated-parametric',
      school:venue.school.name,
      primaryColor:venue.school.primaryColor??null,
      publishedCapacity:venue.capacity.published,
      publishedCapacitySourceId:venue.capacity.sourceId,
      seatMap:venue.evidence.seatMap,
      seatCoordinates:venue.evidence.seatRoster,
      sectionLabels:layout?.chartIds??'estimated',
      sourceSectionMap:layout?.source??null,
      buildingReference:signature?.source??null,
      buildingStatus:signature?'landmarks-modeled/unsurveyed':'unmodeled',
      sectionOutlineProvenance:layout?'estimated-arc':'estimated-uniform',
      interiorReference:interior?.source??null,
      interiorStatus:interior?'chart-informed-unsurveyed':'unmodeled',
      notice:'Seats and section boundaries are estimated even when school chart section IDs and row-label ranges are sourced.'
    }
  };
}

export async function loadBigTenCatalog(fetcher=fetch){
  const names=['arenas-2026-27.json','reference-section-layouts.json',
    'architectural-signatures.json','interior-reconstructions.json'];
  const urls=names.map(name=>new URL('../../data/big-ten/'+name,import.meta.url));
  const data=await Promise.all(urls.map(async url=>{
    const response=await fetcher(url);
    if(!response.ok)throw Error('Cannot load Big Ten venue data: '+response.status);
    return response.json();
  }));
  const [catalog,sectionFile,architectureFile,interiorFile]=data;
  if(catalog.venues?.length!==18)throw Error('Big Ten catalog is incomplete');
  return {venues:catalog.venues,
    sectionProfiles:sectionFile.layouts,
    architecturalSignatures:architectureFile.venues,
    interiorProfiles:interiorFile.venues};
}
