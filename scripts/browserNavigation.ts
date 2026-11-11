import type { Page } from 'playwright-core';
/** Navigate through the same accessible controls a user sees, including mobile More. */
export async function navigateModule(page: Page, name: string) {
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' }).filter({ visible: true });
  await navigation.waitFor({ state: 'visible' });
  const button = navigation.getByRole('button', { name: new RegExp(`^(?:\\d+\\s*)?${name}(?:\\s*\\d+)?$`) });
  if (['Contactos', 'Deudas', 'Asistente'].includes(name) && await button.count() === 0) {
    await navigation.getByRole('button', { name: /^Más(?:\s*\d+)?$/ }).click();
    await page.getByRole('dialog', { name: 'Más opciones', exact: true }).getByRole('button', { name: new RegExp(`^${name}(?:\\s*\\d+)?$`) }).click();
  } else await button.first().click();
}
