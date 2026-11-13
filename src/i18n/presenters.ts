import type {translate} from './messages';

/** Only call for labels returned by catalogDependencies; never for names or user fields. */
const catalogDependencyKeys={
 'Movimientos (también pendientes)':'catalog_dependency.transactions',
 'Previsiones mensuales':'catalog_dependency.monthlyPlans',
 'Préstamos':'catalog_dependency.loans',
 'Identidades de subítems':'catalog_dependency.subitems',
 'Desgloses mensuales':'catalog_dependency.monthlyBreakdowns',
 'Aprobaciones e histórico':'catalog_dependency.approvals',
 'Reglas de planificación':'catalog_dependency.planningRules',
 'Procedencia de planificación':'catalog_dependency.planningOrigins',
 'Arrastres':'catalog_dependency.carryovers',
 'Movimientos periódicos (también retirados)':'catalog_dependency.recurringRules',
} as const;
export function catalogDependencyText(value:string,t:typeof translate):string{
 return Object.hasOwn(catalogDependencyKeys,value)?t(catalogDependencyKeys[value as keyof typeof catalogDependencyKeys]):value;
}
