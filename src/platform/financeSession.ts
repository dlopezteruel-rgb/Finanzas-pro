import type {FinanceBinding} from './financeBinding';
import type {DurableFinanceController} from './vault/protocol';
/** Services come from the actual platform entry, never user-agent heuristics. */
export function financeSession(services:{prototype:boolean;finance:FinanceBinding;durable?:DurableFinanceController}){
 if(services.prototype){
  if(services.finance.open)throw Error('VAULT_DISABLED');
  return services.durable?{kind:'native' as const,controller:services.durable}:{kind:'prototype' as const};
 }
 if(services.durable||!services.finance.open)throw Error('WEB_UNAVAILABLE');
 return {kind:'web' as const,open:services.finance.open};
}
