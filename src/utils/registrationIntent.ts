export type ChatIntent = 'query' | 'negation' | 'registration';

export function classifyChatIntent(text: string): ChatIntent {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  // Negating a registration is different from a financial question containing "no".
  const recordingVerb = '(?:registr\\w*|anot\\w*|apunt\\w*|agreg\\w*|anad\\w*|guard\\w*)';
  const noRecording = new RegExp(`\\b(?:no|nunca|jamas|tampoco)\\s+(?:(?:me|lo|la|los|las|vayas\\s+a|quiero\\s+que|quiero|debes|deberias)\\s+)*${recordingVerb}\\b`);
  if (noRecording.test(normalized) || /\b(?:cancela|cancelar|evita|olvida)\b/.test(normalized)) return 'negation';
  if (isExplicitFinancialQuery(text)) return 'query';
  const command = /^(?:por favor[, ]+)?(?:registra|registrar|anota|anotar|apunta|apuntar|agrega|agregar|anade|anadir|guarda|guardar)\b/;
  const statement = /^(?:(?:hoy|ayer|anteayer)[, ]+)?(?:pague|gaste|compre|cene|cobre|recibi|he pagado|he gastado|he cobrado)\b/;
  return command.test(normalized) || statement.test(normalized) ? 'registration' : 'query';
}

export function isExplicitFinancialQuery(text:string){
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  return /[¿?]/.test(text)||/^(como|cuanto|cuanta|cuantos|cuantas|que|cual|cuales|puedo|puedes|podria|deberia|si)\b/.test(normalized);
}
