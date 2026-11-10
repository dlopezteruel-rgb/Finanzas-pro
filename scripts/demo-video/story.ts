export const SCENES = [
  {
    id: "01",
    slug: "inicio",
    title: "Presentación y resumen inicial",
    seconds: 15,
    action:
      "Resumen real de Inicio, patrimonio, presupuesto restante y navegación.",
    voice:
      "Controlar tus finanzas no tiene por qué ser complicado. Con FinanZas tienes tus cuentas, tu presupuesto y tus últimos movimientos en un solo lugar. Una visión clara para entender tu dinero y empezar a organizarte.",
  },
  {
    id: "02",
    slug: "cuentas",
    title: "Cuentas y situación financiera",
    seconds: 17,
    action:
      "Saldos de tres carteras, consulta de una cuenta y vista previa cancelada de un traspaso.",
    voice:
      "Consulta cuánto dinero tienes en tu cuenta principal, en tus ahorros y en efectivo. Revisa cada cartera y prepara un traspaso entre tus propias cuentas. Antes de confirmarlo, puedes comprobar su importe y cómo quedarán los saldos.",
  },
  {
    id: "03",
    slug: "movimientos",
    title: "Registro de movimientos",
    seconds: 20,
    action:
      "Propuesta local de supermercado de 32,50 €, selección de cuenta/partida, confirmación y tramitación en el registro.",
    voice:
      "Registra lo que gastas y asígnalo a una categoría. Por ejemplo, una compra de supermercado de treinta y dos euros con cincuenta. Revisa la cuenta, el importe y el estado antes de confirmar. Después, distingue lo pendiente de lo que ya está tramitado.",
  },
  {
    id: "04",
    slug: "presupuestos",
    title: "Planificación y presupuesto",
    seconds: 20,
    action:
      "Previsiones, objetivo de ahorro de 500 €, modificación de supermercado y aprobación explícita.",
    voice:
      "Planifica tus ingresos y gastos y decide cuánto quieres ahorrar cada mes. Ajusta las partidas a tus necesidades y comprueba al momento el balance previsto. Cuando tengas clara la distribución, revisa y aprueba tu planificación. Así podrás comparar lo previsto con lo que realmente ocurre.",
  },
  {
    id: "05",
    slug: "periodicos",
    title: "Movimientos periódicos",
    seconds: 18,
    action:
      "Tres reglas, ocurrencia de diciembre, revisión y registro pendiente sin cambiar el saldo.",
    voice:
      "Organiza la nómina, el alquiler y las suscripciones que se repiten cada mes. FinanZas prepara las próximas ocurrencias para que puedas revisarlas. Tú decides cuáles registrar. Se crean pendientes: el saldo de la cuenta solo cambia cuando el movimiento se tramita.",
  },
  {
    id: "06",
    slug: "compartidos",
    title: "Contactos y gastos compartidos",
    seconds: 17,
    action:
      "Contacto ficticio, reintegro parcial y reparto real de una comida de 90 € entre tres personas.",
    voice:
      "¿Has pagado una comida entre amigos? Reparte el gasto y consulta cuánto corresponde a cada persona. Si alguien te devuelve solo una parte, puedes seguir viendo lo que ya has recibido y lo que queda pendiente, sin perder el detalle del reparto.",
  },
  {
    id: "07",
    slug: "deudas",
    title: "Deudas y préstamos personales",
    seconds: 17,
    action:
      "Me deben/Debo, principal pendiente, liquidación parcial y enlace al movimiento protegido.",
    voice:
      "Lleva el seguimiento de los préstamos que has concedido y de tus compromisos pendientes. Consulta los cobros y pagos parciales, su historial y el movimiento vinculado. Las devoluciones de principal se mantienen separadas de tus ingresos y gastos habituales.",
  },
  {
    id: "08",
    slug: "tesoreria",
    title: "Previsión de tesorería",
    seconds: 18,
    action:
      "Saldo líquido, entradas/salidas y proyección orientativa de los próximos 30 días.",
    voice:
      "Anticípate a los próximos pagos. La previsión de tesorería reúne el saldo actual y los flujos conocidos de las próximas semanas para mostrarte una disponibilidad estimada. Revisa las fechas y el origen de cada importe: es una orientación para planificar, no un saldo garantizado.",
  },
  {
    id: "09",
    slug: "asistente",
    title: "Asistente financiero",
    seconds: 21,
    action:
      "Dos preguntas locales deterministas sobre disponibilidad y ahorro adicional, sin escrituras.",
    voice:
      "Cuando necesites entender mejor tus números, pregunta a tu asistente. Consulta cuánto tienes disponible o qué partidas podrías revisar para ahorrar ciento cincuenta euros más. Las respuestas de esta demostración se calculan con los datos guardados, distinguen previsiones y saldos y no modifican tu información.",
  },
  {
    id: "10",
    slug: "cierre",
    title: "Control de datos y cierre",
    seconds: 12,
    action: "Exportación real de un JSON ficticio y vuelta a Inicio.",
    voice:
      "Tus datos siguen bajo tu control. Puedes exportar una copia y conservar tu información. FinanZas: entiende tu dinero, organiza tus gastos y planifica con tranquilidad.",
  },
] as const;
