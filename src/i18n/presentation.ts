import {languages,type Language} from './messages';
import {formatCurrency as legacyMoney} from '../utils/finance';
import {assertMonth} from '../utils/planningMoney';
import {realDate} from '../utils/financialCalendar';

type DateOptions=Omit<Intl.DateTimeFormatOptions,'timeZone'>;
const currencies=new Map<string,Intl.NumberFormat>();
function currency(language:Language,grouping=false){
 const key=`${language}:${grouping}`;let formatter=currencies.get(key);
 if(!formatter){formatter=new Intl.NumberFormat(languages[language].locale,{style:'currency',currency:'EUR',...(grouping?{useGrouping:true}:{})});currencies.set(key,formatter);}
 return formatter;
}
const dateOptions:DateOptions={year:'numeric',month:'long',day:'numeric'};

/** Existing 5A default is unchanged. The UI policy preserves its prior toFixed rounding. */
export function presentationMoney(amount:number,language?:Language):string;
export function presentationMoney(amount:number|null|undefined,language:Language,policy:'preserve-rounding'):string;
export function presentationMoney(amount:number|null|undefined,language:Language='es',policy?:'preserve-rounding'):string{
 if(!policy)return currency(language).format(amount as number);
 const value=amount===null||amount===undefined||Number.isNaN(amount)?0:amount;
 const fixed=Math.abs(value).toFixed(2),match=/^(\d+)\.(\d{2})$/.exec(fixed);
 // Malformed/non-finite diagnostics retain their prior representation. Valid money never enters here.
 if(!match)return legacyMoney(value);
 return exactParts(BigInt(match[1]),match[2],value<0,language);
}
function exactParts(units:bigint,fraction:string,negative:boolean,language:Language):string{
 const signed=negative?(units===0n?-0:-units):units;
 return currency(language,language==='es').formatToParts(signed).map(part=>part.type==='fraction'?fraction:language==='es'&&part.type==='literal'?' ':part.value).join('');
}
/** Cents remain integers throughout; dividing a large safe integer by 100 can lose a cent. */
export function presentationCents(cents:number,language:Language='es'):string{
 if(!Number.isSafeInteger(cents))throw new RangeError('Expected safe integer cents for presentation.');
 const value=BigInt(cents),absolute=value<0n?-value:value;
 return exactParts(absolute/100n,String(absolute%100n).padStart(2,'0'),value<0n,language);
}
/** 5A Madrid default, also reused by date-only, timestamp and month presentation. */
export const presentationDate=(date:Date,language:Language='es',options:DateOptions=dateOptions)=>new Intl.DateTimeFormat(languages[language].locale,{...options,timeZone:'Europe/Madrid'}).format(date);
export function presentationISODate(value:string,language:Language='es',options:DateOptions=dateOptions):string{
 // Noon preserves a calendar date even with Madrid's historical pre-1901 offset.
 const calendar=realDate(value),instant=realDate(value.slice(0,10))&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
 if(!calendar&&!instant)return value;
 const date=new Date(calendar?`${value}T12:00:00Z`:value);
 if(!Number.isFinite(date.getTime()))return value;
 let effective=options;
 if(calendar){
  effective={...options};
  const clockFields:readonly (keyof DateOptions)[]=['hour','minute','second','timeStyle','timeZoneName','hour12','hourCycle','dayPeriod','fractionalSecondDigits'];
  for(const field of clockFields)delete effective[field];
  if(!['year','month','day','weekday','dateStyle'].some(field=>Object.hasOwn(effective,field)))effective={...effective,...dateOptions};
 }
 return presentationDate(date,language,effective);
}
export function presentationMonth(month:string,language:Language='es',short=false):string{
 assertMonth(month);
 const date=new Date(`${month}-15T12:00:00Z`),options:DateOptions={month:short&&language!=='es'?'short':'long',year:'numeric'};
 return new Intl.DateTimeFormat(languages[language].locale,{...options,timeZone:'Europe/Madrid'}).formatToParts(date).map(part=>{
  if(part.type==='year')return month.slice(0,4);
  if(part.type==='month'&&short&&language==='es')return part.value.slice(0,3);
  if(part.type==='literal'&&language==='es')return part.value.replace(/\bde\b/g,'').replace(/\s+/g,' ');
  return part.value;
 }).join('');
}
export function presentationMonthName(month:number,language:Language='es'):string{
 if(!Number.isInteger(month)||month<1||month>12)throw new RangeError('Expected calendar month 1–12.');
 return presentationDate(new Date(`2000-${String(month).padStart(2,'0')}-15T12:00:00Z`),language,{month:'long'});
}
const percentages=new Map<Language,Intl.NumberFormat>(),compactCurrencies=new Map<Language,Intl.NumberFormat>();
export function presentationPercentage(value:number,language:Language='es'):string{
 let formatter=percentages.get(language);if(!formatter){formatter=new Intl.NumberFormat(languages[language].locale,{style:'unit',unit:'percent',minimumFractionDigits:1,maximumFractionDigits:1});percentages.set(language,formatter);}
 const fixed=Math.abs(value).toFixed(1),match=/^(\d+)\.(\d)$/.exec(fixed);if(!match)return formatter.format(value);
 const units=BigInt(match[1]),signed=value<0?(units===0n?-0:-units):units;
 return formatter.formatToParts(signed).map(part=>part.type==='fraction'?match[2]:part.value).join('');
}
export function presentationCompactMoney(value:number,language:Language='es'):string{
 let formatter=compactCurrencies.get(language);if(!formatter){formatter=new Intl.NumberFormat(languages[language].locale,{style:'currency',currency:'EUR',notation:'compact',minimumFractionDigits:0,maximumFractionDigits:1});compactCurrencies.set(language,formatter);}
 return formatter.format(value);
}
export function presentationFormatters(language:Language){
 return {
  formatNumber:(value:number)=>new Intl.NumberFormat(languages[language].locale).format(value),
  formatPercent:(value:number)=>presentationPercentage(value,language),
  formatCompactMoney:(value:number)=>presentationCompactMoney(value,language),
  formatMoney:(amount:number|null|undefined)=>presentationMoney(amount,language,'preserve-rounding'),
  formatCents:(cents:number)=>presentationCents(cents,language),
  formatDate:(value:string|Date|null|undefined,options?:DateOptions)=>value===null||value===undefined?'':typeof value==='string'?presentationISODate(value,language,options):Number.isFinite(value.getTime())?presentationDate(value,language,options):String(value),
  formatMonth:(month:string,short=false)=>presentationMonth(month,language,short),
  monthName:(month:number)=>presentationMonthName(month,language),
 };
}
