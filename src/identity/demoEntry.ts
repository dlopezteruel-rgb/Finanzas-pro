/** Optional beta composition. Retiring this entry never changes the auth coordinator or any financial profile. */
import type {IdentityCoordinator} from './coordinator';
import type {IdentityState} from './contracts';
import {openIsolatedDemo, type IsolatedDemo} from './demo';
import {disabledDemoPolicy, type DemoPolicy} from './policy';
export {openIsolatedDemo} from './demo';
export {disabledDemoPolicy, demoAvailable, demoRouteDecision} from './policy';
export type {IsolatedDemo, DemoAction} from './demo';
export function createDemoMode(identity: IdentityCoordinator) {
  let demo: IsolatedDemo | undefined, closed = false;
  const disposeDemo = () => { demo?.close(); demo = undefined; };
  // Any auth transition closes the sandbox, without transferring a document or credential.
  const unsubscribe = identity.subscribe(disposeDemo);
  return Object.freeze({
    get state(): IdentityState {
      if (closed) return {status: 'signed-out'};
      if (demo && !demo.isOpen()) disposeDemo();
      return demo ? {status: 'isolated-demo', dataClass: 'fictitious', persistence: 'none'} : identity.state;
    },
    enter(policy: () => DemoPolicy = () => disabledDemoPolicy) {
      if (closed) throw new Error('DEMO_MODE_CLOSED');
      disposeDemo(); identity.clearLocalSession();
      demo = openIsolatedDemo(policy);
      return demo;
    },
    leave() { disposeDemo(); },
    close() { if (!closed) { closed = true; disposeDemo(); unsubscribe(); } },
  });
}
