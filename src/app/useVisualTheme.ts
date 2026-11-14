import {useCallback,useEffect,useLayoutEffect,useState} from 'react';
import {readThemePreference,THEME_KEY,visualTheme,writeThemePreference,type VisualTheme} from './themePreference';
/** UI-only state; no FinanceStore/update/mutate and no automatic migration of the backup theme. */
export function useVisualTheme(fallback:VisualTheme){
 const [theme,setTheme]=useState(()=>readThemePreference()??fallback),[preferenceError,setError]=useState(false);
 useLayoutEffect(()=>{setTheme(readThemePreference()??fallback);},[fallback]);
 useEffect(()=>{const sync=(event:StorageEvent)=>{
  if(event.key!==THEME_KEY&&event.key!==null)return;
  try{if(event.storageArea&&event.storageArea!==window.localStorage)return;}catch{return;}
  setTheme(visualTheme(event.newValue)??fallback);setError(false);
 };window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[fallback]);
 const toggleTheme=useCallback(()=>{const next=theme==='dark'?'light':'dark';setTheme(next);setError(!writeThemePreference(next));},[theme]);
 return {theme,toggleTheme,preferenceError};
}
