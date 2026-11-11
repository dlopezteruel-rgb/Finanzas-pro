import test from 'node:test';
import assert from 'node:assert/strict';
import { activeLanguage, languages, presentationMoney, presentationDate } from './index';
test('i18n: solo español está disponible; idiomas incompletos y desconocidos no se anuncian traducidos', () => {
  assert.equal(activeLanguage('es'), 'es');
  for (const language of ['en', 'it', 'fr', 'pt', 'xx']) assert.equal(activeLanguage(language), 'es');
  assert.equal(Object.keys(languages).length, 5);
});
test('i18n: presentación en cinco locales conserva EUR y los importes de origen', () => {
  const amount = 1234.56;
  for (const language of Object.keys(languages) as (keyof typeof languages)[]) {
    const parts = new Intl.NumberFormat(languages[language].locale, { style: 'currency', currency: 'EUR' }).formatToParts(amount);
    assert.equal(parts.find(p => p.type === 'currency')!.value, '€');
    assert.equal(presentationMoney(amount, language), parts.map(p => p.value).join(''));
  }
  assert.equal(amount, 1234.56);
});
test('i18n: fecha de presentación mantiene Madrid al cruzar medianoche sin cambiar el instante', () => {
  const date = new Date('2026-11-30T23:30:00Z'), before = date.toISOString();
  assert.match(presentationDate(date, 'es'), /1 de diciembre de 2026/);
  assert.match(presentationDate(date, 'en'), /1 December 2026/);
  assert.equal(date.toISOString(), before);
});
