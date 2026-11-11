import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationPaths, isApplicationPath, normalizeAppBase } from '../../config/appPaths';

test('rutas: prefijo compartido conserva recursos y endpoints en el mismo montaje', () => {
  assert.equal(normalizeAppBase(), '/');
  assert.equal(normalizeAppBase('/preview/finanzas'), '/preview/finanzas/');
  assert.deepEqual(applicationPaths('/preview/finanzas/'), {
    home: '/preview/finanzas/', app: '/preview/finanzas/app',
    logo: '/preview/finanzas/brand/finanzas-mark.svg', preview: '/preview/finanzas/preview/inicio-demo.jpg',
    assistant: '/preview/finanzas/api/assistant-chat', parseMovement: '/preview/finanzas/api/parse-movement',
  });
  assert.equal(applicationPaths().app, '/app');
});
test('rutas: reconocer app y su barra final sin confundir otros módulos o montajes', () => {
  for (const base of ['/', '/preview/finanzas/']) {
    assert.ok(isApplicationPath(`${base}app`, base)); assert.ok(isApplicationPath(`${base}app/`, base));
    for (const path of [base, `${base}application`, `${base}app/datos`, '/otro/app']) assert.equal(isApplicationPath(path, base), false);
  }
});
test('rutas: configuración inválida falla antes de arrancar y no admite destinos externos o relativos', () => {
  for (const base of ['', 'app', '//otro', 'https://otro/', '/a//b', '/../a', '/a/./b', '/a?token=x', '/a#b', '/a\\b', '/%2e%2e/']) {
    assert.throws(() => normalizeAppBase(base), /APP_BASE_PATH/);
  }
});
