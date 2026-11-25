import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {validateNeonPreparation} from '../ci/neon-report.mjs';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const r=JSON.parse(await readFile((process.env.NEON_ARTIFACT_DIR??'ci-artifacts/neon')+'/libpq-local.json','utf8'));
console.log(validateNeonPreparation(r,sha,{dockerRequired:process.env.GITHUB_ACTIONS==='true'}));
