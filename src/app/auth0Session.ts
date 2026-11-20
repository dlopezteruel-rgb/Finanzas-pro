import type {SessionProjection,IdentityState} from '../identity/contracts';
export type AuthMethods={email:boolean;google:boolean;apple:boolean};
export type WebSession={status:'unconfigured'|'configuration'|'product-blocked'|'signed-out';methods:AuthMethods;financialAccess:false}|
 {status:'authenticated';methods:AuthMethods;financialAccess:false;emailVerified:boolean;session:SessionProjection};
export function parseWebSession(value:unknown):WebSession{
 const v=value as WebSession;if(!v||v.financialAccess!==false||!v.methods||(['email','google','apple'] as const).some(k=>typeof v.methods[k]!=='boolean'))throw Error('INVALID_SESSION');
 if(!['unconfigured','configuration','product-blocked','signed-out','authenticated'].includes(v.status))throw Error('INVALID_SESSION');
 if(v.status==='authenticated'){
  const s=v.session;if(!s||s.identity?.applicationSubject!==null||s.identity.method!=='unknown'||typeof s.identity.providerSubject!=='string'||!s.identity.providerSubject||
   !/^https:\/\/[^\s]+\/$/.test(s.identity.issuer)||typeof s.sessionReference!=='string'||typeof v.emailVerified!=='boolean'||
   ![s.issuedAtMs,s.authenticatedAtMs,s.expiresAtMs].every(Number.isFinite)||s.expiresAtMs<=s.issuedAtMs||s.authenticatedAtMs>s.issuedAtMs)throw Error('INVALID_SESSION');
 }
 // Return a whitelist; nothing from the response can authorize a financial profile.
 return v.status==='authenticated'?{status:v.status,financialAccess:false,methods:{email:v.methods.email,google:v.methods.google,apple:v.methods.apple},emailVerified:v.emailVerified,session:{identity:{applicationSubject:null,issuer:v.session.identity.issuer,providerSubject:v.session.identity.providerSubject,method:'unknown'},sessionReference:v.session.sessionReference,issuedAtMs:v.session.issuedAtMs,authenticatedAtMs:v.session.authenticatedAtMs,expiresAtMs:v.session.expiresAtMs}}:
 {status:v.status,financialAccess:false,methods:{email:v.methods.email,google:v.methods.google,apple:v.methods.apple}};
}
export function identityFromWebSession(value:WebSession,now=Date.now()):IdentityState{
 if(value.status!=='authenticated')return {status:'signed-out'};
 return value.session.expiresAtMs<=now?{status:'expired'}:{status:'authenticated',assurance:'auth0-bff',session:structuredClone(value.session)};
}
