import test from 'node:test';
import assert from 'node:assert/strict';
import {inventory,inventoryFile} from '../../scripts/i18n/inventory.mjs';
test('inventario AST: separa atributos, callbacks de error, claves e identificadores sin modificar las fuentes',()=>{
 const source=`export const View=()=> <button className="fixed" aria-label="Cerrar" onClick={()=>{setError('No se ha guardado.');setType('GASTO');}}>{t('common.close')}</button>`;
 const rows=inventoryFile('fixture.tsx',source);
 assert.equal(rows.find(row=>row.text==='Cerrar')?.classification,'visible-attribute');
 assert.equal(rows.find(row=>row.text==='No se ha guardado.')?.classification,'ui-message-candidate');
 assert.equal(rows.find(row=>row.text==='GASTO')?.classification,'attribute-internal');
 assert.equal(rows.find(row=>row.text==='common.close')?.classification,'translation-key');
 assert.equal(rows.find(row=>row.text==='fixed')?.classification,'attribute-internal');
});
test('inventario AST: recorre la aplicación y las fronteras API sin tratar el índice de recorrido como código fuente',()=>{
 const rows=inventory();assert.ok(rows.some(row=>row.file==='server.ts'));
 assert.ok(rows.some(row=>row.file==='src/App.tsx'&&row.classification==='translation-key'));
 assert.equal(rows.some(row=>/\.test\.tsx?$/.test(row.file)),false);
 assert.ok(rows.every(row=>typeof row.text==='string'&&row.line>0));
});
