import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {reviewPlan,migrationPlan,sqlFile,adminPreflightPlan} from '../../server/neon/plans';
import {NeonFailure,openRemoteValidation} from '../../server/neon/approval';

export async function main(args: string[]) {
  const [operation] = args;
  if (operation === 'plan' && args.length === 1) return JSON.stringify(await reviewPlan(),null,2);
  if (operation === 'sql' && args.length === 2) {
    if (args[1] === 'admin-preflight') return adminPreflightPlan;
    if (args[1] === 'migrate') return migrationPlan();
    if (args[1] === 'bootstrap' || args[1] === 'privileges') return sqlFile(args[1]);
  }
  if (operation === 'run') {
    // No credential/file/URL reads or fetches before this unconditional stage A denial.
    await openRemoteValidation();
    const {stageBCommand}=await import('../../server/neon/remote');
    return stageBCommand(args.slice(1));
  }
  throw new NeonFailure('CONFIGURATION');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await main(process.argv.slice(2))); }
  catch (error) { console.error(error instanceof NeonFailure ? error.message : 'NEON_CONFIGURATION'); process.exitCode = 1; }
}
