from pathlib import Path
import os,subprocess,json,time,gzip
root=Path('/workspace/work/Finanzas-pro-5h');out=Path('/workspace/work');source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
base_env={**os.environ,'CHROMIUM_PATH':'/usr/bin/chromium','PERF_BACKEND':'indexeddb','PERF_PROFILE':'mobile','PERF_SAMPLES':'3','GEMINI_API_KEY':'','GOOGLE_API_KEY':''};results=[]
commands=[]
for side,dist,sha in [('after',str(root/'dist'),source)]:
 for name,script in [('performance','scripts/performance/measure.ts'),('writes','scripts/performance/webWriteJourneys.ts'),('journeys','scripts/performance/mobileJourneys.ts')]:
  if name=='writes' and side=='before':continue
  commands.append((name,side,dist,sha,[os.sys.executable] if False else ['node','--import','tsx',script]))
for name,side,dist,sha,cmd in commands:
 print('START',side,name,flush=True);env={**base_env,'PERF_SOURCE_SHA':sha,'PERF_DIST':dist,'PERF_OUTPUT':str(out/f'5h-integration-{name}-{side}.json')};log=out/f'5h-integration-{name}-{side}.log';start=time.time()
 with log.open('w') as f:p=subprocess.run(cmd,cwd=root,env=env,stdout=f,stderr=subprocess.STDOUT)
 results.append({'name':name,'side':side,'source':sha,'code':p.returncode,'durationMs':round((time.time()-start)*1000),'log':str(log)})
 (out/'5h-integration-measurement-commands.json').write_text(json.dumps(results,indent=2)+'\n')
 if p.returncode:raise RuntimeError(f'{side} {name} failed, inspect {log}')
 d=json.loads(Path(env['PERF_OUTPUT']).read_text());assert not d['errors'] and not d.get('external',[]) and not d.get('unexpectedAPI',[])
 for path in out.glob(f'5h-integration-{name}-{side}-*.cpuprofile'):
  with gzip.GzipFile(filename=str(path)+'.gz',mode='wb',mtime=0) as f:f.write(path.read_bytes())
  path.unlink() # only this run's duplicate generated profile; gzip preserved
 print('PASS',side,name,flush=True)
print('All comparative measurements complete',flush=True)
