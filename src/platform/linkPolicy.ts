/** External navigation only. This never authorizes an API or sends finance data. */
export function externalHttpsLink(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}}
