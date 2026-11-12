import {budgetSubitemFixture,demoParent} from './budgetSubitemFixture';
import {movementRule} from './intelligentFixture';
export function catalogArchiveFixture(monthly=true){
  const data=budgetSubitemFixture(monthly,monthly);
  const group=data.budgetGroups.find(g=>g.type==='GASTO')!;
  group.partidas.push({...group.partidas[0],code:'other',name:'Otra partida ficticia'});
  data.intelligentFinance={recurringRules:[
    movementRule({id:'active',code:demoParent.code,concept:'Periódico afectado'}),
    movementRule({id:'inactive',code:demoParent.code,concept:'Periódico inactivo',active:false}),
    movementRule({id:'retired',code:demoParent.code,concept:'Periódico retirado',active:false,deleted:true}),
    movementRule({id:'other',code:'other',concept:'Periódico de otra partida'}),
  ],occurrences:[],obligations:[]};
  data.planningAutomation={rules:[
    {id:'active',name:'Automatización afectada',target:'GASTO',code:demoParent.code,amountCents:100,frequency:'monthly',startMonth:'2026-12',active:true},
    {id:'inactive',name:'Automatización inactiva',target:'GASTO',code:demoParent.code,amountCents:100,frequency:'monthly',startMonth:'2026-12',active:false},
    {id:'other',name:'Automatización de otra partida',target:'GASTO',code:'other',amountCents:100,frequency:'monthly',startMonth:'2026-12',active:true},
    {id:'savings',name:'Ahorro independiente',target:'SAVINGS',amountCents:100,frequency:'monthly',startMonth:'2026-12',active:true},
  ],carryovers:[],origins:[],history:[]};
  return data;
}
