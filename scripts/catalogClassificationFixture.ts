import {catalogReorderFixture} from './catalogReorderFixture';
import {editCatalog} from '../src/utils/budgetCatalog';
export function catalogClassificationFixture(theme:'light'|'dark'='light'){
  let d=catalogReorderFixture(theme);
  d=editCatalog(d,{kind:'updatePartida',parent:{type:'GASTO',code:'partida-ticket'},name:'Travesías propias',description:'Ejemplo ficticio',keywords:['kayak azul','senderismo']});
  for(const id of ['amb-a','amb-b'])d=editCatalog(d,{kind:'createPartida',groupCode:'family-travel',name:`Ambigua ${id}`,description:'',keywords:['ambigua'],id});
  return d;
}
