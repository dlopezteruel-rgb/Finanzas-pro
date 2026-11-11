import React from 'react';
import { Backup, backupWarnings } from '../utils/backup';
import { formatCurrency } from '../utils/finance';
import { SafeDialog } from './SafeDialog';
import { resolveDefaultWallet } from '../utils/defaultWallet';

export function RestorationModal({ backup, label, onCancel, onConfirm, busy = false, error = '', onDismissError }: {
  backup: Backup; label: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string; onDismissError?: () => void;
}) {
  const counts = [
    ...(backup.intelligentFinance?[['Reglas de movimientos',backup.intelligentFinance.recurringRules.length],['Identidades de ocurrencias',backup.intelligentFinance.occurrences.length],['Compromisos personales',backup.intelligentFinance.obligations.length],['Liquidaciones personales',backup.intelligentFinance.obligations.reduce((n,o)=>n+o.settlements.length,0)]]:[]),
    ['Movimientos', backup.transactions.length], ['Presupuestos', backup.budgetPlans.length],
    ...(backup.planningMonths ? [['Objetivos y aprobaciones mensuales', backup.planningMonths.length]] : []),
    ...(backup.planningAutomation?[['Reglas recurrentes',backup.planningAutomation.rules.length],['Arrastres',backup.planningAutomation.carryovers.length],['Fotografías históricas',backup.planningAutomation.history.reduce((n,h)=>n+h.approvals.length,0)]]:[]),
    ['Paquetes', backup.budgetGroups.length], ['Contactos', backup.contacts.length],
    ['Préstamos', backup.loans.length], ['Carteras', backup.wallets.length],
  ];
  return <SafeDialog title={label} onCancel={() => { if (!busy) onCancel(); }}>
    {error && <div role="alert" className="text-amber-300 text-sm"><p>{error}</p>{onDismissError && <button onClick={onDismissError}>Cerrar aviso</button>}</div>}
    <p className="text-sm text-slate-300">Se sustituirán todos los datos por esta copia. Antes se guardará una copia de recuperación del estado actual.</p>
    <p className="text-xs text-slate-400">Formato {backup.version} · {new Date(backup.exportedAt).toLocaleString('es-ES')} · Tema {backup.theme === 'dark' ? 'oscuro' : 'claro'}</p>
    <p className="text-sm">Cartera predeterminada tras restaurar: {resolveDefaultWallet(backup.wallets, backup.defaultWalletId)?.name ?? 'sin configurar; requiere selección en cada operación'}{backup.wallets.length === 1 ? ' (automática: única cartera)' : ''}.</p>
    <dl className="grid grid-cols-2 gap-2 text-sm">{counts.map(([name, count]) => <div key={name} className="bg-white/5 rounded-xl p-2"><dt>{name}</dt><dd className="font-bold">{count}</dd></div>)}</dl>
    {label.startsWith('Migrar gastos compartidos') && <div className="space-y-2 text-xs text-slate-300">
      <p>Solo se añaden vínculos verificables; se conservan los campos originales. La parte propia sustituirá al gasto total en los indicadores y los reintegros vinculados dejarán de contarse como ingresos.</p>
      {backup.transactions.filter(t => t.splitInfo?.accountingVersion === '2.7').map(t => <div key={t.id} className="border border-white/10 rounded-xl p-2 space-y-1">
        <p>{t.description}: salida {formatCurrency(t.amount)}, gasto propio {formatCurrency(t.splitInfo!.myShare)}, {t.splitInfo!.settlements!.length} cobros vinculados.</p>
        <p>Cartera: {t.wallet} · Fecha: {t.date}</p>
        {t.splitInfo!.participants.map(p => <p key={p.contactId}>{p.contactName} ({p.contactId}): {formatCurrency(p.amount)}</p>)}
        {t.splitInfo!.settlements!.map(s => <p key={s.id}>Cobro {s.transactionId} · {s.date} · {formatCurrency(s.amount)} · {backup.wallets.find(w => w.id === s.walletId)?.name}</p>)}
      </div>)}
    </div>}
    {backupWarnings(backup).map(warning => <p className="text-xs text-amber-300" key={warning}>{warning}</p>)}
    <p className="text-xs text-slate-400">Las copias se descargan desde el menú «Copias de recuperación». No se fusionarán datos.</p>
    <div className="flex gap-2 justify-end">
      <button disabled={busy} onClick={onCancel} className="rounded-xl px-4 py-2 bg-white/10">Cancelar</button>
      <button disabled={busy} onClick={onConfirm} className="rounded-xl px-4 py-2 bg-sky-500 text-slate-950 font-bold">{busy ? 'Guardando…' : 'Confirmar sustitución'}</button>
    </div>
  </SafeDialog>;
}
