import { Transaction, BudgetPlan, Loan, Wallet, Contact } from '../types/finance';
import { DEFAULT_WALLETS } from '../constants/categories';

export const INITIAL_WALLETS: Wallet[] = DEFAULT_WALLETS;

export const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'contact-carlos',
    name: 'Carlos Ruiz',
    phoneOrEmail: 'carlos.r@email.com',
    avatarColor: 'from-blue-500 to-indigo-600',
    notes: 'Compañero de piso / Viajes',
    createdAt: '2026-09-01',
  },
  {
    id: 'contact-elena',
    name: 'Elena Gómez',
    phoneOrEmail: '+34 612 345 678',
    avatarColor: 'from-pink-500 to-rose-600',
    notes: 'Amiga cenas y ocio',
    createdAt: '2026-09-10',
  },
  {
    id: 'contact-marcos',
    name: 'Marcos Alonso',
    phoneOrEmail: 'marcos@bizum.me',
    avatarColor: 'from-emerald-500 to-teal-600',
    notes: 'Fútbol y planes deportivos',
    createdAt: '2026-09-15',
  },
];

export const INITIAL_LOANS: Loan[] = [
  {
    id: 'loan-coche-01',
    name: 'Préstamo Coche Híbrido',
    entity: 'BBVA Consumer Finance',
    principal: 14000.00,
    interestRate: 5.45,
    totalTermMonths: 48,
    startDate: '2026-01-05',
    monthlyPayment: 325.20,
    wallet: 'OPENBANK',
    code: 'E.002.001',
    notes: 'Financiación vehículo Toyota Yaris Cross',
  },
  {
    id: 'loan-reforma-02',
    name: 'Préstamo Reforma Aislamiento',
    entity: 'Banco Santander',
    principal: 6500.00,
    interestRate: 4.90,
    totalTermMonths: 24,
    startDate: '2026-04-10',
    monthlyPayment: 284.90,
    wallet: 'SANTANDER',
    code: 'E.002.001',
    notes: 'Cambio de ventanas climalit',
  },
];

