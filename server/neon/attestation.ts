import {reviewedConfiguration} from './approved';
import {NeonFailure,requireStageBAuthorization,validateControlPlane,type ReviewedTarget,type ControlPlaneEvidence} from './approval';
import {controlPlaneRequestPlan} from './validation';
import {reviewPlan} from './plans';

const verified = new WeakMap<object,{time:number;operation:string}>();
export function isAttestedTarget(target: ReviewedTarget): boolean {
  const proof=verified.get(target);
  const elapsed=proof ? performance.now()-proof.time : -1;
  return proof!==undefined && proof.operation!=='control-plane-read' && elapsed>=0 && elapsed<=300000;
}
export function releaseAttestation(target: ReviewedTarget): void {verified.delete(target);}

async function getJson(url:string,token:string):Promise<any>{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:controller.signal});
    if(!response.ok||!response.body)throw new NeonFailure('TARGET_REFUSED');
    const reader=response.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){controller.abort();throw new NeonFailure('TARGET_REFUSED');}chunks.push(value);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }finally{clearTimeout(timeout);}
}

/** The only mint for a remote-target capability. Stage A never reaches filesystem/HTTP.
 * An example JSON or caller-supplied evidence cannot mint this process-local proof.
 */
export async function authorizeConfiguredTarget(operation:string,token:string){
  requireStageBAuthorization();
  const policy=reviewedConfiguration(),plan=await reviewPlan();
  if(!policy.target||!policy.planHash||policy.planHash!==plan.planHash||!policy.operations.includes(operation)||!['control-plane-read','connect-diagnostics','bootstrap','migrate','fixtures','cleanup-fixtures'].includes(operation)||!token||/[\r\n]/.test(token)||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new NeonFailure('STAGE_B_NOT_AUTHORIZED');
  const target=Object.freeze({...policy.target});
  const [p,b,e]=await Promise.all(controlPlaneRequestPlan(target).map(url=>getJson(url,token)));
  const evidence:ControlPlaneEvidence={project:{id:p.project?.id,region_id:p.project?.region_id},branch:{id:b.branch?.id,project_id:b.branch?.project_id??target.projectId,name:b.branch?.name,default:b.branch?.default},endpoints:e.endpoints?.map((v:any)=>({id:v.id,project_id:v.project_id,branch_id:v.branch_id,host:v.host,type:v.type})),fetchedAt:new Date().toISOString()};
  validateControlPlane(target,evidence);verified.set(target,{time:performance.now(),operation});
  return {target,evidence,policy,plan};
}
