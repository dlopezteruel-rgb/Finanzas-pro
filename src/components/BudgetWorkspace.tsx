import React, { useLayoutEffect, useRef, useState } from 'react';

type BudgetTab = 'planning' | 'catalog';
const tabs: { id: BudgetTab; label: string; accessibleLabel: string }[] = [
  { id: 'planning', label: 'Planificación', accessibleLabel: 'Planificación financiera' },
  { id: 'catalog', label: 'Catálogo y partidas', accessibleLabel: 'Catálogo y detalle de partidas' },
];

/** Both panels stay mounted. Selection/scroll are session UI state, never finance data. */
export function BudgetWorkspace({ planning, catalog, navigate, locked }: {
  planning: React.ReactNode;
  catalog: React.ReactNode;
  navigate: (action: () => void) => void;
  locked: boolean;
}) {
  const [selected, setSelected] = useState<BudgetTab>('planning');
  const buttons = useRef<Partial<Record<BudgetTab, HTMLButtonElement | null>>>({});
  const scroll = useRef<Record<BudgetTab, number>>({ planning: 0, catalog: 0 });
  const changed = useRef(false);
  const select = (next: BudgetTab) => {
    if (next === selected || locked) return;
    navigate(() => {
      scroll.current[selected] = window.scrollY;
      changed.current = true;
      setSelected(next);
    });
  };
  useLayoutEffect(() => {
    if (!changed.current) return;
    changed.current = false;
    buttons.current[selected]?.focus({ preventScroll: true });
    window.scrollTo({ top: scroll.current[selected], behavior: 'instant' });
  }, [selected]);
  return <section className="budget-workspace space-y-4 pb-20 md:pb-6" aria-label="Presupuestos">
    <h1 className="text-xl font-bold">Presupuestos</h1>
    <div role="tablist" aria-label="Secciones de Presupuestos" className="budget-tabs">
      {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`budget-tab-${tab.id}`}
        ref={node => { buttons.current[tab.id] = node; }}
        aria-label={tab.accessibleLabel} aria-selected={selected === tab.id} aria-controls={`budget-panel-${tab.id}`}
        tabIndex={selected === tab.id ? 0 : -1} disabled={locked} onClick={() => select(tab.id)}
        onKeyDown={event => {
          // Manual activation: arrow keys move focus; Enter/Space invokes the guarded change.
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
            : event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
          if (next !== null) { event.preventDefault(); buttons.current[tabs[next].id]?.focus({ preventScroll: true }); }
        }}>{tab.label}</button>)}
    </div>
    <div id="budget-panel-planning" role="tabpanel" aria-labelledby="budget-tab-planning" tabIndex={0} hidden={selected !== 'planning'}>{planning}</div>
    <div id="budget-panel-catalog" role="tabpanel" aria-labelledby="budget-tab-catalog" tabIndex={0} hidden={selected !== 'catalog'}>
      <h2 className="text-lg font-bold mb-3">Catálogo y detalle de partidas</h2>
      {catalog}
    </div>
  </section>;
}