export const INITIAL_BUDGET_PLANS: BudgetPlan[] = [
  // Ingresos previstos 2026-10
  { monthYear: '2026-10', code: 'L.001.001', type: 'INGRESO', plannedAmount: 2650.00 },
  { monthYear: '2026-10', code: 'L.001.002', type: 'INGRESO', plannedAmount: 300.00 },
  { monthYear: '2026-10', code: 'F.001.001', type: 'INGRESO', plannedAmount: 45.00 },
  { monthYear: '2026-10', code: 'O.001.001', type: 'INGRESO', plannedAmount: 50.00 },

  // Gastos Fijos previstos 2026-10
  { monthYear: '2026-10', code: 'F.001.001', type: 'GASTO', plannedAmount: 850.00 }, // Vivienda Alquiler
  { monthYear: '2026-10', code: 'F.001.002', type: 'GASTO', plannedAmount: 65.00 }, // Comunidad
  { monthYear: '2026-10', code: 'F.002.001', type: 'GASTO', plannedAmount: 70.00 }, // Luz
  { monthYear: '2026-10', code: 'F.002.002', type: 'GASTO', plannedAmount: 30.00 }, // Agua
  { monthYear: '2026-10', code: 'F.002.004', type: 'GASTO', plannedAmount: 45.00 }, // Internet
  { monthYear: '2026-10', code: 'F.003.001', type: 'GASTO', plannedAmount: 55.00 }, // Seguro médico
  { monthYear: '2026-10', code: 'F.003.002', type: 'GASTO', plannedAmount: 35.00 }, // Gimnasio

  // Gastos Variables previstos 2026-10
  { monthYear: '2026-10', code: 'V.001.001', type: 'GASTO', plannedAmount: 350.00 }, // Supermercado
  { monthYear: '2026-10', code: 'V.001.002', type: 'GASTO', plannedAmount: 160.00 }, // Comer fuera
  { monthYear: '2026-10', code: 'V.001.003', type: 'GASTO', plannedAmount: 40.00 }, // Domicilio
  { monthYear: '2026-10', code: 'V.002.001', type: 'GASTO', plannedAmount: 110.00 }, // Gasolina
  { monthYear: '2026-10', code: 'V.002.002', type: 'GASTO', plannedAmount: 30.00 }, // Transporte público
  { monthYear: '2026-10', code: 'V.003.001', type: 'GASTO', plannedAmount: 40.00 }, // Limpieza
  { monthYear: '2026-10', code: 'V.003.002', type: 'GASTO', plannedAmount: 35.00 }, // Aseo

  // Gastos Personales previstos 2026-10
  { monthYear: '2026-10', code: 'P.001.001', type: 'GASTO', plannedAmount: 30.00 }, // Suscripciones
  { monthYear: '2026-10', code: 'P.001.002', type: 'GASTO', plannedAmount: 60.00 }, // Copas
  { monthYear: '2026-10', code: 'P.003.001', type: 'GASTO', plannedAmount: 90.00 }, // Ropa

  // Gastos Económicos y Préstamos 2026-10
  { monthYear: '2026-10', code: 'E.001.002', type: 'GASTO', plannedAmount: 250.00 }, // Fondos indexados
  { monthYear: '2026-10', code: 'E.002.001', type: 'GASTO', plannedAmount: 610.10 }, // Préstamos (Coche + Reforma)

  // Didáctico 2026-10
  { monthYear: '2026-10', code: 'D.001.004', type: 'GASTO', plannedAmount: 40.00 }, // Libros
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // --- OCTUBRE 2026 ---
  {
    id: 'tx-oct-01',
    date: '2026-10-01',
    amount: 2650.00,
    type: 'INGRESO',
    code: 'L.001.001',
    categoryName: 'LABORALES',
    subcategoryName: 'Fijo (Nómina principal)',
    description: 'Nómina mensual Empresa Tech S.L.',
    wallet: 'SANTANDER',
    processed: true,
    notes: 'Transferencia automática de nómina',
  },
  {
    id: 'tx-oct-02',
    date: '2026-10-02',
    amount: 850.00,
    type: 'GASTO',
    code: 'F.001.001',
    categoryName: 'FIJOS - Vivienda',
    subcategoryName: 'Vivienda: Alquiler / hipoteca',
    description: 'Alquiler mensual vivienda habitual',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-03',
    date: '2026-10-03',
    amount: 65.00,
    type: 'GASTO',
    code: 'F.001.002',
    categoryName: 'FIJOS - Vivienda',
    subcategoryName: 'Vivienda: Comunidad de propietarios',
    description: 'Comunidad edificio mes octubre',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-04',
    date: '2026-10-05',
    amount: 325.20,
    type: 'GASTO',
    code: 'E.002.001',
    categoryName: 'ECONÓMICOS - Créditos y Préstamos',
    subcategoryName: 'Créditos: Cuotas de préstamos personales',
    description: 'Cuota Préstamo Coche Híbrido (10/48)',
    wallet: 'OPENBANK',
    processed: true,
    loanId: 'loan-coche-01',
  },
  {
    id: 'tx-oct-05',
    date: '2026-10-06',
    amount: 98.40,
    type: 'GASTO',
    code: 'V.001.001',
    categoryName: 'VARIABLES - Alimentación',
    subcategoryName: 'Alimentación: Supermercado',
    description: 'Compra semanal Mercadona',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-06',
    date: '2026-10-08',
    amount: 62.15,
    type: 'GASTO',
    code: 'F.002.001',
    categoryName: 'FIJOS - Suministros',
    subcategoryName: 'Suministros: Luz y electricidad',
    description: 'Factura Iberdrola periodo anterior',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-07',
    date: '2026-10-10',
    amount: 284.90,
    type: 'GASTO',
    code: 'E.002.001',
    categoryName: 'ECONÓMICOS - Créditos y Préstamos',
    subcategoryName: 'Créditos: Cuotas de préstamos personales',
    description: 'Cuota Préstamo Reforma Aislamiento (7/24)',
    wallet: 'SANTANDER',
    processed: true,
    loanId: 'loan-reforma-02',
  },
  {
    id: 'tx-oct-08',
    date: '2026-10-12',
    amount: 58.00,
    type: 'GASTO',
    code: 'V.002.001',
    categoryName: 'VARIABLES - Transporte',
    subcategoryName: 'Transporte: Gasolina / Combustible',
    description: 'Repostaje Repsol diésel',
    wallet: 'REVOLUT',
    processed: true,
  },
  {
    id: 'tx-oct-09',
    date: '2026-10-14',
    amount: 42.00,
    type: 'GASTO',
    code: 'D.001.004',
    categoryName: 'DIDÁCTICO',
    subcategoryName: 'Didáctico: Libros y material educativo',
    description: 'Libro arquitectura software y clean code',
    wallet: 'EFECTIVO',
    processed: true,
  },
  {
    id: 'tx-oct-10',
    date: '2026-10-17',
    amount: 112.50,
    type: 'GASTO',
    code: 'V.001.001',
    categoryName: 'VARIABLES - Alimentación',
    subcategoryName: 'Alimentación: Supermercado',
    description: 'Compra quincenal Carrefour',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-11',
    date: '2026-10-20',
    amount: 34.90,
    type: 'GASTO',
    code: 'F.003.002',
    categoryName: 'FIJOS - Salud y Bienestar',
    subcategoryName: 'Salud: Gimnasio',
    description: 'Cuota mensual Basic-Fit',
    wallet: 'REVOLUT',
    processed: true,
  },
  {
    id: 'tx-oct-12',
    date: '2026-10-22',
    amount: 41.30,
    type: 'INGRESO',
    code: 'F.001.001',
    categoryName: 'FINANCIEROS',
    subcategoryName: 'Rendimientos bancarios (intereses, depósitos)',
    description: 'Intereses cuenta remunerada Trade Republic',
    wallet: 'OPENBANK',
    processed: true,
  },
  {
    id: 'tx-oct-13',
    date: '2026-10-25',
    amount: 250.00,
    type: 'GASTO',
    code: 'E.001.002',
    categoryName: 'ECONÓMICOS - Ahorro e Inversión',
    subcategoryName: 'Ahorro: Fondos indexados',
    description: 'Aportación periódica Vanguard Global Stock',
    wallet: 'MYINVESTOR',
    processed: true,
  },
  {
    id: 'tx-oct-14',
    date: '2026-10-28',
    amount: 17.99,
    type: 'GASTO',
    code: 'P.001.001',
    categoryName: 'PERSONALES - Ocio',
    subcategoryName: 'Ocio: Suscripciones digitales',
    description: 'Suscripción Netflix 4K',
    wallet: 'REVOLUT',
    processed: true,
  },
  {
    id: 'tx-oct-15',
    date: '2026-10-27',
    amount: 30.00,
    type: 'GASTO',
    code: 'V.001.002',
    categoryName: 'VARIABLES - Alimentación',
    subcategoryName: 'Alimentación: Comer fuera / cafeterías',
    description: 'Cena restaurante viernes con amigos',
    wallet: 'REVOLUT',
    processed: true,
    notes: 'Cuenta compartida entre 3 personas',
    splitInfo: {
      isShared: true,
      totalParticipants: 3,
      myShare: 10.00,
      totalOwedToMe: 20.00,
      participants: [
        {
          contactId: 'contact-carlos',
          contactName: 'Carlos Ruiz',
          amount: 10.00,
          isPaid: false,
        },
        {
          contactId: 'contact-elena',
          contactName: 'Elena Gómez',
          amount: 10.00,
          isPaid: false,
        },
      ],
    },
  },
  {
    id: 'tx-oct-16',
    date: '2026-10-29',
    amount: 50.00,
    type: 'GASTO',
    code: 'P.003.001',
    categoryName: 'PERSONALES - Moda y Estética',
    subcategoryName: 'Moda y Estética: Ropa',
    description: 'Compra ropa y chaqueta compartida Zara',
    wallet: 'OPENBANK',
    processed: true,
    notes: 'Carlos paga la mitad',
    splitInfo: {
      isShared: true,
      totalParticipants: 2,
      myShare: 25.00,
      totalOwedToMe: 25.00,
      participants: [
        {
          contactId: 'contact-carlos',
          contactName: 'Carlos Ruiz',
          amount: 25.00,
          isPaid: false,
        },
      ],
    },
  },
  // Pending item
  {
    id: 'tx-oct-17',
    date: '2026-10-31',
    amount: 39.99,
    type: 'GASTO',
    code: 'F.002.004',
    categoryName: 'FIJOS - Suministros',
    subcategoryName: 'Suministros: Internet y teléfono',
    description: 'Factura Digi Fibra 1Gb (pendiente cargo)',
    wallet: 'OPENBANK',
    processed: false, // Tramitado: NO
    notes: 'Cargo previsto para fin de mes',
  },
];
