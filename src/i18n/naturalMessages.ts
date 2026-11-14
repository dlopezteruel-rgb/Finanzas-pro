import type {translate} from './messages';
import {storageOwnedText} from './storageMessages';
/** Owned input diagnostics only. Input text and parser payloads are never translated. */
const keys = {
  "Una negación no prepara movimientos. Utiliza una instrucción afirmativa o el formulario manual.": "natural.error.negation",
  "Una pregunta no prepara movimientos. Utiliza el asistente para consultar.": "natural.error.question",
  "La fecha de referencia no es válida. Utiliza el formulario manual.": "natural.error.referenceDate",
  "Hay varias referencias de fecha. Indica una sola o utiliza el formulario manual.": "natural.error.multipleDates",
  "Indica la fecha con año en el formulario manual.": "natural.error.year",
  "La fecha indicada no existe. Corrígela o utiliza el formulario manual.": "natural.error.invalidDate",
  "La fecha no es inequívoca para este registro. Utiliza el formulario manual.": "natural.error.ambiguousDate",
  "Este registro utiliza euros. Revisa el importe en el formulario manual.": "natural.error.currency",
  "Indica un único importe positivo, sin separadores de miles, o utiliza el formulario manual.": "natural.error.oneAmount",
  "El importe es ambiguo o negativo. Usa, por ejemplo, 2650 o 15,50; también puedes utilizar el formulario manual.": "natural.error.ambiguousAmount",
  "El importe debe ser positivo y representable en céntimos. Utiliza el formulario manual.": "natural.error.positiveAmount"
} as const;
export function naturalInputText(value:string,t:typeof translate):string{return Object.hasOwn(keys,value)?t(keys[value as keyof typeof keys]):storageOwnedText(value,t);}
