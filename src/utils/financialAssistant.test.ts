import test from 'node:test';
import assert from 'node:assert/strict';
import { intelligentFixture as fixture,personalObligation as obligation,movementRule as rule } from '../../scripts/intelligentFixture';
import { financialAssistantContext,localFinancialAdvice,assistantServiceContext } from './financialAssistant';
import { savePlanning,planningScope } from './planning';
import { saveMovementRule } from './recurringMovements';
import { saveObligation } from './personalObligations';
import { classifyChatIntent,proposeChatMovement } from './chatRegistration';
import { obligationOverview } from './personalObligations';
import { INITIAL_TRANSACTIONS,INITIAL_LOANS,INITIAL_WALLETS,INITIAL_CONTACTS,INITIAL_BUDGET_PLANS } from './seedData';
import { BUDGET_GROUPS } from '../constants/categories';

test('5E: contexto trazable distingue aprobación, bases, pendientes propios, banco y compromiso',()=>{
  let d=fixture();d=savePlanning(d,'2026-11',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:250000}],60000,planningScope(d,'2026-11'),true,true);
  d=savePlanning(d,'2026-11',[{type:'GASTO',code:'g',amountCents:260000}],60000,planningScope(d,'2026-11'));
  d=saveObligation(d,obligation());d=saveMovementRule(d,rule({day:15}));
  d.transactions=[{id:'past',date:'2026-11-05',type:'GASTO',code:'g',categoryName:'G',subcategoryName:'Alquiler ficticio',amount:2700,description:'Gasto ficticio',wallet:'BANCO FICTICIO',processed:true},{id:'pending',date:'2026-11-15',type:'GASTO',code:'g',categoryName:'G',subcategoryName:'Alquiler ficticio',amount:20,description:'Pendiente ficticio',wallet:'BANCO FICTICIO',processed:false}];
  const before=JSON.stringify(d),c=financialAssistantContext(d,'2026-11','2026-11-10');assert.equal(c.approval!.current,false);assert.equal(c.obligations.receivableCents,20000);assert.equal(c.partidas.find(r=>r.code==='g')!.pendingCents,2000);
  for(const q of ['¿Qué partidas están sobrepasando mi presupuesto?','¿Cuánto tengo realmente disponible?','¿Qué pagos se aproximan?','¿Cómo puedo distribuir mejor mis ingresos?','¿Qué gastos puedo reducir para ahorrar 150 € más?','¿Qué parte viene arrastrada?']){assert.equal(classifyChatIntent(q),'query');assert.ok(localFinancialAdvice(c,q));assert.equal(proposeChatMovement(q,d.wallets,d.budgetGroups.flatMap(g=>g.partidas)),null)}
  assert.match(localFinancialAdvice(c,'¿Qué partidas exceden el presupuesto?')!,/2\.700,00/);assert.match(localFinancialAdvice(c,'¿Qué pagos se aproximan?')!,/200,00/);assert.match(localFinancialAdvice(c,'¿Cuánto tengo disponible?')!,/-1\.700,00/);assert.equal(JSON.stringify(d),before);
});
test('5E: ahorro calculado desde partidas, no recomienda recortar gasto ya ejecutado ni inventa ingresos',()=>{
  let d=fixture();d=savePlanning(d,'2026-11',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:250000}],60000,planningScope(d,'2026-11'));
  const c=financialAssistantContext(d,'2026-11','2026-11-10');
  assert.match(localFinancialAdvice(c,'¿Cómo llegar a ahorrar 600 €?')!,/reducción necesaria.*100,00/);assert.match(localFinancialAdvice(c,'¿Qué gastos reducir para ahorrar 150 € más?')!,/reducir hasta 150,00/);
  const empty=financialAssistantContext(fixture(),'2029-02','2026-11-10');assert.match(localFinancialAdvice(empty,'¿Cómo ahorrar 600 €?')!,/No hay ingresos previstos/);assert.equal(localFinancialAdvice(empty,'Consejos generales de organización'),null);
});
test('5E: payload mínimo del endpoint existente no contiene contrapartes, contactos, carteras ni movimientos',()=>{
  const d=saveObligation(fixture(),obligation());const c=financialAssistantContext(d,'2026-11','2026-11-10'),payload=JSON.stringify(assistantServiceContext(c));
  assert.equal(payload.includes('Amistad ficticia'),false);assert.equal(payload.includes('BANCO FICTICIO'),false);assert.equal(payload.includes('Préstamo personal ficticio'),false);assert.equal(payload.includes('transactions'),false);assert.ok(payload.includes('receivableCents'));
});
test('5: adaptadores de lectura admiten cuotas históricas sin errores de multiplicación flotante',()=>{
  const d={theme:'dark' as const,transactions:INITIAL_TRANSACTIONS,loans:INITIAL_LOANS,wallets:INITIAL_WALLETS,contacts:INITIAL_CONTACTS,budgetPlans:INITIAL_BUDGET_PLANS,budgetGroups:BUDGET_GROUPS};
  assert.doesNotThrow(()=>obligationOverview(d,'2026-11-10'));assert.doesNotThrow(()=>financialAssistantContext(d,'2026-11','2026-11-10'));
});
