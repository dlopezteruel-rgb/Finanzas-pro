import {subitemsRestoreNotice,sharedReceiptsNotice} from '../i18n/countMessages';
import {storageOwnedText,restorationTitleText,backupWarningText} from '../i18n/storageMessages';
import { useI18n, I18nText } from "../i18n";
import React from 'react';
import { Backup, backupWarnings } from '../utils/backup';

import { SafeDialog } from './SafeDialog';
import { resolveDefaultWallet } from '../utils/defaultWallet';

export function RestorationModal({ backup, label, onCancel, onConfirm, busy = false, error = '', onDismissError }: {
  backup: Backup; label: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; error?: string; onDismissError?: () => void;
}) {
  const { language,t: uiText , formatMoney: formatCurrency , formatDate,formatNumber } = useI18n();
  const { t } = useI18n();
  const counts = [
    ...(backup.intelligentFinance?[['Reglas de movimientos',backup.intelligentFinance.recurringRules.length],['Identidades de ocurrencias',backup.intelligentFinance.occurrences.length],['Compromisos personales',backup.intelligentFinance.obligations.length],['Liquidaciones personales',backup.intelligentFinance.obligations.reduce((n,o)=>n+o.settlements.length,0)]]:[]),
    ['Movimientos', backup.transactions.length], ['Presupuestos', backup.budgetPlans.length],
    ...(backup.planningMonths ? [['Objetivos y aprobaciones mensuales', backup.planningMonths.length]] : []),
    ...(backup.planningAutomation?[['Reglas recurrentes',backup.planningAutomation.rules.length],['Arrastres',backup.planningAutomation.carryovers.length],['Fotografías históricas',backup.planningAutomation.history.reduce((n,h)=>n+h.approvals.length,0)]]:[]),
    ['Paquetes', backup.budgetGroups.length], ['Contactos', backup.contacts.length],
    ['Préstamos', backup.loans.length], ['Carteras', backup.wallets.length],
  ];
  return <SafeDialog title={restorationTitleText(label,uiText)} onCancel={() => { if (!busy) onCancel(); }}>
    {error && <div role="alert" className="text-amber-300 text-sm"><p>{storageOwnedText(error,uiText)}</p>{onDismissError && <button onClick={onDismissError}>{uiText("restoration.cerrar_aviso")}</button>}</div>}
    <p className="text-sm text-slate-300">{uiText("restoration.se_sustituiran_todos_los_datos_por_esta_copia_antes")}</p>
    <p className="text-xs text-slate-400">{uiText("restoration.formato_tema", { version: backup.version, content: formatDate(backup.exportedAt, {year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'}), content_5f4b8: backup.theme === 'dark' ? uiText("restoration.oscuro") : uiText("restoration.claro") })}</p>
    {backup.budgetSubitems&&<p>{subitemsRestoreNotice(backup.budgetSubitems.items.filter(i=>!i.deleted).length,backup.budgetSubitems.months.length,language,uiText,formatNumber)}</p>}
    <p className="text-sm"><I18nText id="restoration.cartera_predeterminada_tras_restaurar" values={{ content: (resolveDefaultWallet(backup.wallets, backup.defaultWalletId)?.name ?? uiText("restoration.sin_configurar_requiere_seleccion_en_cada_operacion")), content_086d2: (backup.wallets.length === 1 ? uiText("restoration.automatica_unica_cartera") : '') }} /></p>
    <dl className="grid grid-cols-2 gap-2 text-sm">{counts.map(([name, count]) => <div key={name} className="bg-white/5 rounded-xl p-2"><dt>{storageOwnedText(String(name),uiText)}</dt><dd className="font-bold">{typeof count==='number'?formatNumber(count):count}</dd></div>)}</dl>
    {label.startsWith('Migrar gastos compartidos') && <div className="space-y-2 text-xs text-slate-300">
      <p>{uiText("restoration.solo_se_anaden_vinculos_verificables_se_conservan_los_campos")}</p>
      {backup.transactions.filter(t => t.splitInfo?.accountingVersion === '2.7').map(t => <div key={t.id} className="border border-white/10 rounded-xl p-2 space-y-1">
        <p>{sharedReceiptsNotice(t.splitInfo!.settlements!.length,{description:t.description,amount:formatCurrency(t.amount),myShare:formatCurrency(t.splitInfo!.myShare)},language,uiText,formatNumber)}</p>
        <p>{uiText("restoration.cartera_fecha", { wallet: t.wallet, date: formatDate(t.date, {day:'2-digit',month:'2-digit',year:'numeric'}) })}</p>
        {t.splitInfo!.participants.map(p => <p key={p.contactId}>{p.contactName} ({p.contactId}): {formatCurrency(p.amount)}</p>)}
        {t.splitInfo!.settlements!.map(s => <p key={s.id}><I18nText id="restoration.cobro" values={{ transactionId: (s.transactionId), date: (formatDate(s.date, {day:'2-digit',month:'2-digit',year:'numeric'})), amount: (formatCurrency(s.amount)), content: (backup.wallets.find(w => w.id === s.walletId)?.name) }} /></p>)}
      </div>)}
    </div>}
    {backupWarnings(backup).map(warning => <p className="text-xs text-amber-300" key={warning}>{backupWarningText(warning,language,uiText)}</p>)}
    <p className="text-xs text-slate-400">{uiText("restoration.las_copias_se_descargan_desde_el_menu_copias_de")}</p>
    <div className="flex gap-2 justify-end">
      <button disabled={busy} onClick={onCancel} className="rounded-xl px-4 py-2 bg-white/10">{t('common.cancel')}</button>
      <button disabled={busy} onClick={onConfirm} className="rounded-xl px-4 py-2 bg-sky-500 text-slate-950 font-bold">{busy ? t('common.saving') : t('common.confirmReplace')}</button>
    </div>
  </SafeDialog>;
}
