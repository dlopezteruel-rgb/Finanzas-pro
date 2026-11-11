import React, { createContext, useContext, useEffect } from 'react';

export const languages = {
  es: { locale: 'es-ES', label: 'Español', status: 'ready' },
  en: { locale: 'en-GB', label: 'English', status: 'planned' },
  it: { locale: 'it-IT', label: 'Italiano', status: 'planned' },
  fr: { locale: 'fr-FR', label: 'Français', status: 'planned' },
  pt: { locale: 'pt-PT', label: 'Português', status: 'planned' },
} as const;
export type Language = keyof typeof languages;
export const es = {
  'common.skip': 'Ir al contenido',
  'nav.label': 'Navegación principal', 'nav.home': 'Inicio', 'nav.movements': 'Movimientos',
  'nav.budgets': 'Presupuestos', 'nav.accounts': 'Cuentas', 'nav.contacts': 'Contactos',
  'nav.debts': 'Deudas', 'nav.assistant': 'Asistente', 'nav.more': 'Más', 'nav.moreTitle': 'Más opciones',
  'nav.close': 'Cerrar opciones', 'brand.description': 'Tu dinero, con claridad',
  'loading.title': 'Preparando FinanZas', 'loading.description': 'Cargando la aplicación en este dispositivo.',
  'loading.error': 'No se ha podido cargar la aplicación.', 'loading.retry': 'Volver a intentar',
  'loading.safe': 'Volver a intentarlo no borra ni sustituye tus datos guardados.', 'loading.back': 'Volver al inicio',
  'recovery.title': 'Revisa el almacenamiento de este dispositivo', 'recovery.back': 'Volver a la presentación',
  'recovery.blocked': 'El navegador no permite leer el almacenamiento. Conserva este perfil y revisa sus permisos; no se han borrado datos.',
  'landing.eyebrow': 'FINANZAS PERSONALES, A TU RITMO', 'landing.title': 'Entiende tu dinero. Decide con tranquilidad.',
  'landing.description': 'Organiza tus cuentas, registra tus movimientos y prepara tu presupuesto en un lugar claro y sencillo.',
  'landing.open': 'Abrir FinanZas', 'landing.details': 'Conoce cómo funciona',
  'landing.local': 'Tus finanzas se guardan en este navegador. Exporta una copia para conservarlas o trasladarlas.',
  'landing.preview': 'Vista real de FinanZas con datos ficticios de demostración.',
  'landing.previewAlt': 'Inicio de FinanZas: resumen de cuentas y presupuesto con datos ficticios',
  'landing.dataEyebrow': 'SIN LETRA PEQUEÑA SOBRE TUS FINANZAS',
  'landing.benefits': 'Lo importante, a la vista',
  'landing.accountsTitle': 'Cada cuenta, bajo control', 'landing.accountsBody': 'Consulta saldos y movimientos y distingue lo pendiente de lo tramitado.',
  'landing.budgetTitle': 'Un plan para tu mes', 'landing.budgetBody': 'Distribuye ingresos y gastos, fija un objetivo de ahorro y revisa tus previsiones antes de aprobarlas.',
  'landing.futureTitle': 'Anticípate con perspectiva', 'landing.futureBody': 'Revisa deudas y pagos próximos con una previsión de tesorería orientativa.',
  'landing.dataTitle': 'Conoce dónde están tus datos',
  'landing.dataBody': 'Esta versión utiliza almacenamiento local del navegador y copias JSON. No hay cuentas de usuario ni sincronización en la nube o con bancos. Borrar los datos del navegador puede eliminar la información local.',
  'landing.assistantBody': 'Las consultas financieras compatibles se calculan localmente. Otras preguntas pueden recurrir a un servicio externo de IA si el servidor está configurado; la aplicación conserva un resumen local como alternativa.',
  'landing.notice': 'La previsión es una estimación, no un saldo garantizado. Ninguna consulta registra movimientos sin tu confirmación.',
  'landing.footer': 'FinanZas · Finanzas personales con criterio.',
} as const;
export type MessageKey = keyof typeof es;
export type Messages = Record<MessageKey, string>;
// Other languages remain unavailable until complete dictionaries and flows pass QA.
const dictionaries: Partial<Record<Language, Messages>> = { es };
export function activeLanguage(requested: string): Language {
  return Object.hasOwn(languages, requested) && dictionaries[requested as Language] ? requested as Language : 'es';
}
const Context = createContext({ language: 'es' as Language, t: (key: MessageKey): string => es[key] });
export function I18nProvider({ children, requested = 'es' }: { children: React.ReactNode; requested?: string }) {
  const language = activeLanguage(requested), dictionary = dictionaries[language]!;
  useEffect(() => { document.documentElement.lang = languages[language].locale; }, [language]);
  return <Context.Provider value={{ language, t: key => dictionary[key] }}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);

/** Presentation only; never parse these strings or change accounting currency/timezone. */
export const presentationMoney = (amount: number, language: Language = 'es') => new Intl.NumberFormat(languages[language].locale, { style: 'currency', currency: 'EUR' }).format(amount);
export const presentationDate = (date: Date, language: Language = 'es') => new Intl.DateTimeFormat(languages[language].locale, { timeZone: 'Europe/Madrid', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
