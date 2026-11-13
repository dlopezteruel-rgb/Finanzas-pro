import { p2c } from './es.p2c';
import { p2b } from './es.p2b';
import { p2a } from './es.p2a';
import { p1g } from './es.p1g';
import { p1f } from './es.p1f';
import { p1e } from './es.p1e';
import { p1d } from './es.p1d';
import { p1c } from './es.p1c';
import { p1b } from './es.p1b';
import { plurals } from './es.plurals';
import { p1 } from './es.p1';
export const es = {
  ...p1,
  ...p1b,
  ...p1c,
  ...p1d,
  ...p1e,
  ...p1f,
  ...p1g,
  ...p2a,
  ...p2b,
  ...p2c,
  ...plurals,
  'document.title': 'FinanZas Pro - Asistente Financiero Personal',
  'document.description': 'Control financiero integral: registro inteligente por lenguaje natural, estructura de partidas presupuestarias, balance previsto vs ejecutado, control de deudas y carteras.',
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
  'common.confirmDelete': 'Confirmar eliminación', 'common.confirmReplace': 'Confirmar sustitución', 'common.saving': 'Guardando…',
  'common.confirm': 'Confirmar', 'common.cancel': 'Cancelar', 'common.close': 'Cerrar',
  'form.walletName': 'Nombre de la cuenta',
  'common.name': 'Nombre', 'common.save': 'Guardar', 'common.required': 'Campo obligatorio',
  'common.error': 'No se ha podido guardar. Revisa los datos e inténtalo de nuevo.',
  'options.title': 'Opciones y datos', 'options.export': 'Exportar JSON', 'options.import': 'Importar JSON',
  'options.recovery': 'Copias de recuperación', 'options.demo': 'Restablecer datos demo',
  'options.clear': 'Limpiar todo (Borrar datos)',
  'language.label': 'Idioma', 'language.available': 'disponible', 'language.planned': 'próximamente',
  'language.help': 'Los demás idiomas estarán disponibles cuando sus traducciones estén verificadas.',
  'language.storageError': 'La preferencia se mantiene en esta pestaña, pero no se ha podido guardar en este navegador.',
  'theme.switch': 'Cambiar a modo {mode}', 'theme.title': 'Modo {mode}',
  'theme.light': 'claro', 'theme.dark': 'oscuro',
} as const;
