import {LANGUAGE_KEY} from '../../i18n/preference';
import {activeLanguage} from '../../i18n/messages';
import {THEME_KEY,visualTheme} from '../../app/themePreference';

export type PreferenceDriver={get:(options:{key:string})=>Promise<{value:string|null}>;set:(options:{key:string;value:string})=>Promise<void>};
type LocalPreferences=Pick<Storage,'setItem'>;
export async function hydrateVisualPreferences(driver:PreferenceDriver,local:LocalPreferences){
 const [language,theme]=await Promise.all([driver.get({key:LANGUAGE_KEY}),driver.get({key:THEME_KEY})]);
 if(language.value!==null)local.setItem(LANGUAGE_KEY,activeLanguage(language.value));
 if(theme.value!==null&&visualTheme(theme.value))local.setItem(THEME_KEY,theme.value);
}
/** Two small UI values only. Awaited, serialized and never a finance adapter. */
export function visualPreferenceWriter(driver:PreferenceDriver){
 let tail=Promise.resolve();
 return (language:string,theme:string)=>{
  if(activeLanguage(language)!==language||!visualTheme(theme))return Promise.reject(Error('VISUAL_PREFERENCE_INVALID'));
  const next=tail.catch(()=>{}).then(async()=>{await driver.set({key:LANGUAGE_KEY,value:language});await driver.set({key:THEME_KEY,value:theme});});
  tail=next;return next;
 };
}
