// TEMPORARY CI proof: remove after the red check and artifact are verified.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright-core';
test('CI_FAILURE_PROOF_EXPECTED: deliberate failure, synthetic page only',async t=>{
  const app=express();app.get('/',(_req,res)=>res.type('html').send('<!doctype html><html lang="es"><title>Prueba controlada de CI</title><h1>Fallo controlado de CI</h1><p>Fixture ficticio. Sin datos personales ni credenciales.</p></html>'));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const page=await context.newPage();await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}/`);
    assert.fail('CI_FAILURE_PROOF_EXPECTED: this check must be red; the fixture is removed in the next commit.');
  }finally{await context.close();}
});
