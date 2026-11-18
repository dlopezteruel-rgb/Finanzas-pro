import {defineConfig,mergeConfig,type ConfigEnv,type UserConfig,type Plugin} from 'vite';
import nativeConfig from './vite.native.config';
// Diagnostic build is rejected by scripts/native/validate-build.mjs and must never be packaged.
export default defineConfig(async env=>mergeConfig(await (nativeConfig as (env:ConfigEnv)=>UserConfig|Promise<UserConfig>)(env),{
 define:{'import.meta.env.VITE_VAULT_TEST':JSON.stringify('true')},
 plugins:[{name:'browser-vault-test-marker',generateBundle(_options,bundle){for(const file of Object.values(bundle))if(file.type==='asset'&&file.fileName==='finanzas-native-build.json')file.source=JSON.stringify({kind:'native-prototype-test',realData:false,nativeRuntime:false});}} satisfies Plugin],
}));
