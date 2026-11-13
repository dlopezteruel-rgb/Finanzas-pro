import test from 'node:test';
import assert from 'node:assert/strict';
import {protectedStrings,spanishResidualPatterns} from '../../scripts/i18n/residuals';
import {es} from './messages';
test('residuales: distingue datos personales literales de mensajes propios y no confunde homógrafos nativos',()=>{
 const data={wallet:{name:'Confirmar eliminación',notes:'Texto propio {amount}$&'},date:'2026-11-13'},before=JSON.stringify(data),personal=[...protectedStrings(data)],patterns=spanishResidualPatterns('en',personal);
 assert.ok(!patterns.static.some(([text])=>text===data.wallet.name));
 assert.ok(patterns.static.some(([text,keys])=>text===es['common.confirmReplace']&&keys.includes('common.confirmReplace')));
 assert.ok(!spanishResidualPatterns('pt').static.some(([text])=>text==='Guardar'));
 assert.ok(patterns.parameterized.some(pattern=>pattern.key==='storage.wrap.clear'&&new RegExp(pattern.source,'u').test('No se ha aplicado el borrado. Motivo ficticio.')));
 assert.equal(patterns.parameterized.some(pattern=>new RegExp(pattern.source,'u').test('Nombre personal {amount}$&')),false);
 assert.deepEqual(spanishResidualPatterns('es'),{static:[],parameterized:[]});assert.equal(JSON.stringify(data),before);
});
