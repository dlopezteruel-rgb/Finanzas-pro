import type {ReviewedTarget} from './approval';

/** Operational review registry, NOT an authentication/authorization token.
 * Changing environment variables or an example JSON cannot change this source registry.
 * Remains empty in stage A. Owner approval and a reviewed commit are required for B.
 */
export function reviewedConfiguration(): {
  target: ReviewedTarget | null; planHash: string | null; operations: readonly string[]; cleanupHashes: readonly string[];
} {
  return {target:null,planHash:null,operations:[],cleanupHashes:[]};
}
