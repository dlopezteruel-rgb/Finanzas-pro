import {addDays,madridDate,MONTH_NAMES,realDate} from './financialCalendar';
import {classifyChatIntent,isExplicitFinancialQuery} from './registrationIntent';

type InputResult={ok:true;amount:number;date:string}|{ok:false;error:string};
/** Reject uncertainty; this does not infer additional amounts, dates, currencies or intent. */
export function readNaturalInput(text:string,referenceDate=new Date()):InputResult{
  const fail=(error:string):InputResult=>({ok:false,error});
  const lower=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  if(!lower)return fail('');
  if(classifyChatIntent(text)==='negation')return fail('Una negación no prepara movimientos. Utiliza una instrucción afirmativa o el formulario manual.');
  if(isExplicitFinancialQuery(text))return fail('Una pregunta no prepara movimientos. Utiliza el asistente para consultar.');
  if(!Number.isFinite(referenceDate.getTime()))return fail('La fecha de referencia no es válida. Utiliza el formulario manual.');
  const today=madridDate(referenceDate);
  const explicit=[...lower.matchAll(/\bel\s+(?:dia\s+)?\d+(?:\/\d+){0,2}\b/g)];
  const relatives=lower.match(/\b(?:antes de ayer|anteayer|ayer|hoy)\b/g)??[];
  if(explicit.length+relatives.length>1)return fail('Hay varias referencias de fecha. Indica una sola o utiliza el formulario manual.');
  let date=today,amountText=lower;
  if(explicit.length){
    const mention=explicit[0][0],parts=mention.replace(/^el\s+(?:dia\s+)?/,'').split('/');
    if(parts.length>2)return fail('Indica la fecha con año en el formulario manual.');
    date=`${today.slice(0,4)}-${parts[1]?.padStart(2,'0')??today.slice(5,7)}-${parts[0].padStart(2,'0')}`;
    if(!realDate(date))return fail('La fecha indicada no existe. Corrígela o utiliza el formulario manual.');
    amountText=lower.replace(mention,' ');
  }else if(relatives.length){
    date=addDays(today,relatives[0]==='hoy'?0:relatives[0]==='ayer'?-1:-2);
  }
  const unsupportedDate=new RegExp(`\\b(?:manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|${MONTH_NAMES.join('|')})\\b`);
  if(/\d+\/\d+|\d{4}-\d{2}-\d{2}/.test(amountText)||unsupportedDate.test(amountText))return fail('La fecha no es inequívoca para este registro. Utiliza el formulario manual.');
  if(/[$£¥]|\b(?:usd|gbp|dolares|libras)\b/.test(amountText))return fail('Este registro utiliza euros. Revisa el importe en el formulario manual.');
  const numbers=[...amountText.matchAll(/[+-]?\d+(?:[.,]\d+)*(?:e[+-]?\d+)?/g)];
  if(numbers.length!==1)return fail('Indica un único importe positivo, sin separadores de miles, o utiliza el formulario manual.');
  const number=numbers[0],token=number[0],prefix=amountText.slice(0,number.index),suffix=amountText.slice(number.index!+token.length);
  if(!/^\d+(?:[.,]\d{1,2})?$/.test(token)||/[\w.,]$/.test(prefix)||(/^[a-z]/.test(suffix)&&!/^euros?\b|^eur\b/.test(suffix)))return fail('El importe es ambiguo o negativo. Usa, por ejemplo, 2650 o 15,50; también puedes utilizar el formulario manual.');
  const amount=Number(token.replace(',','.')),cents=Math.round(amount*100);
  if(!Number.isSafeInteger(cents)||cents<=0)return fail('El importe debe ser positivo y representable en céntimos. Utiliza el formulario manual.');
  return {ok:true,amount:cents/100,date};
}
export function naturalInputIssue(text:string,referenceDate=new Date()):string|null{
  const result=readNaturalInput(text,referenceDate);return result.ok?null:result.error;
}
