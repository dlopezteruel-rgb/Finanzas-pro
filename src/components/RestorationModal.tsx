import React from 'react';
import { Backup, backupWarnings } from '../utils/backup';
import { SafeDialog } from './SafeDialog';

export function RestorationModal({ backup, label, onCancel, onConfirm }: {
  backup: Backup; label: string; onCancel: () => void; onConfirm: () => void;
}) {
  const counts = [
    ['Movimientos', backup.transactions.length], ['Presupuestos', backup.budgetPlans.length],
    ['Paquetes', backup.budgetGroups.length], ['Contactos', backup.contacts.length],
    ['Préstamos', backup.loans.length], ['Carteras', backup.wallets.length],
  ];
  return <SafeDialog title={label} onCancel={onCancel}>
    <p className="text-sm text-slate-300">Se sustituirán todos los datos por esta copia. Antes se guardará una copia de recuperación del estado actual.</p>
    <p className="text-xs text-slate-400">Formato {backup.version} · {new Date(backup.exportedAt).toLocaleString('es-ES')} · Tema {backup.theme === 'dark' ? 'oscuro' : 'claro'}</p>
    <dl className="grid grid-cols-2 gap-2 text-sm">{counts.map(([name, count]) => <div key={name} className="bg-white/5 rounded-xl p-2"><dt>{name}</dt><dd className="font-bold">{count}</dd></div>)}</dl>
    {backupWarnings(backup).map(warning => <p className="text-xs text-amber-300" key={warning}>{warning}</p>)}
    <p className="text-xs text-slate-400">Las copias se descargan desde el menú «Copias de recuperación». No se fusionarán datos.</p>
    <div className="flex gap-2 justify-end">
      <button onClick={onCancel} className="rounded-xl px-4 py-2 bg-white/10">Cancelar</button>
      <button onClick={onConfirm} className="rounded-xl px-4 py-2 bg-sky-500 text-slate-950 font-bold">Confirmar sustitución</button>
    </div>
  </SafeDialog>;
}
