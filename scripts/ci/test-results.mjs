/** Parse both Node 24 spec and TAP summaries; successful exit alone is insufficient. */
export function parseTestSummaries(text){
  const blocks=[];let current;
  const plain=text.replace(/\x1b\[[0-9;]*m/g,'');
  for(const line of plain.split(/\r?\n/)){
    const match=line.match(/^(?:ℹ|#)\s+(tests|pass|fail|cancelled|skipped|todo|suites)\s+(\d+)\s*$/);
    if(!match)continue;
    const [,field,value]=match;
    if(field==='tests'){current={};blocks.push(current);}
    if(current){if(field in current)throw new Error(`Duplicate ${field} in test summary`);current[field]=Number(value);}
  }
  return blocks;
}
export function requireCompleteTests(text,expected){
  const results=parseTestSummaries(text);
  if(results.length!==expected)throw new Error(`Expected ${expected} completed suites; received ${results.length}.`);
  for(const [index,r] of results.entries()){
    for(const key of ['tests','pass','fail','cancelled','skipped','todo'])if(!Number.isSafeInteger(r[key]))throw new Error(`Suite ${index+1}: missing/invalid ${key}.`);
    if(r.tests<1||r.tests!==r.pass||r.fail||r.cancelled||r.skipped||r.todo)throw new Error(`Suite ${index+1} incomplete: ${JSON.stringify(r)}`);
  }
  return results;
}
