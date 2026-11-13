import {assistantPresentation,assistantPrompts,type AssistantDisplay} from '../i18n/assistantMessages';
import {storageOwnedText} from '../i18n/storageMessages';
import {naturalInputText} from '../i18n/naturalMessages';
import {useI18n, I18nText } from "../i18n";
import {naturalInputIssue} from '../utils/naturalInput';
import type { FinanceData } from '../utils/backup';
import { financialAssistantContext,localFinancialAdvice,assistantServiceContext } from '../utils/financialAssistant';
import { economicTransactions } from '../utils/transfers';
import { SaveResult } from '../utils/saveResult';
import { paths } from '../app/paths';
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { MonthlySummary, Transaction, MonthlyBudgetRow, Loan, Wallet, BudgetPartida } from '../types/finance';

import { classifyChatIntent, proposeChatMovement } from '../utils/chatRegistration';
import { confirmOnceAsync } from '../utils/confirmation';
import { MovementProposalModal } from './MovementProposalModal';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  display?: (view:AssistantDisplay)=>string;
}

interface AssistantChatProps {
  financeData: FinanceData;
  summary: MonthlySummary;
  budgetRows: MonthlyBudgetRow[];
  transactions: Transaction[];
  loans: Loan[];
  wallets: Wallet[];
  availablePartidas: BudgetPartida[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<SaveResult>;
}

export const AssistantChatView: React.FC<AssistantChatProps> = ({
  financeData,
  summary,
  budgetRows,
  transactions,
  loans,
  wallets,
  onAddTransaction,
  availablePartidas,
}) => {
  const format=useI18n();const {t:uiText,formatMoney:formatCurrency,formatDate}=format;
  const view=assistantPresentation(uiText,format,financeData);
  const context=useMemo(()=>{try{return financialAssistantContext(financeData,summary.monthYear)}catch{return null}},[financeData,summary.monthYear]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<Omit<Transaction, 'id'> | null>(null);
  const confirmation = useRef<ReturnType<typeof confirmOnceAsync<Omit<Transaction, 'id'>>> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const appendReply = (reply: string|((view:AssistantDisplay)=>string)) => setMessages(previous => [...previous, {
    id: crypto.randomUUID(), sender: 'assistant', text:typeof reply==='string'?reply:'',display:typeof reply==='function'?reply:undefined,
    time: new Date().toISOString(),
  }]);
  const cancelProposal = () => { confirmation.current?.cancel(); setProposal(null); };
  const confirmProposal = async (transaction: Omit<Transaction, 'id'>) => {
    if (confirming) return;
    setConfirming(true); setProposalError('');
    try {
      if (await confirmation.current?.confirm(transaction)) {
        setProposal(null);
        appendReply(v=>v.text('assistant.registered',{amount:v.amount(transaction.amount),description:transaction.description,wallet:transaction.wallet,status:v.text(transaction.processed?'financial_charts.tramitado':'financial_charts.pendiente')}));
      }
    } catch (error) { setProposalError(error instanceof Error ? error.message : 'No se ha guardado el movimiento.'); }
    finally { setConfirming(false); }
  };

  const greetingSummary=useRef(summary);
  const [messages, setMessages] = useState<Message[]>([{
    id:'msg-init',sender:'assistant',text:'',time:new Date().toISOString(),display:v=>{
      const initial=greetingSummary.current;
      return v.text('assistant.greeting',{month:v.month(initial.monthYear),actualBalance:v.amount(initial.balanceReal),status:v.text(initial.balanceReal>=0?'assistant.favourable':'assistant.negative'),plannedBalance:v.amount(initial.balancePrevisto),remaining:v.amount(initial.restoTotal),rate:v.percent(initial.tasaAhorroReal)});
    },
  }]);
  const previousMonth=useRef(summary.monthYear);
  useEffect(()=>{if(previousMonth.current!==summary.monthYear){previousMonth.current=summary.monthYear;const snapshot=context,month=summary.monthYear;appendReply(v=>v.text('assistant.monthChanged',{month:v.month(month),reply:snapshot?localFinancialAdvice(snapshot,'resumen',v)!:v.text('assistant.contextUnavailable')}));}},[summary.monthYear]);

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let isTable = false;
    let listItems:React.ReactNode[]=[];
    const flushList=(key:string)=>{if(listItems.length){elements.push(<ul key={key}>{listItems}</ul>);listItems=[];}};

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(1).filter(r => !r[0]?.includes('---') && !r[0]?.includes(':---'));
        elements.push(
          <div key={key} className="overflow-x-auto my-2 border border-white/[0.08] rounded-xl bg-[#0c0f17]">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/[0.06]">
                <tr>
                  {header.map((col, i) => (
                    <th key={i} className="py-1.5 px-2.5 border-r border-white/[0.04] last:border-r-0">
                      {col.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {body.map((row, ri) => (
                  <tr key={ri} className="hover:bg-white/[0.02]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-2.5 text-slate-200 border-r border-white/[0.04] last:border-r-0 font-mono">
                        {renderInline(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        isTable = false;
      }
    };

    const renderInline = (str: string) => {
      const parts = str.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if(!trimmed.startsWith('- ')&&!trimmed.startsWith('* '))flushList(`list-${index}`);
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        isTable = true;
        const cols = trimmed.slice(1, -1).split('|');
        tableRows.push(cols);
        return;
      } else if (isTable) {
        flushTable(`table-${index}`);
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={index} className="text-xs font-bold text-sky-400 mt-2 mb-1">
            {trimmed.replace('### ', '')}
          </h4>
        );
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(
          <li key={index} className="ml-3 list-disc text-slate-300 text-[11px] my-0.5">
            {renderInline(trimmed.substring(2))}
          </li>
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="text-xs text-slate-200 my-1 leading-relaxed">
            {renderInline(trimmed)}
          </p>
        );
      }
    });

    flushList('list-end');
    if (isTable) {
      flushTable('table-end');
    }

    return elements;
  };

  const handleSendMessage = async (textToSend?: string,ownedLabel?:typeof assistantPrompts[number]['label']) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading || proposal) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,display:ownedLabel?v=>v.text(ownedLabel):undefined,
      time: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    // Only an explicit instruction or a past movement can create a proposal.
    // Queries and negations never reach the registration callback.
    const intent = classifyChatIntent(text);
    if (intent === 'negation') {
      appendReply(v=>v.text('assistant.negation'));
      setIsLoading(false);
      return;
    }
    if (intent === 'registration') {
      const draft = proposeChatMovement(text, wallets, availablePartidas, undefined, financeData.defaultWalletId);
      if (draft) {
        confirmation.current?.cancel();
        setProposalError('');
        confirmation.current = confirmOnceAsync(async transaction => {
          const result = await onAddTransaction(transaction);
          if (!result.ok) throw new Error(result.error);
        });
        setProposal(draft);
      } else {
        const issue=naturalInputIssue(text);appendReply(v=>v.text('assistant.proposalFailed',{reason:issue?naturalInputText(issue,v.text):v.text('assistant.cannotPropose')}));
      }
      setIsLoading(false);
      return;
    }

    if(!context){appendReply(v=>v.text('assistant.noContext'));setIsLoading(false);return;}
    const localReply=localFinancialAdvice(context,text);
    if(localReply){const snapshot=context;appendReply(v=>localFinancialAdvice(snapshot,text,v)!);setIsLoading(false);return;}

    // Numerical questions above stay local. Other advice uses the existing endpoint.
    try {
      const response = await fetch(paths.assistant, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          summary,
          financialContext:assistantServiceContext(context),
          fallbackReply:localFinancialAdvice(context,'resumen'),
        }),
      });

      const data = await response.json();
      if (data && data.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'assistant',
            text: data.reply,
            time: new Date().toISOString(),
          },
        ]);
      } else {
        throw new Error('No reply');
      }
    } catch {
      const snapshot=context;appendReply(v=>localFinancialAdvice(snapshot,'resumen',v)!);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="assistant-layout" aria-label={uiText("assistant_chat.asistente_financiero")}>
      <aside className="planning-card assistant-context">
        <h1 className="module-title">{uiText("assistant_chat.asistente")}</h1>
        <h2><I18nText id="assistant_chat.tu_contexto_del_mes" values={{ monthYear: (format.formatMonth(summary.monthYear)) }} /></h2>
        <dl><div><dt>{uiText("assistant_chat.ingresos_reales")}</dt><dd>{formatCurrency(summary.ingresosReales)}</dd></div><div><dt>{uiText("assistant_chat.gastos_ejecutados")}</dt><dd>{formatCurrency(summary.gastosEjecutados)}</dd></div><div><dt>{uiText("assistant_chat.balance_real")}</dt><dd>{formatCurrency(summary.balanceReal)}</dd></div></dl>
        <p>{uiText("assistant_chat.las_consultas_numericas_se_calculan_localmente_otras_consultas_usan")}</p>
      </aside>
      <div className="assistant-chat bg-[#141926] border border-white/[0.06] rounded-2xl flex flex-col shadow-sm overflow-hidden">
      {proposal && <MovementProposalModal subitems={financeData.budgetSubitems?.items} proposal={proposal} wallets={wallets} partidas={availablePartidas} onConfirm={confirmProposal} onCancel={cancelProposal} busy={confirming} saveError={storageOwnedText(proposalError,uiText)} />}
      {/* Messages */}
      <div role="region" aria-label={uiText("assistant_chat.historial_del_asistente")} tabIndex={0} className="assistant-messages flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                m.sender === 'user'
                  ? 'bg-white text-slate-950'
                  : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
              }`}
            >
              {m.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div
              className={`assistant-message max-w-[85%] rounded-2xl p-3 text-xs ${
                m.sender === 'user'
                  ? 'bg-white text-slate-950 font-medium rounded-tr-none'
                  : 'bg-[#0c0f17] border border-white/[0.06] text-slate-200 rounded-tl-none shadow-md'
              }`}
            >
              {m.sender === 'assistant' ? renderMarkdown(m.display?m.display(view):m.text) : <p>{m.display?m.display(view):m.text}</p>}
              <span className="text-[9px] text-slate-400 block text-right mt-1.5"><time dateTime={m.time}>{formatDate(m.time,{hour:'2-digit',minute:'2-digit'})}</time></span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-9">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>{uiText("assistant_chat.consultando_datos")}</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Chips */}
      <div className="assistant-suggestions px-3 py-2 bg-[#0c0f17]/60 border-t border-white/[0.04] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {assistantPrompts.map(q => (
          <button
            key={q.id}
            onClick={() => handleSendMessage(q.text,q.label)}
            className="text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-white/[0.06] whitespace-nowrap cursor-pointer shrink-0 active:scale-95 transition-colors"
          >
            {uiText(q.label)}
          </button>
        ))}
      </div>

      <p className="px-3 py-2 text-xs text-slate-400">{uiText("assistant.examplesLanguage")}</p>
      {/* Input */}
      <div className="p-3 bg-[#0c0f17] border-t border-white/[0.06]">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            aria-label={uiText("assistant_chat.mensaje_para_el_asistente")}
            placeholder={uiText("assistant_chat.pregunta_o_registra_un_gasto")}
            className="flex-1 bg-[#141926] border border-white/[0.08] focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl font-bold transition-all cursor-pointer shadow active:scale-95"
            aria-label={uiText("assistant_chat.enviar")}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
    </section>
  );
};
