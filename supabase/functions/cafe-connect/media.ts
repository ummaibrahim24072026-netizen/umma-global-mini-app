import {validMedia} from '../delivery-chat/translation.ts';

const maxSize={photo:8*1024*1024,video:20*1024*1024,voice:5*1024*1024};
const mimes:Record<string,keyof typeof maxSize>={
 'image/jpeg':'photo','image/png':'photo','image/webp':'photo',
 'video/mp4':'video','video/webm':'video','video/quicktime':'video',
 'audio/webm':'voice','audio/mp4':'voice','audio/ogg':'voice',
};

const albumMime='application/octet-stream';
const albumLimit=20*1024*1024;

function jsonLine(bytes:Uint8Array,limit:number):[unknown,Uint8Array]{
 const boundary=bytes.subarray(0,limit).indexOf(10);
 if(boundary<0)throw Error('MEDIA_FORMAT');
 try{
  const json=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,boundary));
  return [JSON.parse(json),bytes.subarray(boundary+1)];
 }catch{throw Error('MEDIA_FORMAT');}
}

function validateAlbum(file:Uint8Array){
 const [items,contents]=jsonLine(file,2048);
 if(!Array.isArray(items)||items.length<2||items.length>10)throw Error('MEDIA_FORMAT');
 let offset=0;
 for(const item of items){
  if(!item||typeof item.type!=='string'||!Object.hasOwn(mimes,item.type))throw Error('MEDIA_FORMAT');
  const kind=mimes[item.type],size=item.size;
  if(kind==='voice'||!Number.isSafeInteger(size)||size<=0||offset+size>contents.length)throw Error('MEDIA_FORMAT');
  if(size>maxSize[kind])throw Error('MEDIA_SIZE');
  const started=offset;
  offset+=size;
  if(!validMedia(contents.subarray(started,Math.min(started+64,offset)),item.type))throw Error('MEDIA_FORMAT');
 }
 if(offset!==contents.length)throw Error('MEDIA_FORMAT');
}

export async function connectMedia(req:Request,mime:string){
 if(!(mime===albumMime||Object.hasOwn(mimes,mime))||!req.body)throw Error('MEDIA_FORMAT');
 const kind=mime===albumMime?'album':mimes[mime];
 const fileLimit=kind==='album'?albumLimit:maxSize[kind],limit=fileLimit+12001;
 if(Number(req.headers.get('content-length'))>limit)throw Error('MEDIA_SIZE');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];
 let size=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>limit){await reader.cancel();throw Error('MEDIA_SIZE');}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 // The first line is a JSON caption. Everything after it is the original file.
 const [body,file]=jsonLine(bytes,12001);
 if(file.length>fileLimit)throw Error('MEDIA_SIZE');
 if(typeof body!=='string'||body.length>2000)throw Error('MEDIA_FORMAT');
 if(kind==='album')validateAlbum(file);
 else if(!validMedia(file.subarray(0,64),mime))throw Error('MEDIA_FORMAT');
 return {bytes:file,kind,body:body.trim()};
}
