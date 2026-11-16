// Bounded ZIP reader for XLSX. Does not extract to disk, follow paths, or fetch URLs.
// Uses built-in DecompressionStream; encrypted or unsupported archives fail closed.
const MAX_ARCHIVE=16_000_000,MAX_ENTRY=12_000_000,MAX_TOTAL=48_000_000;
const decoder=new TextDecoder('utf-8',{fatal:true});
const crc32=(bytes)=>{
  let crc=0xffffffff;
  for(const b of bytes){
    crc^=b;
    for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
};
const u16=(view,i)=>view.getUint16(i,true);
const u32=(view,i)=>view.getUint32(i,true);
export async function readZip(input,accepted){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.byteLength>MAX_ARCHIVE||bytes.byteLength<22)throw Error('Archive exceeds 16 MB or is invalid');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
    if(u32(view,p)===0x06054b50&&p+22+u16(view,p+20)===bytes.length){eocd=p;break;}
  }
  if(eocd<0)throw Error('ZIP end-of-directory not found');
  const entries=u16(view,eocd+10),offset=u32(view,eocd+16);
  if(u16(view,eocd+8)!==entries||u16(view,eocd+4)!==0||u16(view,eocd+6)!==0)
    throw Error('Spanned ZIP archives are not supported');
  if(entries>8000||offset>=eocd)throw Error('ZIP directory exceeds limits');
  const result=new Map(),seen=new Set();
  let pos=offset,total=0;
  for(let i=0;i<entries;i++){
    if(pos+46>eocd||u32(view,pos)!==0x02014b50)throw Error('Invalid ZIP central directory');
    const flags=u16(view,pos+8),method=u16(view,pos+10);
    const checksum=u32(view,pos+16),compressed=u32(view,pos+20),size=u32(view,pos+24);
    const nlen=u16(view,pos+28),extra=u16(view,pos+30),comment=u16(view,pos+32);
    const local=u32(view,pos+42),end=pos+46+nlen+extra+comment;
    if(end>eocd||pos+46+nlen>bytes.length)throw Error('Truncated ZIP entry');
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+nlen));
    pos=end;
    if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||seen.has(name))
      throw Error('Unsafe or duplicate ZIP entry');
    seen.add(name);
    if(flags&1)throw Error('Encrypted spreadsheet archives are unsupported');
    if(!accepted(name))continue;
    if(![0,8].includes(method)||size>MAX_ENTRY||compressed>MAX_ARCHIVE||
      size>compressed*500+2048)throw Error('Spreadsheet member exceeds safety limits');
    total+=size;
    if(total>MAX_TOTAL)throw Error('Spreadsheet uncompressed content exceeds limits');
    if(local+30>bytes.length||u32(view,local)!==0x04034b50)throw Error('Corrupt ZIP local header');
    const start=local+30+u16(view,local+26)+u16(view,local+28);
    if(start+compressed>bytes.length)throw Error('Truncated ZIP content');
    let payload=bytes.subarray(start,start+compressed);
    if(method===8){
      if(typeof DecompressionStream!=='function')throw Error('Browser lacks ZIP decompression');
      const stream=new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const chunks=[];let count=0;
      for await(const chunk of stream){
        count+=chunk.byteLength;
        if(count>MAX_ENTRY||count>size)throw Error('ZIP decompression limit exceeded');
        chunks.push(chunk);
      }
      payload=new Uint8Array(count);
      let at=0;for(const chunk of chunks){payload.set(chunk,at);at+=chunk.length;}
    }
    if(payload.length!==size||crc32(payload)!==checksum)throw Error('ZIP checksum or size mismatch');
    result.set(name,payload);
  }
  return result;
}
