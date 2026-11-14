import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogDependencies} from '../utils/budgetCatalog';
import {catalogArchiveFixture} from '../../scripts/catalogArchiveFixture';
import {demoParent} from '../../scripts/budgetSubitemFixture';
import {catalogDependencyText} from './presenters';
import {translatorFor,pluralText} from './messages';

test('i18n catálogo: adapta solo dependencias de dominio conocidas y conserva los datos fuente',()=>{
 const data=catalogArchiveFixture(),snapshot=JSON.stringify(data),labels=catalogDependencies(data,demoParent);
 assert.ok(labels.includes('Movimientos (también pendientes)'));assert.ok(labels.includes('Previsiones mensuales'));
 for(const label of labels){assert.equal(catalogDependencyText(label,translatorFor('es')),label);assert.notEqual(catalogDependencyText(label,translatorFor('en')),label);}
 assert.equal(catalogDependencyText('Nombre personal NO TRADUCIR',translatorFor('fr')),'Nombre personal NO TRADUCIR');
 assert.equal(JSON.stringify(data),snapshot);
 assert.equal(catalogDependencyText('Movimientos (también pendientes)',translatorFor('pt')),'Movimentos (incluindo pendentes)');
 assert.equal(catalogDependencyText('Arrastres',translatorFor('it')),'Riporti');
});
test('i18n catálogo: parámetros con nombres personales no se convierten en claves, ni en HTML',()=>{
 const name='Eliminar familia {source} <script>',tr=translatorFor('fr');
 assert.equal(tr('catalog_manager.archiveFamily',{name}),'Archiver la famille Eliminar familia {source} <script>');
 assert.equal(tr('catalog_manager.reactivateFamily',{name}),'Réactiver la famille Eliminar familia {source} <script>');
 assert.equal(pluralText('en','recordedTransactionsHint',1),'1 transaction recorded • Tap to view');
 assert.equal(pluralText('pt','recordedTransactionsHint',2),'2 movimentos registados • Toque para ver');
});
