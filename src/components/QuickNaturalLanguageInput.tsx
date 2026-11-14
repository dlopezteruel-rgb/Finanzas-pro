import {quickEntryPrompts} from '../i18n/assistantMessages';
import {naturalInputText} from '../i18n/naturalMessages';
import {storageOwnedText} from '../i18n/storageMessages';
import {useI18n, I18nText } from "../i18n";
import {SubitemSelector} from './SubitemSelector';
import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useMemo } from 'react';
import { Zap, Check, X, ArrowRight, CornerDownLeft, CheckCircle2 } from 'lucide-react';
import {naturalInputIssue} from '../utils/naturalInput';
import { parseFinancialInput } from '../utils/parser';

import { Transaction, Wallet, BudgetSubitem, BudgetPartida, MovementType } from '../types/finance';
import { walletFromText } from '../utils/defaultWallet';

interface QuickInputProps {
  partidas:BudgetPartida[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<SaveResult>;
  wallets: Wallet[];
  subitems?:BudgetSubitem[];
  defaultWalletId?: string | null;
  className?: string;
  placeholder?: string;
}

export const QuickNaturalLanguageInput: React.FC<QuickInputProps> = ({
  onAddTransaction,
  wallets,partidas,
  defaultWalletId, subitems,
  className = '',
  placeholder,
}) => {
  const format=useI18n(); const {formatMoney:formatCurrency,formatDate,t:uiText}=format;
  const exampleHint=React.useId();
  const submission = useAsyncForm();
  const [inputText, setInputText] = useState('');
  const [subitemChoice,setSubitemChoice]=useState<{key:string;id:string}|null>(null);
  const [typeChoice,setTypeChoice]=useState<{text:string;type:MovementType}|null>(null);
  const [partidaChoice,setPartidaChoice]=useState<{text:string;code:string}|null>(null);
  const [walletChoice, setWalletChoice] = useState<string | undefined>();
  const parsed = useMemo(() => {
    const result = parseFinancialInput(inputText,undefined,partidas,typeChoice?.text===inputText?typeChoice.type:undefined);
    if (!result) return null;
    const selected = walletChoice !== undefined ? wallets.find(w => w.id === walletChoice) : walletFromText(inputText, result.wallet, wallets, defaultWalletId);
    const choice=partidaChoice?.text===inputText?partidas.find(p=>p.type===result.type&&p.code===partidaChoice.code&&!p.archived&&!p.deleted):undefined;
    return { ...result,...(choice?{code:choice.code,categoryName:choice.groupName,subcategoryName:choice.name}:{}), wallet: selected?.name ?? '' };
  }, [inputText, wallets, defaultWalletId, walletChoice,partidas,partidaChoice,typeChoice]);
  const inputIssue=inputText.trim()?naturalInputIssue(inputText):null;
  const [lastNotification, setLastNotification] = useState<{type:MovementType;amount:number;name:string} | null>(null);

  const handleConfirm = () => {
    if (!parsed || parsed.amount <= 0 || !wallets.some(w => w.name === parsed.wallet)) return;

    const matched=partidas.find(p=>p.type===parsed.type&&p.code===parsed.code&&!p.archived&&!p.deleted);
    if(!matched)return;

    void submission.submit(() => onAddTransaction({
      amount: parsed.amount,
      type: parsed.type,
      code: parsed.code,
      subitemId:subitemChoice?.key===`${parsed.type}:${parsed.code}`?subitemChoice.id||undefined:undefined,
      categoryName: matched.groupName,
      subcategoryName: matched.name,
      description: parsed.description || matched.name,
      wallet: parsed.wallet,
      date: parsed.date,
      processed: parsed.processed,
      notes: `Registro rápido: "${inputText}"`,
    }), () => {
    setLastNotification({type:parsed.type,amount:parsed.amount,name:matched.name});
    setInputText('');
    setWalletChoice(undefined); setSubitemChoice(null);setPartidaChoice(null);setTypeChoice(null);

    setTimeout(() => {
      setLastNotification(null);
    }, 4000);
    });
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {submission.error && <p role="alert" className="text-amber-300 text-xs">{storageOwnedText(submission.error,uiText)}</p>}
      {submission.saving && <p role="status" className="text-sky-300 text-xs">{uiText("quick_natural_language_input.guardando")}</p>}
      <fieldset disabled={submission.saving} className="min-w-0 space-y-2">
      {/* Sleek Search & Quick-Entry Bar */}
      <div className="relative flex items-center">
        <div className="absolute left-3 text-slate-400 pointer-events-none">
          <Zap className="w-4 h-4 text-sky-400" />
        </div>

        <input
          type="text"
          value={inputText}
          onChange={e => { setInputText(e.target.value);setPartidaChoice(null);setTypeChoice(null);setSubitemChoice(null); if (!e.target.value.trim()) {setWalletChoice(undefined);setSubitemChoice(null);} }}
          onKeyDown={e => {
            if (e.key === 'Enter' && parsed && parsed.amount > 0) {
              e.preventDefault();
              handleConfirm();
            }
          }}
          aria-label={uiText("quick.label")} aria-describedby={exampleHint}
          placeholder={placeholder??uiText("quick.placeholder")}
          className="w-full bg-[#141926] hover:bg-[#181f30] focus:bg-[#181f30] border border-white/[0.08] focus:border-sky-500/80 rounded-2xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-all shadow-sm"
        />

        {inputText && (
          <button
            onClick={() => {
              setInputText('');
              setWalletChoice(undefined); setSubitemChoice(null);setPartidaChoice(null);setTypeChoice(null);
            }}
            className="absolute right-3 text-slate-400 hover:text-white p-1"
            title={uiText("quick_natural_language_input.borrar")}
            aria-label={uiText("quick_natural_language_input.borrar_texto")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Pills (Horizontal Scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {quickEntryPrompts.map(pill => (
          <button
            key={pill.id}
            type="button"
            onClick={() => {setInputText(pill.text);setPartidaChoice(null);setTypeChoice(null);setSubitemChoice(null);}}
            className="whitespace-nowrap text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-white/[0.06] transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            {uiText(pill.label)}
          </button>
        ))}
      </div>

      <p id={exampleHint} className="text-xs text-slate-400">{uiText("assistant.examplesLanguage")}</p>
      {inputIssue&&<p role="status">{naturalInputText(inputIssue,uiText)}</p>}
      {/* Compact Parsed Card Preview */}
      {parsed && (
        <div className="bg-[#161c2b] border border-sky-500/40 rounded-2xl p-3 shadow-xl animate-fadeIn space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  parsed.type === 'INGRESO'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {uiText(parsed.type==='INGRESO'?"quick_natural_language_input.ingreso":"quick_natural_language_input.gasto")}
              </span>
              <span className="text-xs text-slate-200 font-semibold truncate" title={parsed.subcategoryName}>
                {parsed.subcategoryName.split(':')[1] || parsed.subcategoryName}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-black font-mono text-white">
                {formatCurrency(parsed.amount)}
              </span>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={parsed.amount <= 0 || !parsed.code || !wallets.some(w => w.name === parsed.wallet)}
                className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl shadow transition-all cursor-pointer flex items-center gap-1 active:scale-95 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{uiText("quick_natural_language_input.registrar")}</span>
              </button>
            </div>
          </div>

          <label className="block">{uiText("quick_natural_language_input.tipo")}<select aria-label={uiText("quick_natural_language_input.tipo_del_registro_rapido")} value={parsed.type} onChange={e=>{setTypeChoice({text:inputText,type:e.target.value as MovementType});setPartidaChoice(null);setSubitemChoice(null);}}><option value="GASTO">{uiText("quick_natural_language_input.gasto")}</option><option value="INGRESO">{uiText("quick_natural_language_input.ingreso")}</option></select></label>
          <label className="block">{uiText("quick_natural_language_input.partida")}<select aria-label={uiText("quick_natural_language_input.partida_del_registro_rapido")} value={parsed.code} onChange={e=>{setPartidaChoice({text:inputText,code:e.target.value});setSubitemChoice(null);}}><option value="" disabled>{uiText("quick_natural_language_input.selecciona_una_partida")}</option>{partidas.filter(p=>p.type===parsed.type&&!p.archived&&!p.deleted).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
          {!parsed.code&&<p role="status">{uiText("quick_natural_language_input.selecciona_una_partida_de_tu_catalogo_no_hay_una")}</p>}
          <SubitemSelector items={subitems} type={parsed.type} code={parsed.code} value={subitemChoice?.key===`${parsed.type}:${parsed.code}`?subitemChoice.id:''} onChange={id=>setSubitemChoice({key:`${parsed.type}:${parsed.code}`,id})}/>
          <div className="quick-entry-metadata flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-white/[0.06]">
            <div className="quick-entry-fields flex items-center gap-3">
              <label>{uiText("quick_natural_language_input.cartera")}<select aria-label={uiText("quick_natural_language_input.cartera_del_registro_rapido")} value={parsed.wallet} onChange={e => setWalletChoice(wallets.find(w => w.name === e.target.value)?.id ?? '')}>
                <option value="" disabled>{uiText("quick_natural_language_input.selecciona_una_cartera")}</option>{wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
              </select></label>
              <span><I18nText id="quick_natural_language_input.fecha" values={{ strong: (<strong className="text-slate-200"><time dateTime={parsed.date}>{formatDate(parsed.date, {day:'2-digit',month:'2-digit',year:'numeric'})}</time></strong>) }} /></span>
            </div>
            <span className={parsed.processed ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {parsed.processed ? uiText("quick_natural_language_input.tramitado_si") : uiText("quick_natural_language_input.pendiente_no")}
            </span>
          </div>
        </div>
      )}

      </fieldset>
      {/* Transient Success notification */}
      {lastNotification && (
        <div role="status" className="quick-entry-notice p-2.5 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-medium">{uiText("quick.saved",{type:uiText(lastNotification.type==='INGRESO'?"quick_natural_language_input.ingreso":"quick_natural_language_input.gasto"),amount:formatCurrency(lastNotification.amount),name:lastNotification.name})}</span>
        </div>
      )}
    </div>
  );
};
