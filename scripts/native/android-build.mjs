import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {constants} from 'node:fs';

if(process.argv.length!==2)throw Error('This command builds only the unsigned prototype debug variant.');
await access('android/gradlew',constants.X_OK);
const child=spawn('./gradlew',['assembleDebug','--no-daemon','--console=plain','--max-workers=1'],{cwd:'android',stdio:'inherit',env:process.env});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('close',(code,signal)=>{process.exitCode=signal?1:code??1;});
