import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {AssessmentCoordinator, externalIdentityKey, parseAccessRequest, planAccess} from './planner';
import type {AccessRequest, AuthorizationSnapshot, Plan} from './contracts';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
const P='33333333-3333-4333-8333-333333333333', O='44444444-4444-4444-8444-444444444444';
const now=1000;
const request=():AccessRequest=>({profileId:P,operationId:O,action:'read',expectedProfileRevision:2});
const snapshot=():AuthorizationSnapshot=>({session:{issuer:'https://idp.example/',subject:'auth0|A',reference:'fixture',expiresAtMs:2000,revoked:false,authorizationEpoch:3},currentAuthorizationEpoch:3,binding:{issuer:'https://idp.example/',subject:'auth0|A',userId:A,revision:1},user:{id:A,revision:1,status:'active'},profile:{id:P,revision:2,status:'active'},owner:{profileId:P,userId:A,revision:1}});
for(const action of ['read','write','export','restore','financial-operation']as const)test(`7B.1 ${action}: A never receives eligibility for B's profile`,()=>{
 const s=snapshot();s.owner!.userId=B;const r=planAccess(s,{...request(),action},now);assert.equal(r.eligibility,'denied');assert.equal(r.reason,'RESOURCE_DENIED');assert.equal(r.financialAccess,false);
});
test('7B.1 matching owner remains a non-executable plan',()=>{const s=snapshot(),q=request(),before=structuredClone(s);assert.deepEqual(planAccess(s,q,now),{mode:'architecture-only',financialAccess:false,eligibility:'eligible-in-model',reason:'TRANSACTIONAL_ENFORCEMENT_REQUIRED'});assert.deepEqual(s,before);});
for(const field of ['userId','ownerId','ownerSubject','applicationSubject','issuer','sub'])test(`7B.1 browser ${field} cannot assert identity`,()=>assert.equal(planAccess(snapshot(),{...request(),[field]:A},now).reason,'INVALID_REQUEST'));
test('7B.1 profile substitution cannot reuse ownership',()=>{const q=request();q.profileId=B;assert.equal(planAccess(snapshot(),q,now).reason,'RESOURCE_DENIED');});
test('7B.1 no session is deny by default',()=>{const s=snapshot();s.session=null;assert.equal(planAccess(s,request(),now).reason,'SESSION_REQUIRED');});
test('7B.1 session expired including exact deadline',()=>{const s=snapshot();s.session!.expiresAtMs=now;assert.equal(planAccess(s,request(),now).reason,'SESSION_EXPIRED');});
test('7B.1 revoked session is rejected',()=>{const s=snapshot();s.session!.revoked=true;assert.equal(planAccess(s,request(),now).reason,'SESSION_REVOKED');});
test('7B.1 revocation epoch must be current',()=>{const s=snapshot();s.currentAuthorizationEpoch++;assert.equal(planAccess(s,request(),now).reason,'SESSION_REVOKED');});
test('7B.1 unprovisioned subject has no financial rights',()=>{const s=snapshot();s.binding=null;assert.equal(planAccess(s,request(),now).reason,'UNPROVISIONED');});
test('7B.1 disabled user has no rights',()=>{const s=snapshot();s.user!.status='disabled';assert.equal(planAccess(s,request(),now).reason,'UNPROVISIONED');});
test('7B.1 session B cannot inherit user A registry binding',()=>{const s=snapshot();s.session!.subject='google-oauth2|B';assert.equal(planAccess(s,request(),now).reason,'UNPROVISIONED');});
test('7B.1 same email does not merge issuer/subject pairs',()=>{const email='fictional@example.invalid';const a={issuer:'https://idp.example/',subject:'auth0|one',email},b={issuer:'https://idp.example/',subject:'google-oauth2|two',email};assert.notEqual(externalIdentityKey(a),externalIdentityKey(b));const changedEmail={...a,email:'different@example.invalid'};assert.equal(externalIdentityKey(a),externalIdentityKey(changedEmail));});
test('7B.1 subject is scoped by exact issuer, without delimiter collisions',()=>{assert.notEqual(externalIdentityKey({issuer:'https://idp.example/',subject:'a|b'}),externalIdentityKey({issuer:'https://other.example/',subject:'a|b'}));assert.throws(()=>externalIdentityKey({issuer:'http://idp.example/',subject:'x'}));assert.throws(()=>externalIdentityKey({issuer:'https://idp.example',subject:'x'}));});
test('7B.1 internal UUID allocation is independent of provider/email',()=>{const ids=Array.from({length:20},()=>randomUUID());assert.equal(new Set(ids).size,20);for(const id of ids)assert.ok(parseAccessRequest({...request(),profileId:id}));});
test('7B.1 unknown resource and wrong owner share the same denial',()=>{const a=snapshot(),b=snapshot();a.profile=null;b.owner!.userId=B;assert.deepEqual(planAccess(a,request(),now),planAccess(b,request(),now));});
test('7B.1 stale expected revision must not authorize an operation',()=>assert.equal(planAccess(snapshot(),{...request(),expectedProfileRevision:1},now).reason,'REVISION_CONFLICT'));
test('7B.1 simultaneous proposed writes require a fresh revision after the winner',async()=>{
 // Deterministic transaction simulator, NOT database concurrency evidence.
 let state=snapshot();let queue=Promise.resolve();const apply=()=>{const result=queue.then(()=>{const p=planAccess(state,{...request(),action:'write'},now);if(p.eligibility==='eligible-in-model')state.profile!.revision++;return p;});queue=result.then(()=>{});return result;};const outcomes=await Promise.all([apply(),apply()]);assert.deepEqual(outcomes.map(x=>x.eligibility),['eligible-in-model','denied']);assert.equal(outcomes[1].reason,'REVISION_CONFLICT');assert.equal(state.profile!.revision,3);
});
test('7B.1 malformed requests and invalid revisions fail closed',()=>{for(const q of [null,[],{}, {...request(),action:'delete-owner'}, {...request(),expectedProfileRevision:NaN},{...request(),expectedProfileRevision:-1},{...request(),operationId:'invented'}])assert.equal(parseAccessRequest(q),null);});
test('7B.1 missing or blocked ownership metadata is denied',()=>{for(const change of [(s:AuthorizationSnapshot)=>s.owner=null,(s:AuthorizationSnapshot)=>s.profile!.status='blocked',(s:AuthorizationSnapshot)=>s.owner!.revision=-1]){const s=snapshot();change(s);assert.equal(planAccess(s,request(),now).reason,'RESOURCE_DENIED');}});
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};};
test('7B.1 switching shared browser A to B discards late A response',async()=>{
 const a=deferred<Plan>(),b=deferred<Plan>();let n=0;const c=new AssessmentCoordinator({assess:()=>++n===1?a.promise:b.promise});const first=c.assess(request());c.invalidate();assert.equal(c.current.eligibility,'denied');const second=c.assess(request());b.resolve(planAccess({...snapshot(),owner:{profileId:P,userId:B,revision:1}},request(),now));await second;a.resolve(planAccess(snapshot(),request(),now));assert.equal((await first).reason,'STALE_RESULT');assert.equal(c.current.reason,'RESOURCE_DENIED');
});
test('7B.1 concurrent responses cannot publish a superseded result',async()=>{const a=deferred<Plan>();let n=0;const c=new AssessmentCoordinator({assess:()=>++n===1?a.promise:Promise.resolve(planAccess(snapshot(),request(),3000))});const first=c.assess(request());await c.assess(request());a.resolve(planAccess(snapshot(),request(),now));assert.equal((await first).reason,'STALE_RESULT');assert.equal(c.current.reason,'SESSION_EXPIRED');});
test('7B.1 database disconnection fails closed without leaking error text',async()=>{const c=new AssessmentCoordinator({assess:async()=>{throw Error('private database diagnostic');}});assert.equal((await c.assess(request())).reason,'UNAVAILABLE');assert.equal(JSON.stringify(c.current).includes('private'),false);});
test('7B.1 closing a context cancels publication without touching profiles',async()=>{const a=deferred<Plan>();const c=new AssessmentCoordinator({assess:()=>a.promise});const first=c.assess(request());c.close();a.resolve(planAccess(snapshot(),request(),now));assert.equal((await first).reason,'STALE_RESULT');assert.equal(c.current.financialAccess,false);});
test('7B.1 cannot return an executable grant from a simulation port',async()=>{const c=new AssessmentCoordinator({assess:async()=>({...planAccess(snapshot(),request(),now),financialAccess:true})as unknown as Plan});assert.equal((await c.assess(request())).reason,'UNAVAILABLE');});
test('7B.1 architecture stays disconnected from active runtime entrypoints',async()=>{for(const file of ['server.ts','server/identity/router.ts','src/app/Root.tsx','src/utils/useFinanceData.ts']){const text=await readFile(file,'utf8');assert.equal(/(?:from\s*|import\s*\()['"][^'"]*ownership\//.test(text),false,file);}assert.equal((await readFile('server/identity/router.ts','utf8')).includes('financialAccess:false'),true);});
