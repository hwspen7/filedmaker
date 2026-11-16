// The Big Ten batch generator and Seat Studio use the same venue conversion.
// Building and section provenance stay separate from unsurveyed seat XYZ.
export function toBigTenProceduralSpec(venue,sectionProfiles,architecturalSignatures,interiorProfiles={},verifiedChartPlacements={}){
  if(!venue?.model||!venue.venue||!venue.capacity||!venue.id)
    throw Error('Cannot generate a venue without identity, capacity and geometry');
  const {evidenceLevel,...model}=venue.model;
  const layout=sectionProfiles?.[venue.id]??null;
  const signature=architecturalSignatures?.[venue.id]??null;
  const interior=interiorProfiles?.[venue.id]??null;
  const chart=verifiedChartPlacements?.[venue.id]??null;
  const base=structuredClone(model);
  if(interior)base.interior=structuredClone(interior);
  if(signature){
    base.exterior={...base.exterior,entrances:[],signature:structuredClone(signature)};
  }
  if(layout){
    base.tiers=structuredClone(layout.tiersOverride);
    base.sectionMap=structuredClone(layout.tiers);
    // Verified chart identities and clockwise adjacency are authoritative.
    // Never re-derive real section positions from a fictional section count or
    // the old cyclic width-pattern templates.
    if(interior&&!chart&&interior.scope!=='applied-to-synthetic-model-only')
      throw Error('First-wave interior requires a verified section-chart order: '+venue.id);
    if(interior&&!chart&&!/^https:\/\//.test(interior.source??''))
      throw Error('School-specific schematic profile is missing its source: '+venue.id);
    if(chart){
      if(!/^https:\/\//.test(chart.source)||chart.spatialPrecision!=='section-label-order-only')
        throw Error('Chart placement source or evidence precision missing for '+venue.id);
      if(!Array.isArray(chart.tierGroups)||chart.tierGroups.length!==base.tiers.length)
        throw Error('Official chart tier count mismatch for '+venue.id);
      const official=new Set(chart.verifiedSections);
      if(official.size!==chart.verifiedSections.length)
        throw Error('Official section list contains duplicates: '+venue.id);
      const mapped=chart.tierGroups.flatMap(groups=>groups.flatMap(g=>g.sectionIds));
      const found=new Set(mapped);
      if(found.size!==official.size||[...found].some(id=>!official.has(id)))
        throw Error('Chart section identity mismatch for '+venue.id);
      const omissions=new Set(chart.unmodeledSections??[]);
      if([...omissions].some(id=>found.has(id)))
        throw Error('A documented missing section was fabricated for '+venue.id);
      base.sectionMap=chart.tierGroups.map((groups,tierIndex)=>{
        const maxRows=Math.max(...groups.map(g=>g.rowCount));
        if(base.tiers[tierIndex].rows<maxRows)
          base.tiers[tierIndex].rows=maxRows;
        return groups.map(g=>({
          ...structuredClone(g),
          // Estimates are allowed only when explicitly stored and labeled.
          weights:g.weights??g.sectionIds.map(()=>1)
        }));
      });
    }
    base.sections=Math.max(...base.sectionMap.map(groups=>
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
      sectionOutlineProvenance:chart?'official-adjacency-estimated-shape':layout?'estimated-arc':'estimated-uniform',
      interiorReference:interior?.source??null,
      verifiedChartSource:chart?.source??null,
      verifiedChartSectionIds:chart?.verifiedSections??null,
      unmodeledDocumentedSections:chart?.unmodeledSections??[],
      nonSeatChartLabels:chart?.nonSeatLabels??[],
      interiorStatus:interior?(chart?'chart-informed-unsurveyed':'source-linked-illustrative-unsurveyed'):'unmodeled',
      notice:chart?'Section labels and circular neighbor order are source backed. Precise outlines, angles, row counts and individual seat coordinates are unverified. Omitted chart areas are intentionally not fabricated.':'Seats and section boundaries are estimated even when school chart section IDs and row-label ranges are sourced.'
    }
  };
}

export async function loadBigTenCatalog(fetcher=fetch){
  const names=['arenas-2026-27.json','reference-section-layouts.json',
    'architectural-signatures.json','interior-reconstructions.json',
    'section-chart-verified-order.json'];
  const urls=names.map(name=>new URL('../../data/big-ten/'+name,import.meta.url));
  const data=await Promise.all(urls.map(async url=>{
    const response=await fetcher(url);
    if(!response.ok)throw Error('Cannot load Big Ten venue data: '+response.status);
    return response.json();
  }));
  const [catalog,sectionFile,architectureFile,interiorFile,chartFile]=data;
  if(catalog.venues?.length!==18)throw Error('Big Ten catalog is incomplete');
  return {venues:catalog.venues,
    sectionProfiles:sectionFile.layouts,
    architecturalSignatures:architectureFile.venues,
    interiorProfiles:interiorFile.venues,
    verifiedChartPlacements:chartFile.venues};
}
