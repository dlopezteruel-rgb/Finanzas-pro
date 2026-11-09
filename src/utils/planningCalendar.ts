import { assertMonth } from './planningMoney';
export function monthNumber(month:string) { assertMonth(month); const [y,m]=month.split('-').map(Number);return y*12+m-1; }
export function nextMonth(month:string) { const index=monthNumber(month)+1;const result=`${Math.floor(index/12).toString().padStart(4,'0')}-${String(index%12+1).padStart(2,'0')}`;assertMonth(result);return result; }
export function planningRange(first:string,last:string) {const start=monthNumber(first),end=monthNumber(last);if(end<start || end-start>=12)throw new Error('Selecciona entre 1 y 12 meses consecutivos.');return Array.from({length:end-start+1},(_,i)=>`${Math.floor((start+i)/12).toString().padStart(4,'0')}-${String((start+i)%12+1).padStart(2,'0')}`);}
export const temporalMonth=(date=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(date);
