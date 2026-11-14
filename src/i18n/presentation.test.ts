import test from 'node:test';
import assert from 'node:assert/strict';
import {presentationMoney,presentationCents,presentationISODate,presentationMonth,presentationMonthName,presentationFormatters} from './presentation';
import {languages,type Language} from './messages';
import {formatCurrency} from '../utils/finance';
import {formatPlanningCents,parsePlanningMoney} from '../utils/planningMoney';
import {monthLabel,MONTH_NAMES} from '../utils/financialCalendar';
const maximum={es:'90.071.992.547.409,91 €',en:'€90,071,992,547,409.91',it:'90.071.992.547.409,91\u00a0€',fr:'90\u202f071\u202f992\u202f547\u202f409,91\u00a0€',pt:'90\u00a0071\u00a0992\u00a0547\u00a0409,91\u00a0€'};
for(const language of Object.keys(languages) as Language[])test(`Intl ${language}: céntimos máximos exactos, signo, EUR y parámetros financieros intactos`,()=>{
 const cents=Number.MAX_SAFE_INTEGER,raw={amountCents:cents,date:'2026-11-30'},before=JSON.stringify(raw),format=presentationFormatters(language);
 assert.equal(presentationCents(cents,language),maximum[language]);assert.equal(format.formatCents(cents-1),maximum[language].replace(/91(?=[^\d]*$)/,'90'));
 const negative=language==='en'?'-'+maximum.en:'-'+maximum[language];assert.equal(format.formatCents(-cents),negative);
 assert.equal(format.formatCents(123456),format.formatMoney(1234.56));assert.ok(format.formatCents(0).includes('€'));assert.equal(format.formatCents(-0),format.formatCents(0));
 assert.equal(parsePlanningMoney('1234.56'),123456);assert.equal(JSON.stringify(raw),before);assert.equal(raw.amountCents,cents);
 assert.throws(()=>presentationCents(1.5,language),RangeError);assert.throws(()=>presentationCents(Number.MAX_SAFE_INTEGER+1,language),RangeError);
});
test('Intl español: conserva redondeo y representación anteriores sin cambiar utilidades financieras',()=>{
 const format=presentationFormatters('es');
 for(const value of [null,undefined,NaN,0,-0,0.001,-0.001,1.005,1.015,1.235,9.995,1234.56,-1234.56,999999999.99,Number.MAX_SAFE_INTEGER/100])assert.equal(format.formatMoney(value),formatCurrency(value),String(value));
 for(const cents of [0,1,-1,123456,-123456,Number.MAX_SAFE_INTEGER,-Number.MAX_SAFE_INTEGER])assert.equal(format.formatCents(cents),formatPlanningCents(cents));
 assert.equal(presentationMoney(1.005,'en','preserve-rounding'),'€1.00');assert.equal(presentationMoney(1.005,'en'),'€1.01','the existing 5A default remains standard Intl');
});
test('Intl calendario: fechas ISO antiguas conservan el día y los instantes se presentan en Madrid',()=>{
 for(const language of Object.keys(languages) as Language[]){
  const date='0001-01-01';assert.equal(presentationISODate(date,language,{day:'2-digit',month:'2-digit',year:'numeric'}).includes('01'),true);assert.equal(date,'0001-01-01');
  const actual=presentationISODate('0001-01-01',language,{day:'numeric',month:'long',year:'numeric'}),expected=new Intl.DateTimeFormat(languages[language].locale,{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date('0001-01-01T12:00:00Z'));assert.equal(actual,expected);
  assert.equal(presentationISODate('2026-02-31',language),'2026-02-31');assert.equal(presentationISODate('2026-02-31T12:00:00Z',language),'2026-02-31T12:00:00Z');assert.equal(presentationISODate('texto personal <fecha>',language),'texto personal <fecha>');
 }
 assert.equal(presentationISODate('2026-11-30T23:30:00Z','en'),'1 December 2026');assert.equal(presentationISODate('2026-03-29T01:30:00Z','en',{hour:'2-digit',minute:'2-digit'}),'03:30');
 const options={year:'numeric' as const,month:'long' as const,day:'numeric' as const,timeZone:'UTC'};
 assert.equal(presentationFormatters('en').formatDate('2026-11-30T23:30:00Z',options),'1 December 2026','presentation cannot override Madrid');
});
test('Intl meses: conserva exactamente etiquetas españolas, años ISO y valores de selector',()=>{
 for(const year of ['0001','1900','2026','9999'])for(let number=1;number<=12;number++){
  const month=`${year}-${String(number).padStart(2,'0')}`;for(const short of [false,true])assert.equal(presentationMonth(month,'es',short),monthLabel(month,short));
  assert.equal(presentationMonthName(number,'es'),MONTH_NAMES[number-1]);assert.equal(month,`${year}-${String(number).padStart(2,'0')}`);
 }
 assert.equal(presentationMonth('2026-11','en'),'November 2026');assert.equal(presentationMonthName(11,'fr'),'novembre');assert.equal(presentationMonthName(11,'it'),'novembre');assert.equal(presentationMonthName(11,'pt'),'novembro');
});

test('Intl no inventa una hora para metadatos históricos que solo contienen fecha',()=>{
 const options={year:'numeric' as const,month:'numeric' as const,day:'numeric' as const,hour:'numeric' as const,minute:'numeric' as const,second:'numeric' as const},before=JSON.stringify(options);
 assert.equal(presentationISODate('2026-11-03','en',options),'03/11/2026');assert.equal(presentationISODate('2026-11-03T12:00:00Z','en',options),'03/11/2026, 13:00:00');assert.equal(JSON.stringify(options),before);
});
