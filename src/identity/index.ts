export type * from './contracts';
export {identityRollout} from './policy';
export {realFinancialAccess} from './coordinator';
import {IdentityCoordinator} from './coordinator';
/** No provider, credentials, storage or browser-user input can be supplied here in 7A.1. */
export function createIdentityFoundation() { return new IdentityCoordinator(); }
