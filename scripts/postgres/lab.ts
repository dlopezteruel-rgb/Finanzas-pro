import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes} from 'node:crypto';
import net from 'node:net';
import {Client} from 'pg';
import {readDatabaseConfig} from '../../server/postgres/config';
const exec=promisify(execFile);
export const image='postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71';
const dockerEnv={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=(args:string[],env:NodeJS.ProcessEnv=dockerEnv)=>exec('docker',['--host=unix:///var/run/docker.sock',...args],{env,maxBuffer:2*1024*1024});
export async function startLab(){
 const dir=await mkdtemp(path.join(tmpdir(),'finanzas-pg18-')),cert=path.join(dir,'cert');await mkdir(cert,{mode:0o700});
 const password=randomBytes(24).toString('hex'),migrator=randomBytes(24).toString('hex'),runtime=randomBytes(24).toString('hex');
 let container='',running=false;const bin=process.env.PG18_BIN;
 const env={...process.env,LD_LIBRARY_PATH:process.env.PG18_LIB??process.env.LD_LIBRARY_PATH};
 const run=async(cmd:string,args:string[])=>exec(cmd,args,{env,maxBuffer:2*1024*1024});
 await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',cert+'/ca.key','-out',cert+'/ca.crt','-days','2','-subj','/CN=FICTIONAL-PG18-TEST-CA']);
 await run('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',cert+'/server.key','-out',cert+'/server.csr','-subj','/CN=localhost']);
 await writeFile(cert+'/extensions','subjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n',{mode:0o600});
 await run('openssl',['x509','-req','-in',cert+'/server.csr','-CA',cert+'/ca.crt','-CAkey',cert+'/ca.key','-CAcreateserial','-out',cert+'/server.crt','-days','2','-extfile',cert+'/extensions']);
 for(const f of ['ca.key','server.csr','ca.srl','extensions'])await rm(cert+'/'+f,{force:true});
 const socket=net.createServer();await new Promise<void>(r=>socket.listen(0,'127.0.0.1',r));const port=(socket.address()as net.AddressInfo).port;await new Promise<void>(r=>socket.close(()=>r()));
 const stop=async()=>{if(container)await docker(['rm','-f','-v',container]).catch(()=>{});else if(running&&bin)await run(path.join(bin,'pg_ctl'),['-D',dir+'/data','stop','-m','fast']).catch(()=>{});await rm(dir,{recursive:true,force:true});};
 try{
  if(bin){
   if(!path.isAbsolute(bin))throw Error('PG18_BIN must be absolute');
   await writeFile(dir+'/password',password,{mode:0o600});
   await run(path.join(bin,'initdb'),['-D',dir+'/data','-U','neondb_owner','--pwfile='+dir+'/password','--auth-host=scram-sha-256','--auth-local=trust','--no-locale','--encoding=UTF8',...(process.env.PG18_SHARE?['-L',process.env.PG18_SHARE]:[])]);
   await writeFile(dir+'/data/pg_hba.conf','local all all trust\nhostssl all all 127.0.0.1/32 scram-sha-256\nhostnossl all all 127.0.0.1/32 reject\n');
   await writeFile(dir+'/data/postgresql.auto.conf',`listen_addresses='127.0.0.1'\nport=${port}\nssl=on\nssl_cert_file='${cert}/server.crt'\nssl_key_file='${cert}/server.key'\nunix_socket_directories='${dir}'\nshared_buffers='16MB'\nmax_connections=25\njit=off\nfsync=on\nfull_page_writes=on\nsynchronous_commit=on\nlog_statement='none'\n`);
   await run(path.join(bin,'pg_ctl'),['-D',dir+'/data','-l',dir+'/server.log','-w','start']);running=true;
  }else{
   const name='finanzas-pg18-'+randomBytes(6).toString('hex');
   await writeFile(cert+'/00-hba.sh',"#!/bin/sh\nprintf 'local all all trust\\nhostssl all all all scram-sha-256\\nhostnossl all all all reject\\n' > \"$PGDATA/pg_hba.conf\"\n",{mode:0o700});
   const r=await docker(['create','--rm','--name',name,'-p',`127.0.0.1:${port}:5432`,'-e','POSTGRES_PASSWORD','-e','POSTGRES_USER=neondb_owner','-e','POSTGRES_DB=neondb','--entrypoint','sh',image,'-c',"mkdir -p /var/lib/postgresql/tls; cp /tmp/tls-fixture/* /var/lib/postgresql/tls/; cp /var/lib/postgresql/tls/00-hba.sh /docker-entrypoint-initdb.d/; chown -R postgres:postgres /var/lib/postgresql/tls; chmod 600 /var/lib/postgresql/tls/server.key; exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/var/lib/postgresql/tls/server.crt -c ssl_key_file=/var/lib/postgresql/tls/server.key -c log_statement=none"],{...dockerEnv,POSTGRES_PASSWORD:password});container=r.stdout.trim();
   await docker(['cp',cert,container+':/tmp/tls-fixture']);await docker(['start',container]);running=true;
  }
  const envConfig={FINANZAS_DB_TARGET:'local-test',FINANZAS_DB_CA_FILE:cert+'/ca.crt',...Object.fromEntries([['ADMIN','neondb_owner',password],['MIGRATOR','finanzas_migrator',migrator],['RUNTIME','finanzas_runtime',runtime]].map(([role,user,pass])=>['FINANZAS_DB_'+role+'_URL',`postgresql://${user}:${pass}@127.0.0.1:${port}/neondb`]))};
  const config=readDatabaseConfig(envConfig);
  let ready=false;for(let i=0;i<80;i++){const c=new Client({...config.connections.admin,database:'postgres'});try{await c.connect();ready=true;}catch{}finally{await c.end().catch(()=>{});}if(ready)break;await new Promise(r=>setTimeout(r,100));}
  if(!ready)throw Error('LOCAL_POSTGRES_START_FAILED');
  const admin=new Client({...config.connections.admin,database:'postgres'});await admin.connect();await admin.query('CREATE DATABASE neondb').catch(e=>{if(e.code!=='42P04')throw e;});await admin.end();
  return {config,dir,cert,port,mode:bin?'local-binaries':'docker',stop,async backupRoundtrip(){
   const dbEnv={...env,PGHOST:'127.0.0.1',PGPORT:String(port),PGUSER:'neondb_owner',PGPASSWORD:password,PGDATABASE:'neondb',PGSSLMODE:'verify-full',PGSSLROOTCERT:cert+'/ca.crt'};
   if(bin){await exec(path.join(bin,'pg_dump'),['-Fc','-f',dir+'/backup.dump'],{env:dbEnv});const c=new Client(config.connections.admin);await c.connect();await c.query('CREATE DATABASE recovery_fixture');await c.end();await exec(path.join(bin,'pg_restore'),['-d','recovery_fixture',dir+'/backup.dump'],{env:dbEnv});}
   else{const e={...dockerEnv,PGPASSWORD:password};await docker(['exec','-e','PGPASSWORD','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/var/lib/postgresql/tls/ca.crt',container,'pg_dump','-h','localhost','-U','neondb_owner','-d','neondb','-Fc','-f','/tmp/backup.dump','--no-password'],e);await docker(['exec','-e','PGPASSWORD','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/var/lib/postgresql/tls/ca.crt',container,'createdb','-h','localhost','-U','neondb_owner','recovery_fixture'],e);await docker(['exec','-e','PGPASSWORD','-e','PGSSLMODE=verify-full','-e','PGSSLROOTCERT=/var/lib/postgresql/tls/ca.crt',container,'pg_restore','-h','localhost','-U','neondb_owner','-d','recovery_fixture','/tmp/backup.dump'],e);}
  }};
 }catch(error){await stop();throw Error('LOCAL_POSTGRES_FIXTURE_FAILED');}
}
