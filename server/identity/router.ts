import express,{type Request,type Response,type NextFunction} from 'express';
import {auth,type ConfigParams} from 'express-openid-connect';
import {randomUUID} from 'node:crypto';
import type {AuthConfig} from './config';
const expectedKey=Symbol('reauth-subject');
const locales:Record<string,string>={es:'es',en:'en',it:'it',fr:'fr',pt:'pt-PT'};
export function createIdentityRouter(config:AuthConfig, transport?:ConfigParams['customFetch']){
 const router=express.Router(),p=config.prefix;
 router.use((req,res,next)=>{if(req.path===p||req.path.startsWith(p+'/')){res.set({'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});}next();});
 if(!config.ready){
  router.get(p+'/session',(_req,res)=>res.json({status:config.reason,methods:{email:false,google:false,apple:false},financialAccess:false}));
  router.all(p+'/*',(_req,res)=>res.status(503).json({error:'AUTH_UNAVAILABLE'}));return router;
 }
 const COOKIE=config.secure?'__Host-finanzasAuth':'finanzasAuth';
 const validClaims=(req:Request)=>{const c=req.oidc.idTokenClaims;return c&&c.iss===config.issuer&&(Array.isArray(c.aud)?c.aud.includes(config.clientID):c.aud===config.clientID)?c:undefined;};
 const clear=(req:Request)=>{(req as unknown as Record<string,unknown>)[COOKIE]=null;};
 const sameOrigin=(req:Request,res:Response,next:NextFunction)=>{
  if(req.method!=='POST')return next();
  if(req.headers.origin!==config.origin||req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return res.status(403).json({error:'REQUEST_REJECTED'});
  if(!req.is('application/x-www-form-urlencoded'))return res.status(415).json({error:'REQUEST_REJECTED'});
  next();
 };
 router.use(p,sameOrigin);
 router.use(p,express.urlencoded({extended:false,limit:'2kb'}));
 const sdkConfig:ConfigParams={customFetch:transport,authRequired:false,auth0Logout:true,attemptSilentLogin:false,enableTelemetry:false,
  issuerBaseURL:config.issuer,baseURL:config.origin,clientID:config.clientID,clientSecret:config.clientSecret,secret:config.secret,
  getLoginState:req=>({returnTo:config.access,...((req as Request&{[expectedKey]?:string})[expectedKey]?{expectedSubject:(req as Request&{[expectedKey]?:string})[expectedKey]}:{})}),
  authorizationParams:{response_type:'code',response_mode:'query',scope:'openid profile email'},
  routes:{login:false,logout:false,callback:p+'/callback',postLogoutRedirect:config.access},
  session:{name:COOKIE,rolling:false,absoluteDuration:900,cookie:{httpOnly:true,secure:config.secure,sameSite:'Lax',path:'/',transient:true}},
  transactionCookie:{sameSite:'Lax'},legacySameSiteCookie:false,httpTimeout:5000,clockTolerance:5,
  afterCallback:async(req,_res,session,state)=>{
   const c=req.oidc.idTokenClaims;
   if(!c||c.iss!==config.issuer||typeof c.sub!=='string'||!c.sub||!Number.isFinite(c.exp)||!Number.isFinite(c.iat))throw Error('INVALID_IDENTITY');
   if(state.expectedSubject&&(c.sub!==state.expectedSubject||!Number.isFinite(c.auth_time)||Date.now()/1000-Number(c.auth_time)>60))throw Error('REAUTH_IDENTITY_MISMATCH');
   // No API access/refresh token is needed for this identity-only surface.
   const providerCeiling=typeof session.sessionExpiresAt==='number'?session.sessionExpiresAt*1000-30000:Infinity;
   return {id_token:session.id_token,access_token:'',refresh_token:'',token_type:'',expires_at:'',sid:session.sid,
    ...(session.sessionExpiresAt!==undefined?{sessionExpiresAt:session.sessionExpiresAt}:{}),
    reference:randomUUID(),deadline:Math.min(Number(c.exp)*1000,Date.now()+900000,providerCeiling)};
  }};
 const sdk=auth(sdkConfig);
 router.use((req,res,next)=>req.path.startsWith(p+'/')?sdk(req,res,next):next());
 router.get(p+'/session',(req,res)=>{
  const c=validClaims(req),s=(req as unknown as Record<string,any>)[COOKIE];
  const methods={email:!!config.connections.email,google:!!config.connections.google,apple:!!config.connections.apple};
  if(!c||!req.oidc.isAuthenticated()||!s||!(s.deadline>Date.now())){clear(req);return res.json({status:'signed-out',methods,financialAccess:false});}
  return res.json({status:'authenticated',methods,financialAccess:false,emailVerified:c.email_verified===true,
   session:{identity:{applicationSubject:null,issuer:config.issuer,providerSubject:c.sub,method:'unknown'},
    sessionReference:s.reference,issuedAtMs:Number(c.iat)*1000,authenticatedAtMs:Number(c.auth_time??c.iat)*1000,expiresAtMs:s.deadline}});
 });
 router.post(p+'/login',async(req,res,next)=>{
  try{
   const method=req.body.method,action=req.body.action??'login';
   if(!['email','google','apple'].includes(method)||!['login','signup','recover','reauth'].includes(action))return res.status(400).json({error:'REQUEST_REJECTED'});
   const connection=config.connections[method as keyof typeof config.connections];
   if(!connection)return res.status(409).json({error:'METHOD_UNAVAILABLE'});
   if(['signup','recover'].includes(action)&&method!=='email')return res.status(400).json({error:'REQUEST_REJECTED'});
   const expected=action==='reauth'&&((req as unknown as Record<string,any>)[COOKIE]?.deadline??0)>Date.now()?validClaims(req)?.sub:null;
   if(action==='reauth'&&!expected)return res.status(401).json({error:'SESSION_REQUIRED'});
   if(expected)(req as Request&{[expectedKey]?:string})[expectedKey]=expected;
   clear(req);
   await res.oidc.login({returnTo:config.access,authorizationParams:{connection,ui_locales:locales[req.body.language]??'es',
    prompt:'login',max_age:0,...(action==='signup'?{screen_hint:'signup'}:{})}});
  }catch(e){next(e);}
 });
 router.post(p+'/logout',async(req,res,next)=>{try{await res.oidc.logout({returnTo:config.origin+config.access});}catch(e){clear(req);next(e);}});
 router.all(p+'/*',(_req,res)=>res.status(404).json({error:'REQUEST_REJECTED'}));
 // Never serialize provider descriptions, codes, tokens or query strings to logs/UI.
 router.use((_:unknown,_req:Request,res:Response,_next:NextFunction)=>{res.redirect(303,config.access+'?authError=provider');});
 return router;
}
