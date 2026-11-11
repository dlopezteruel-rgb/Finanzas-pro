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
import { formatCurrency } from '../utils/finance';
import { classifyChatIntent, proposeChatMovement } from '../utils/chatRegistration';
import { confirmOnceAsync } from '../utils/confirmation';
import { MovementProposalModal } from './MovementProposalModal';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
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
  const context=useMemo(()=>{try{return financialAssistantContext(financeData,summary.monthYear)}catch{return null}},[financeData,summary.monthYear]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proposal, setProposal] = useState<Omit<Transaction, 'id'> | null>(null);
  const confirmation = useRef<ReturnType<typeof confirmOnceAsync<Omit<Transaction, 'id'>>> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [proposalError, setProposalError] = useState('');
  const appendReply = (text: string) => setMessages(previous => [...previous, {
    id: crypto.randomUUID(), sender: 'assistant', text,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }]);
  const cancelProposal = () => { confirmation.current?.cancel(); setProposal(null); };
  const confirmProposal = async (transaction: Omit<Transaction, 'id'>) => {
    if (confirming) return;
    setConfirming(true); setProposalError('');
    try {
      if (await confirmation.current?.confirm(transaction)) {
        setProposal(null);
        appendReply(`✓ Movimiento registrado: ${formatCurrency(transaction.amount)} · ${transaction.description} · ${transaction.wallet} · ${transaction.processed ? 'Tramitado' : 'Pendiente'}.`);
      }
    } catch (error) { setProposalError(error instanceof Error ? error.message : 'No se ha guardado el movimiento.'); }
    finally { setConfirming(false); }
  };

  const initialGreeting = `¡Hola! Soy tu asistente financiero personal.
Te ayudo a registrar movimientos en lenguaje natural, auditar tus presupuestos y vigilar tus deudas.

### Estado Financiero (${summary.monthYear})
| Métrica | Importe | Estado |
| :--- | :--- | :--- |
| **Balance Real** | **${formatCurrency(summary.balanceReal)}** | ${summary.balanceReal >= 0 ? 'Favorable' : 'Negativo'} |
| **Balance Previsto** | **${formatCurrency(summary.balancePrevisto)}** | Objetivo |
| **Resto Presupuesto** | **${formatCurrency(summary.restoTotal)}** | Margen disponible |
| **Tasa Ahorro** | **${summary.tasaAhorroReal}%** | Real alcanzada |

Pruébame dictando: *"Ayer cené fuera por 15,50 € con Openbank"*`;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      text: initialGreeting,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const previousMonth=useRef(summary.monthYear);
  useEffect(()=>{if(previousMonth.current!==summary.monthYear){previousMonth.current=summary.monthYear;appendReply(`Periodo consultado: ${summary.monthYear}. ${context?localFinancialAdvice(context,'resumen'):'No se puede calcular el contexto con los datos guardados.'}`)}},[summary.monthYear]);

  const quickQuestions = [
    '¿Cuánto tengo realmente disponible?',
    '¿Qué gastos puedo reducir para ahorrar 150 € más?',
    '¿Qué pagos y cobros se aproximan?',
    '¿Qué partidas están en alerta?',
    'Ayer cené fuera por 15,50 € con Openbank',
    'Resumen de mis préstamos y deudas',
  ];

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];
    let isTable = false;

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
        elements.push(
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

    if (isTable) {
      flushTable('table-end');
    }

    return elements;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading || proposal) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    // Only an explicit instruction or a past movement can create a proposal.
    // Queries and negations never reach the registration callback.
    const intent = classifyChatIntent(text);
    if (intent === 'negation') {
      appendReply('No se ha registrado ningún movimiento. Puedes formular una consulta o pedir una propuesta con «Registra un gasto de…».');
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
        appendReply('No he podido preparar el movimiento. Indica un importe positivo y revisa que existan categorías disponibles. No se ha registrado nada.');
      }
      setIsLoading(false);
      return;
    }

    if(!context){appendReply('No puedo calcular el contexto guardado de este periodo. Revisa los importes y los avisos de datos; no se ha modificado nada.');setIsLoading(false);return;}
    const localReply=localFinancialAdvice(context,text);
    if(localReply){appendReply(localReply);setIsLoading(false);return;}

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
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('No reply');
      }
    } catch {
      appendReply(localFinancialAdvice(context,'resumen')!);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="assistant-layout" aria-label="Asistente financiero">
      <aside className="planning-card assistant-context">
        <h1 className="module-title">Asistente</h1>
        <h2>Tu contexto del mes · {summary.monthYear}</h2>
        <dl><div><dt>Ingresos reales</dt><dd>{formatCurrency(summary.ingresosReales)}</dd></div><div><dt>Gastos ejecutados</dt><dd>{formatCurrency(summary.gastosEjecutados)}</dd></div><div><dt>Balance real</dt><dd>{formatCurrency(summary.balanceReal)}</dd></div></dl>
        <p>Las consultas numéricas se calculan localmente. Otras consultas usan el asistente existente con métricas agregadas, sin contactos ni respaldos completos. Las consultas utilizan datos guardados. Revisa cualquier propuesta antes de confirmar un movimiento.</p>
      </aside>
      <div className="assistant-chat bg-[#141926] border border-white/[0.06] rounded-2xl flex flex-col shadow-sm overflow-hidden">
      {proposal && <MovementProposalModal proposal={proposal} wallets={wallets} partidas={availablePartidas} onConfirm={confirmProposal} onCancel={cancelProposal} busy={confirming} saveError={proposalError} />}
      {/* Messages */}
      <div className="assistant-messages flex-1 overflow-y-auto p-3.5 space-y-3">
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
              {m.sender === 'assistant' ? renderMarkdown(m.text) : <p>{m.text}</p>}
              <span className="text-[9px] text-slate-400 block text-right mt-1.5">{m.time}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-9">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            <span>Consultando datos...</span>
          </div>
        )}
      </div>

      {/* Suggested Quick Chips */}
      <div className="assistant-suggestions px-3 py-2 bg-[#0c0f17]/60 border-t border-white/[0.04] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q)}
            className="text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white px-2.5 py-1 rounded-full border border-white/[0.06] whitespace-nowrap cursor-pointer shrink-0 active:scale-95 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

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
            aria-label="Mensaje para el asistente"
            placeholder="Pregunta o registra un gasto..."
            className="flex-1 bg-[#141926] border border-white/[0.08] focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className="bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-950 p-2.5 rounded-xl font-bold transition-all cursor-pointer shadow active:scale-95"
            aria-label="Enviar"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
    </section>
  );
};
