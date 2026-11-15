type IdleHost={now:()=>number;request:(callback:(deadline:Pick<IdleDeadline,'timeRemaining'>)=>void)=>number;cancel:(id:number)=>void};

/** Wait for real idle capacity, never force work or retry a failed download.
 * Intent expires after1s/60 idle opportunities and is cancelled on blur/use. */
export function waitForPreloadIdle(task:()=>void,host:IdleHost){
 let waiting=true,id:number|undefined,checks=0;const start=host.now();
 const request=()=>{if(!waiting)return;try{id=host.request(run);}catch{waiting=false;}};
 const run=(deadline:Pick<IdleDeadline,'timeRemaining'>)=>{
  id=undefined;if(!waiting)return;
  if(host.now()-start>=1000||++checks>60){waiting=false;return;}
  if(deadline.timeRemaining()>=10){waiting=false;task();}else request();
 };
 request();
 return ()=>{waiting=false;if(id!==undefined)try{host.cancel(id);}catch{/* Unavailable cancellation never authorizes the task. */}};
}
