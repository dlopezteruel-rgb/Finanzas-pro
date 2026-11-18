/** Test seam only. Not exported by the product index or imported by React/Express/native entries. */
import {IdentityCoordinator, type SimulationDriver} from '../coordinator';
export function simulatedIdentity(driver: SimulationDriver, now: () => number) { return new IdentityCoordinator(driver, now); }
