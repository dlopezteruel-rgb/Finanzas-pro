import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
export async function executeLogged(command,args,{logPath,cwd=process.cwd(),env=process.env,output=process.stdout}={}){
  await mkdir(path.dirname(logPath),{recursive:true});const log=createWriteStream(logPath),start=Date.now();
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env,stdio:['ignore','pipe','pipe']});let stdout='';
    child.stdout.on('data',data=>{stdout+=data;log.write(data);output.write(data);});child.stderr.on('data',data=>{log.write(data);output.write(data);});
    child.on('error',error=>{log.end(()=>reject(error));});
    child.on('close',(code,signal)=>{log.end(()=>resolve({command:[command,...args],code,signal,durationMs:Date.now()-start,stdout}));});
  });
}
