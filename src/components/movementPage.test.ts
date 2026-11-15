import test from 'node:test';
import assert from 'node:assert/strict';
import {movementPage,MOVEMENT_PAGE_SIZE} from './MovementPagination';
for(const count of [0,1,49,50,51,100,1000,5000])test(`5F: ${count} resultados íntegros en páginas sin omisiones ni repeticiones`,()=>{
 const indices:number[]=[];
 for(let p=0;p<Math.ceil(count/MOVEMENT_PAGE_SIZE);p++){
  const view=movementPage(count,p);assert.ok(view.end-view.start<=MOVEMENT_PAGE_SIZE);
  for(let i=view.start;i<view.end;i++)indices.push(i);
 }
 assert.deepEqual(indices,Array.from({length:count},(_,i)=>i));
 assert.deepEqual(movementPage(count,999,true),{...movementPage(count,999),start:0,end:count});
});
test('5F: página fuera de rango se ajusta al reducir resultados, sin cambiar datos',()=>{
 assert.deepEqual(movementPage(51,9),{page:1,pages:2,start:50,end:51});
 for(const invalid of [-5,NaN,Infinity])assert.deepEqual(movementPage(0,invalid),{page:0,pages:1,start:0,end:0});
 assert.equal(movementPage(5000,1.9).start,50);
});
