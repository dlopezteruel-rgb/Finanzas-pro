import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormSubmission, SaveResult, saveErrorMessage } from './saveResult';
import { storageSupportError } from './storageSupport';

test('el formulario solo cierra después de la confirmación real del guardado', async () => {
  let complete!: (result: SaveResult) => void;
  let closed = 0, writes = 0;
  const submission = createFormSubmission();
  const first = submission.run(() => { writes++; return new Promise(resolve => { complete = resolve; }); }, () => closed++);
  assert.equal(submission.pending, true);
  assert.equal(closed, 0);
  assert.equal(await submission.run(async () => { writes++; return { ok: true }; }, () => closed++), null);
  assert.equal(writes, 1);
  complete({ ok: true }); await first;
  assert.equal(closed, 1);
  assert.equal(submission.pending, false);
});

for (const reason of ['Otra pestaña ha cambiado los datos.', 'No hay espacio disponible.', 'Web Locks no está disponible.']) {
  test(`un fallo conserva el formulario y permite reintentar: ${reason}`, async () => {
    const draft = { amount: 25, description: 'Edición pendiente', date: '2026-11-03' };
    const before = structuredClone(draft);
    let closed = 0;
    const submission = createFormSubmission();
    const result = await submission.run(async () => ({ ok: false, error: reason }), () => closed++);
    assert.deepEqual(result, { ok: false, error: reason });
    assert.deepEqual(draft, before);
    assert.equal(closed, 0);
    assert.equal(submission.pending, false);
    await submission.run(async () => ({ ok: true }), () => closed++);
    assert.equal(closed, 1);
  });
}

test('una excepción de cuota se explica y no cierra el formulario', async () => {
  let closed = false;
  const submission = createFormSubmission();
  const result = await submission.run(async () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }, () => { closed = true; });
  assert.equal(closed, false);
  assert.ok(result?.ok === false && /No hay espacio/.test(result.error));
  assert.equal(submission.pending, false);
});

test('la comprobación de compatibilidad exige contexto seguro y Web Locks', () => {
  assert.equal(storageSupportError(true, true), '');
  assert.match(storageSupportError(false, true), /HTTPS/);
  assert.match(storageSupportError(true, false), /Web Locks/);
  assert.match(saveErrorMessage(new DOMException('Permission denied', 'SecurityError')), /permisos/);
});
