import {validMedia} from '../delivery-chat/translation.ts';

const maxSize={photo:8*1024*1024,video:20*1024*1024,voice:5*1024*1024};
const mimes:Record<string,keyof typeof maxSize>={
 'image/jpeg':'photo','image/png':'photo','image/webp':'photo',
 'video/mp4':'video','video/webm':'video','video/quicktime':'video',
 'audio/webm':'voice','audio/mp4':'voice','audio/ogg':'voice',
};

export async function connectMedia(req:Request,mime:string){
 if(!Object.hasOwn(mimes,mime)||!req.body)throw Error('MEDIA_FORMAT');
 const kind=mimes[mime],limit=maxSize[kind]+12001;
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
 const boundary=bytes.subarray(0,12001).indexOf(10);
 if(boundary<0)throw Error('MEDIA_FORMAT');
 let body;
 try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,boundary)));}
 catch{throw Error('MEDIA_FORMAT');}
 const file=bytes.subarray(boundary+1);
 if(file.length>maxSize[kind])throw Error('MEDIA_SIZE');
 if(typeof body!=='string'||body.length>2000||!validMedia(file.subarray(0,64),mime))throw Error('MEDIA_FORMAT');
 return {bytes:file,kind,body:body.trim()};
}
