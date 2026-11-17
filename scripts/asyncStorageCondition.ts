import type {Page,JSHandle} from 'playwright-core';
/** Playwright 1.64's polling loop treats a Promise as truthy before its boolean
 * result. Keep the original timeout and poll the actual asynchronous predicate
 * until it is truthy; retain only a cancellation token, never financial values. */
export async function waitForStoredCondition<A>(page:Page,predicate:(argument:A)=>Promise<unknown>,argument?:A,options?:{timeout?:number;polling?:number|'raf'}):Promise<JSHandle<boolean>>{
 const token=crypto.randomUUID();
 try{
  return await page.waitForFunction(async({source,argument,token})=>{
   (window as any).__name??=(f:unknown)=>f;
   const tokens=(window as any).__storageWaitTokens??={};tokens[token]=true;
   const check=(0,eval)('('+source+')');
   while(tokens[token]){
    if(await check(argument))return true;
    await new Promise<void>(r=>requestAnimationFrame(()=>r()));
   }
   return false;
  },{source:predicate.toString(),argument,token},options);
 }finally{await page.evaluate(token=>{const tokens=(window as any).__storageWaitTokens;if(tokens)delete tokens[token];},token).catch(()=>{});}
}
