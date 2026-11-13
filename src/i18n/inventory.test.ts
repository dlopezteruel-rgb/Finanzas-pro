import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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

test('inventario AST: reconoce la presentación opcional sin ocultar texto arbitrario del servicio',()=>{
 const source=`export function advice(ui) {return ui?.text('assistant.advice.prefix',{month:'2026-11'})??'Datos guardados';} export function remote(response){return response.text('Contenido remoto');}`;
 const rows=inventoryFile('fixture.ts',source);
 assert.equal(rows.find(row=>row.text==='assistant.advice.prefix')?.classification,'translation-key');
 assert.equal(rows.find(row=>row.text==='Datos guardados')?.classification,'review');
 assert.equal(rows.find(row=>row.text==='Contenido remoto')?.classification,'review');
});

test('inventario AST: incluye rechazos mediante SaveResult, fail y check sin confundir sus condiciones',()=>{
 const source=`const rejection={ok:false,error:'Selecciona una cuenta.'};fail('Revisa la categoría.');check(type==='GASTO','No se permite cambiar el tipo.');`;
 const rows=inventoryFile('fixture.ts',source);
 for(const text of ['Selecciona una cuenta.','Revisa la categoría.','No se permite cambiar el tipo.'])assert.equal(rows.find(row=>row.text===text)?.classification,'ui-message-candidate');
 assert.equal(rows.find(row=>row.text==='GASTO')?.classification,'review');
});

test('inventario AST: registra ejemplos numéricos y símbolos visibles, conservando los valores internos',()=>{
 const rows=inventoryFile('fixture.tsx',`const View=()=> <><input placeholder="0,00" value="0"/><button aria-label="Cerrar">→</button></>`);
 assert.equal(rows.find(row=>row.text==='0,00')?.classification,'visible-attribute');
 assert.equal(rows.find(row=>row.text==='→')?.classification,'visible-text');
 assert.equal(rows.some(row=>row.text==='0'&&row.classification==='visible-attribute'),false);
});

test('inventario AST: los literales dentro de expresiones JSX también son superficies visibles',()=>{
 const rows=inventoryFile('fixture.tsx',`const View=()=> <><span>{'Texto visible'}</span><span>{'→'}</span></>`);
 for(const text of ['Texto visible','→'])assert.equal(rows.find(row=>row.text===text)?.classification,'visible-text');
});

test('inventario publicado: fuentes vigentes y excepciones visibles revisadas una a una',()=>{
 const report=JSON.parse(readFileSync('docs/phase-5b-inventory.json','utf8'));
 const rows=inventory(),counts=rows.reduce<Record<string,number>>((all,row)=>(all[row.classification]=(all[row.classification]??0)+1,all),{});
 assert.deepEqual(report.currentCounts,counts);
 for(const file of report.files)assert.equal(file.sourceSha256,createHash('sha256').update(readFileSync(file.file)).digest('hex'),`${file.file}: regenerate and review the inventory after changing its source`);
 assert.equal(report.visibleLiterals.length,rows.filter(row=>['visible-text','visible-attribute'].includes(row.classification)).length);
 for(const row of report.visibleLiterals)assert.notEqual(row.decision,'PENDING',`${row.file}:${row.line}: ${row.text}`);
});
