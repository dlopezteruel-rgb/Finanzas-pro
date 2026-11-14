import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {I18nProvider,languages,translatorFor,type Language} from '../i18n';
import {LandingPage} from './LandingPage';
import {Brand} from './Brand';
import {PartidaSelector} from './PartidaSelector';

for(const language of Object.keys(languages) as Language[])test(`landing ${language}: selector etiquetado y cinco nombres nativos habilitados`,()=>{
  const html=renderToStaticMarkup(<I18nProvider requested={language}><LandingPage /></I18nProvider>),header=html.match(/<header\b[\s\S]*?<\/header>/)?.[0]??'';
  assert.match(header,/<label[^>]*for="landing-language"/);
  assert.ok(header.includes(translatorFor(language)('language.label')));
  assert.match(header,/<select[^>]*id="landing-language"[^>]*aria-describedby="landing-language-help"/);
  const options=[...header.matchAll(/<option value="([^"]+)"([^>]*)>([^<]+)<\/option>/g)];
  assert.deepEqual(options.map(m=>[m[1],m[3]]),Object.entries(languages).map(([code,item])=>[code,item.label]));
  assert.deepEqual(options.filter(m=>m[2].includes('selected')).map(m=>m[1]),[language]);
  assert.equal(options.some(m=>m[2].includes('disabled')),false);
  assert.ok(html.includes('id="landing-language-help"'));
});

test('marca: el texto visible no se reemplaza por un nombre ARIA sin rol',()=>{
  const html=renderToStaticMarkup(<I18nProvider><Brand description /></I18nProvider>);
  assert.equal(/<span[^>]*aria-label=/.test(html),false);assert.ok(html.includes('FinanZas'));assert.ok(html.includes(translatorFor('es')('brand.description')));
});
test('selector de partida cerrado: no apunta a una lista que todavía no está montada',()=>{
  const html=renderToStaticMarkup(<I18nProvider><PartidaSelector groups={[]} transactions={[]} type="GASTO" value="" onChange={()=>{}} /></I18nProvider>);
  assert.ok(html.includes('aria-expanded="false"'));assert.ok(html.includes('aria-haspopup="listbox"'));assert.equal(html.includes('aria-controls='),false);
});
