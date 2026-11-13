import {intelligentFixture,movementRule,personalObligation} from './intelligentFixture';
import {savePlanning,planningScope} from '../src/utils/planning';
import {saveMovementRule} from '../src/utils/recurringMovements';
import {saveObligation} from '../src/utils/personalObligations';
import {financialAssistantContext} from '../src/utils/financialAssistant';
export function translatedAssistantFixture(){
 let data=intelligentFixture();data=savePlanning(data,'2026-11',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:250000}],60000,planningScope(data,'2026-11'),true,true);
 data.planningMonths!.find(m=>m.monthYear==='2026-11')!.approval!.approvedAt='2026-11-10T12:00:00.000Z';
 data=saveMovementRule(data,movementRule({day:15}));data=saveObligation(data,personalObligation());return data;
}
export const assistantQueries=['¿Cuánto tengo realmente disponible?','¿Qué pagos se aproximan?','¿Qué parte viene arrastrada?','¿Qué partidas están en alerta?','¿Qué gastos puedo reducir para ahorrar 150 € más?','¿Cómo ahorrar 600 €?','¿Cómo ahorrar 1.500,00 €?','¿Cómo ahorrar 1.500 €?','¿Cómo ahorrar 99999999999999999999 €?','¿Cómo distribuir mis ingresos?','Resumen de mis préstamos y deudas','Consejos generales de organización'];
export function assistantContexts(){
 const data=translatedAssistantFixture(),standard=financialAssistantContext(data,'2026-11','2026-11-10');standard.partidas[0].name='Nombre personal {amount}$&';
 const exceeded=structuredClone(standard);exceeded.partidas.filter(r=>r.type==='GASTO').forEach(r=>{r.carryCents=1000;r.effectiveCents=r.baseCents+1000;r.executedCents=r.effectiveCents+100;r.pendingCents=1234;r.remainingCents=-100;});
 const manyFlows=structuredClone(standard);manyFlows.treasury.events=Array.from({length:61},(_,i)=>({date:'2026-11-15',source:(['pending','recurring','personal','loan'] as const)[i%4],certainty:'estimated' as const,amountCents:1234}));
 const unsafe=structuredClone(standard);unsafe.totals.savings=1.5;
 return {data,contexts:{standard,exceeded,manyFlows,unsafe,empty:financialAssistantContext(data,'2029-02','2026-11-10')}};
}
