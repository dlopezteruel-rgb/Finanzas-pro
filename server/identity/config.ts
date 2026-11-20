import {applicationPaths} from '../../config/appPaths';
export type AuthConfig = ReturnType<typeof readAuthConfig>;
/** No environment names are exposed to the browser. Production remains product-blocked. */
export function readAuthConfig(env: Record<string,string|undefined>) {
  const paths=applicationPaths(env.APP_BASE_PATH), access=paths.home+'access', prefix=paths.home+'api/identity';
  const disabled={ready:false as const,access,prefix,reason:'unconfigured' as 'unconfigured'|'configuration'|'product-blocked'};
  if(env.AUTH0_ENABLED!=='true')return disabled;
  if(env.NODE_ENV==='production'||env.AUTH0_DEVELOPMENT_APPROVED!=='true')return {...disabled,reason:'product-blocked' as const};
  try {
    if(env.DEBUG?.trim())throw Error();
    const origin=new URL(env.AUTH0_BASE_URL!),issuer=new URL(env.AUTH0_ISSUER_BASE_URL!);
    if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||
      (origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(origin.hostname)))||
      issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.search||issuer.hash||issuer.pathname!=='/'||
      !/^[A-Za-z0-9_-]{8,256}$/.test(env.AUTH0_CLIENT_ID??'')||(env.AUTH0_CLIENT_SECRET??'').length<16||
      !/^[a-fA-F0-9]{64,128}$/.test(env.AUTH0_SESSION_SECRET??''))throw Error();
    const connection=(key:string)=>{const v=env[key];if(!v)return null;if(!/^[A-Za-z0-9_-]{1,100}$/.test(v))throw Error();return v;};
    const connections={email:connection('AUTH0_EMAIL_CONNECTION'),google:connection('AUTH0_GOOGLE_CONNECTION'),apple:connection('AUTH0_APPLE_CONNECTION')};
    if(!Object.values(connections).some(Boolean))throw Error();
    return {ready:true as const,access,prefix,origin:origin.origin,issuer:issuer.origin+'/',clientID:env.AUTH0_CLIENT_ID!,
      clientSecret:env.AUTH0_CLIENT_SECRET!,secret:env.AUTH0_SESSION_SECRET!,connections,secure:origin.protocol==='https:'};
  }catch{return {...disabled,reason:'configuration' as const};}
}
