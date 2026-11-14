import {makeBackup,parseBackup} from '../../src/utils/backup';
import {multilingualCatalogFixture} from '../multilingualCatalogFixture';
const base=multilingualCatalogFixture();
/** Preserve the original synthetic linked graph and append independent, validator-approved records. */
export function volumeFixture(count:number){
 const data=structuredClone(base),original=data.transactions.find(tx=>tx.id==='income')!;
 while(data.transactions.length<count){const n=data.transactions.length;data.transactions.push({...original,id:`volume-${n}`,type:n%4?'GASTO':'INGRESO',code:n%4?'V.001.002':'L.001.001',amount:(n%10000+1)/100,date:`2026-${n%2?'10':'11'}-${String(n%28+1).padStart(2,'0')}`,description:`Synthetic volume ${n} ${n%10===0?'needle':''}`,categoryName:'Documento ficticio',subcategoryName:'Nombre documental',processed:n%3!==0});}
 for(const monthYear of ['2025-01','2025-06','2025-12','2026-01','2026-06','2027-01','2027-06','2027-12'])data.budgetPlans.push({monthYear,type:'GASTO',code:'F.001.001',plannedAmount:123.45});
 for(const m of data.planningMonths??[])if(m.approval)m.approval.approvedAt='2026-11-14T12:00:00.000Z';
 const backup={...makeBackup(data),exportedAt:'2026-11-14T12:00:00.000Z'};parseBackup(JSON.stringify(backup));return backup;
}
