// Offline XLSX reader with explicit sheet selection and no formulas evaluation.
// Only real cell values are read; formulas without cached values are rejected.
import {readZip} from './zip.mjs';
const decode=new TextDecoder('utf-8',{fatal:true});
const elements=(root,local)=>Array.from(root.getElementsByTagName('*')).filter(el=>el.localName===local);
const parseXML=(bytes)=>{
  const xml=new DOMParser().parseFromString(decode.decode(bytes),'application/xml');
  if(xml.getElementsByTagName('parsererror').length)throw Error('Invalid XLSX XML');
  return xml;
};
const attr=(el,name)=>el.getAttribute(name)||el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships',name);
const textOf=(el,tag)=>elements(el,tag).map(x=>x.textContent).join('');
const decodeCell=(cell,shared)=>{
  const kind=cell.getAttribute('t');
  if(kind==='e')throw Error('Spreadsheet contains an error cell at '+cell.getAttribute('r'));
  if(elements(cell,'f').length&&!elements(cell,'v').length)
    throw Error('Formula cell has no cached value: '+cell.getAttribute('r'));
  if(kind==='s'){
    const idx=Number(textOf(cell,'v'));
    if(!Number.isSafeInteger(idx)||idx<0||idx>=shared.length)throw Error('Invalid XLSX shared string index');
    return shared[idx];
  }
  if(kind==='inlineStr')return textOf(cell,'t');
  return textOf(cell,'v');
};
const col=(address)=>{
  const match=/^([A-Z]+)([1-9]\d*)$/.exec(address);
  if(!match)throw Error('Invalid XLSX cell address '+address);
  let n=0;for(const ch of match[1])n=n*26+ch.charCodeAt(0)-64;
  if(n>256)throw Error('Spreadsheet has too many columns');
  return {index:n-1,row:Number(match[2])};
};
export async function inspectXLSX(buffer){
  if(typeof DOMParser==='undefined')throw Error('An XML-capable browser is required for Excel');
  const archive=await readZip(buffer,name=>[
    'xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/sharedStrings.xml',
  ].includes(name)||/^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const wb=archive.get('xl/workbook.xml'),rels=archive.get('xl/_rels/workbook.xml.rels');
  if(!wb||!rels)throw Error('Not a supported XLSX workbook');
  const workbook=parseXML(wb),relationships=parseXML(rels);
  const relMap=new Map(elements(relationships,'Relationship').map(el=>[el.getAttribute('Id'),el.getAttribute('Target')]));
  const sheets=elements(workbook,'sheet').map(el=>{
    const target=relMap.get(attr(el,'id'))||'';
    if(target.startsWith('http:')||target.startsWith('https:'))throw Error('External worksheet relationships are not supported');
    const clean=target.replace(/^\/?xl\//,'').replace(/^\//,'');
    const path=clean.startsWith('worksheets/')?'xl/'+clean:'xl/'+clean;
    if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)||!archive.has(path))
      throw Error('Unsupported worksheet path '+path);
    return {name:el.getAttribute('name')||'',path};
  });
  if(!sheets.length)throw Error('Workbook has no worksheets');
  const shared=archive.has('xl/sharedStrings.xml')?
    elements(parseXML(archive.get('xl/sharedStrings.xml')),'si').map(el=>textOf(el,'t')):[];
  return {sheets:sheets.map(s=>s.name),
    read(index=0){
      if(!Number.isInteger(index)||index<0||index>=sheets.length)throw Error('Invalid worksheet index');
      const xml=parseXML(archive.get(sheets[index].path));
      const rows=[];
      for(const item of elements(xml,'row')){
        const values=[],rowNum=Number(item.getAttribute('r'));
        if(!Number.isSafeInteger(rowNum)||rowNum<1||rowNum>20000)throw Error('Invalid worksheet row');
        for(const cell of elements(item,'c')){
          const {index:column,row}=col(cell.getAttribute('r')||'');
          if(row!==rowNum)throw Error('XLSX row/cell index mismatch');
          values[column]=decodeCell(cell,shared);
        }
        if(values.some(v=>v!=null&&v!==''))rows.push(values);
        if(rows.length>16001)throw Error('Worksheet exceeds 16,000 rows');
      }
      if(rows.length<2)throw Error('Worksheet needs a header and data rows');
      const columns=rows[0].map(v=>String(v??'').trim().toLowerCase());
      const headers=new Set();
      for(const h of columns){if(!h||headers.has(h))throw Error('Blank or duplicate XLSX column heading');headers.add(h);}
      return rows.slice(1).map((cells,j)=>{
        if(cells.slice(columns.length).some(v=>v!=null&&v!==''))throw Error('Unexpected extra spreadsheet columns');
        return Object.fromEntries(columns.map((heading,k)=>[heading,String(cells[k]??'')]));
      });
    }
  };
}
