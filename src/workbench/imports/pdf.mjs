// Staff-assisted PDF import. PDF.js renders locally and provides text cues.
 // Source drawing boundaries and elevations always require operator confirmation.
const MAX_BYTES=24_000_000;
const MAX_PAGES=24;
const MAX_PIXELS=3_200_000;
const MAX_SIDE=2000;
const canonical=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase();
const punctuation=s=>canonical(s).replace(/[\s\-#_.]+/g,'');
export function detectSectionLabels(textItems,rows=[]){
  if(!Array.isArray(textItems)||textItems.length>15000)throw Error('PDF text layer exceeds limit');
  const valid=new Map();
  for(const row of rows){
    const key=punctuation(row.section);
    if(key&&!valid.has(key))valid.set(key,String(row.section));
  }
  const matches=[],unmatched=[],seen=new Set();
  const reg=/^(?:SECTION|SEC|BLOCK|STAND|BLEACHER)\s*[-#:]?\s*([A-Z0-9]{1,8})$/;
  for(const item of textItems){
    const label=canonical(item.text??item.str),match=reg.exec(label);
    const candidate=valid.get(punctuation(label))||(
      match&&valid.get(punctuation(match[1])))||(
      valid.get(punctuation(label.replace(/^(?:SECTION|SEC|BLOCK)\s*/,'') )));
    // Without an imported row list, do not convert arbitrary PDF text
    // into official sections. Only use section-prefixed labels as suggestions.
    const id=candidate||(valid.size?null:(match?label:null));
    if(!id)continue;
    const p={id,text:label,x:Number(item.x)||0,y:Number(item.y)||0,
      kind:candidate?'row-label-match':'unverified-label',
      confidence:candidate?94:60};
    const key=id+'@'+Math.round(p.x/25)+':'+Math.round(p.y/25);
    if(seen.has(key))continue;
    seen.add(key);matches.push(p);
  }
  return {matches:matches.slice(0,200),unmatched,
    mode:matches.length?'operator-label-review':'manual-tracing-required'};
}
export function pdfImportSummary({pageCount,textCount,matches}){
  return {
    pageCount,textCount,matchingLabels:matches.length,
    assistance:textCount?'selectable-text-labels':'raster-or-unreadable-text',
    confidence:textCount?'labels-only/geometry-unverified':'no-text/geometry-unverified',
    manualSteps:['Confirm playing surface','Mark 4 court corners',
      'Trace section edges','Review row counts and elevations','Inspect 3D before sharing'],
    automaticGeometry:false
  };
}
export async function openPdfFile(file){
  if(!file||!(/\.pdf$/i.test(file.name)||file.type==='application/pdf')||
     file.size>MAX_BYTES||file.size<32)
    throw Error('Choose a PDF file between 32 bytes and 24 MB');
  if(typeof document==='undefined')throw Error('PDF import requires a browser');
  const pdfjs=await import('/__filedmaker/pdf/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='/__filedmaker/pdf/pdf.worker.mjs';
  const data=new Uint8Array(await file.arrayBuffer());
  if(String.fromCharCode(...data.subarray(0,5))!=='%PDF-')
    throw Error('File is not a valid PDF header');
  const loading=pdfjs.getDocument({data,isEvalSupported:false,useSystemFonts:true,
    maxImageSize:16_000_000,disableAutoFetch:true,disableStream:true});
  try{
    const pdf=await loading.promise;
    if(pdf.numPages<1||pdf.numPages>MAX_PAGES){
      await loading.destroy();throw Error('PDF must contain 1–24 pages');
    }
    return {loading,pdf,count:pdf.numPages,name:file.name};
  }catch(err){
    await loading.destroy().catch(()=>{});
    throw Error('PDF could not be opened: '+err.message);
  }
}
export async function renderPdfPage(handle,pageNumber,rows=[]){
  const {pdf,count}=handle;
  if(!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>count)
    throw Error('Invalid PDF page');
  const page=await pdf.getPage(pageNumber);
  const v=page.getViewport({scale:1});
  const scale=Math.min(2,MAX_SIDE/Math.max(v.width,v.height),
    Math.sqrt(MAX_PIXELS/(v.width*v.height)));
  const viewport=page.getViewport({scale});
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(viewport.width));
  canvas.height=Math.max(1,Math.round(viewport.height));
  const context=canvas.getContext('2d',{alpha:false});
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
  await page.render({canvasContext:context,viewport}).promise;
  const text=await page.getTextContent({disableNormalization:false});
  const items=text.items.filter(x=>typeof x.str==='string').slice(0,15000);
  const mapped=items.map(item=>{
    const [x,y]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
    return {text:item.str,x,y};
  });
  const labels=detectSectionLabels(mapped,rows);
  const summary=pdfImportSummary({pageCount:count,textCount:items.filter(i=>i.str.trim()).length,
    matches:labels.matches});
  return {pageNumber,width:canvas.width,height:canvas.height,
    imageData:canvas.toDataURL('image/png'),labels:labels.matches,summary};
}
export async function closePdfFile(handle){
  if(handle?.loading)await handle.loading.destroy();
}
