import {budgetSubitemFixture,demoParent} from './budgetSubitemFixture';
import {editCatalog,catalogEntry} from '../src/utils/budgetCatalog';
export function catalogReorderFixture(theme:'light'|'dark'='light'){
  let data=budgetSubitemFixture(true,true);data={...data,theme};
  data=editCatalog(data,{kind:'createFamily',type:'GASTO',name:'Viajes ficticios',id:'travel'});
  data=editCatalog(data,{kind:'createPartida',groupCode:catalogEntry(data,demoParent).group!.code,name:'Comida ficticia',description:'',keywords:['comida'],id:'food'});
  return editCatalog(data,{kind:'createPartida',groupCode:'family-travel',name:'Billetes ficticios',description:'',keywords:['billete'],id:'ticket'});
}
