// Canonical row importer: CSV, TSV, JSON and XLSX converge on one strict contract.
import {parseCSV} from '../../survey.mjs';
import {parseVenueRows} from '../contract.mjs';
import {inspectXLSX} from './spreadsheet.mjs';
const MAX_ROWS=16000;
function parseTSV(raw){
  if(typeof raw!=='string'||raw.length>32_000_000)throw Error('TSV is too large');
  const lines=raw.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/).filter(s=>s.trim());
  if(lines.length<2||lines.length>MAX_ROWS+1)throw Error('TSV needs a header and up to 16,000 rows');
  const fields=lines.shift().split('\t').map(s=>s.trim().toLowerCase());
  if(fields.some(s=>!s)||new Set(fields).size!==fields.length)throw Error('Invalid TSV headers');
  return lines.map((line,index)=>{
    const cells=line.split('\t');
    if(cells.length!==fields.length)throw Error('TSV row '+(index+2)+' has an invalid column count');
    return Object.fromEntries(fields.map((key,i)=>[key,cells[i]]));
  });
}
const requireRows=(rows)=>{
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS)throw Error('Invalid row inventory size');
  for(const item of rows)if(!item||typeof item!=='object'||Array.isArray(item))
    throw Error('Row records must be objects');
  return rows;
};
const toCSV=records=>{
  const required=['section','row','seats','seat_start','tier','seat_type'];
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  return [required.join(','),...records.map(r=>{
    const mapped={...r,seat_start:r.seat_start??r.first,
      seat_type:r.seat_type??r.seatType};
    return required.map(k=>quote(mapped[k])).join(',');
  })].join('\r\n');
};
export async function importRowFile(file,options={}){
  const name=String(file?.name||'').toLowerCase();
  if(!file||file.size>16_000_000)throw Error('Row file exceeds 16 MB');
  let records,summary={format:'',sheets:[]};
  if(name.endsWith('.xlsx')){
    const workbook=await inspectXLSX(await file.arrayBuffer());
    const index=options.sheetIndex??0;
    records=workbook.read(index);
    summary={format:'XLSX',sheets:workbook.sheets,chosenSheet:workbook.sheets[index]};
  }else if(name.endsWith('.csv')){
    records=parseCSV(await file.text(),MAX_ROWS);
    summary.format='CSV';
  }else if(name.endsWith('.tsv')){
    records=parseTSV(await file.text());
    summary.format='TSV';
  }else if(name.endsWith('.json')){
    const input=JSON.parse(await file.text());
    records=requireRows(Array.isArray(input)?input:input.rows);
    summary.format='JSON';
  }else throw Error('Supported row formats: CSV, TSV, JSON and XLSX');
  const rows=parseVenueRows(toCSV(records));
  return {rows,...summary};
}
