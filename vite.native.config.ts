import {defineConfig,mergeConfig,type Plugin,type ConfigEnv,type UserConfig} from 'vite';
import webConfig from './vite.config';

const packagedPrototype:Plugin={
 name:'finanzas-native-prototype',
 transformIndexHtml(html){return html.replace('width=device-width, initial-scale=1.0','width=device-width, initial-scale=1.0, viewport-fit=cover').replace('<head>','<head>\n<meta name="finanzas-platform" content="native-prototype" />\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; font-src \'self\' data:; connect-src \'self\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'; frame-src \'none\'" />');},
 generateBundle(){this.emitFile({type:'asset',fileName:'finanzas-native-build.json',source:JSON.stringify({kind:'native-prototype',appId:'invalid.finanzas.prototype',financialPersistence:'debug-sandbox-opt-in',defaultFinanceMode:'disposable-session',realData:false,remoteBackend:false})+'\n'});},
};
export default defineConfig(async env=>mergeConfig(await (webConfig as (configEnv:ConfigEnv)=>UserConfig|Promise<UserConfig>)(env),{base:'/',define:{'import.meta.env.VITE_NATIVE_BUILD':JSON.stringify('true')},plugins:[packagedPrototype]}));
