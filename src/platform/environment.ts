export type HostPlatform='web'|'android'|'ios'|'test'|'blocked';
type Bridge={getPlatform?:()=>string;isNativePlatform?:()=>boolean};
export function detectPlatform(nativeBuild:boolean,bridge?:Bridge):HostPlatform{
 try{
  if(bridge?.isNativePlatform?.()){
   const value=bridge.getPlatform?.();return value==='android'||value==='ios'?value:'blocked';
  }
  return nativeBuild?'test':'web';
 }catch{return 'blocked';}
}
export function hostPlatform(nativeBuild=import.meta.env?.VITE_NATIVE_BUILD==='true'){
 return detectPlatform(nativeBuild,typeof window==='undefined'?undefined:(window as Window&{Capacitor?:Bridge}).Capacitor);
}
export function installedContainer(){return !['web','test'].includes(hostPlatform(false));}
