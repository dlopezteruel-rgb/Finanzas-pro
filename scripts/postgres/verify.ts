import {readFile} from 'node:fs/promises';import {execFileSync}from'node:child_process';
import {validatePostgresReport}from'../ci/postgres-report.mjs';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
console.log(JSON.stringify(validatePostgresReport(JSON.parse(await readFile(process.argv[2]??'ci-artifacts/postgres/results.json','utf8')),source,{dockerRequired:process.env.GITHUB_ACTIONS==='true'})));
