export const EXPORT_DIRECTORY='finanzas-prototype-exports';
type FileInfo={name:string;mtime?:number;type?:string};
export type ExportDriver={list:()=>Promise<FileInfo[]>;write:(path:string,text:string)=>Promise<string>;read:(path:string)=>Promise<string>;remove:(path:string)=>Promise<void>;share:(uri:string,title:string)=>Promise<void>};

/** Private cache only. The user initiates every write/cleanup/share operation. */
export function nativeFileExporter(driver:ExportDriver,nonce:()=>string,now=()=>Date.now()){
 let pending=false;
 return async(text:string,filename:string,mime:string,title='')=>{
  if(pending)throw Error('EXPORT_BUSY');
  if(!['application/json','text/csv'].includes(mime)||!filename.toLowerCase().endsWith(mime==='text/csv'?'.csv':'.json')||/[\\/]/.test(filename))throw Error('EXPORT_NAME_INVALID');
  pending=true;let created:string|undefined,verified=false;
  try{
   let old:FileInfo[]=[];try{old=await driver.list();}catch{/* A first export has no directory. */}
   for(const file of old)if(file.type!=='directory'&&/^prototype-[a-zA-Z0-9_.-]+\.(json|csv)$/.test(file.name)&&typeof file.mtime==='number'&&file.mtime<now()-86400000){try{await driver.remove(EXPORT_DIRECTORY+'/'+file.name);}catch{/* Retain private cache; the current export must still be verified. */}}
   const id=nonce();if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('EXPORT_NONCE_INVALID');
   created=EXPORT_DIRECTORY+'/prototype-'+id+'-'+filename.replace(/[^a-zA-Z0-9_.-]/g,'_').slice(-120);
   const uri=await driver.write(created,text);
   if(!uri||await driver.read(created)!==text)throw Error('EXPORT_VERIFICATION_FAILED');
   verified=true;await driver.share(uri,title);
   // Keep the verified cache file for asynchronous recipients. At the next
   // explicit export, expire only our own names older than24h. Never on resume.
  }finally{
   if(created&&!verified)try{await driver.remove(created);}catch{/* Only this failed temporary file is eligible. */}
   pending=false;
  }
 };
}
