import type { Page, Locator } from 'playwright-core';
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

/** Select the visible planning area through its public keyboard/touch control. */
export async function selectPlanningArea(page: Page, name: 'Gastos' | 'Ingresos' | 'Multiperiodo') {
  const tabs = page.getByRole('tablist', {name: 'Áreas de planificación', exact: true});
  const tab = tabs.getByRole('tab', {name: new RegExp(`^${name}(?: · Revisar importes)?$`)});
  if (name === 'Multiperiodo' && await tab.count() === 0) {
    const summary = page.locator('.planning-multiperiod > details > summary');
    if (await summary.locator('..').getAttribute('open') === null) await summary.click();
    return;
  }
  await tab.click();
}

/** Legacy regression fixtures now explicitly choose their intended movement category. */
export async function chooseMovementPartida(target:Page|Locator){
  const page='page' in target?target.page():target;
  const dialog=page.getByRole('dialog',{name:'Movimiento',exact:true});if(!await dialog.count())return;
  const trigger=dialog.getByRole('button',{name:'Seleccionar partida presupuestaria',exact:true});
  if((await trigger.innerText()).trim()!=='Selecciona una partida')return;
  await trigger.click();const options=dialog.getByRole('listbox').getByRole('option'),restaurant=options.filter({hasText:/Comer fuera/}).first();
  if(await restaurant.count())await restaurant.click();else if(await options.count())await options.first().click();else await page.keyboard.press('Escape');
}
