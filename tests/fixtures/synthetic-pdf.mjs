// Minimal, deterministic PDF fixtures for real browser and text-layer tests.
// No arbitrary third-party attachments or remote PDF services are involved.
const ascii=s=>Uint8Array.from([...s].map(c=>c.charCodeAt(0)));
function assemble(objects){
  const chunks=['%PDF-1.4\n'],offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(chunks.join('').length);
    chunks.push((i+1)+' 0 obj\n'+objects[i]+'\nendobj\n');
  }
  const xref=chunks.join('').length;
  chunks.push('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n');
  for(let i=1;i<offsets.length;i++)chunks.push(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
  chunks.push('trailer\n<< /Root 1 0 R /Size '+(objects.length+1)+' >>\n'+
    'startxref\n'+xref+'\n%%EOF\n');
  return ascii(chunks.join(''));
}
const stream=code=>'<< /Length '+code.length+' >>\nstream\n'+code+'\nendstream';
export function makeSchoolPdf(){
  const vector=[
    '0 0 0 RG 3 w 30 30 500 330 re S',
    '60 60 170 100 re S 300 60 170 100 re S',
    '60 205 170 100 re S 300 205 170 100 re S',
    'BT /F1 22 Tf 94 104 Td (WEST-1) Tj ET',
    'BT /F1 22 Tf 330 104 Td (EAST-1) Tj ET',
    'BT /F1 22 Tf 94 250 Td (WEST-2) Tj ET',
    'BT /F1 22 Tf 330 250 Td (EAST-2) Tj ET'
  ].join('\n')+'\n';
  const scanned='0.5 g 20 20 530 360 re f\n0.2 g 50 70 450 260 re f\n';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 580 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 580 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    stream(vector),
    stream(scanned),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  return assemble(objects);
}
