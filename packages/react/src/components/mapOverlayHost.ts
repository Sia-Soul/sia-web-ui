export type MapOverlayEvent='moving'|'moveend'|'zoomend'|'resize';
export interface MapOverlaySnapshot {
 width:number;
 height:number;
 project:(coordinate:readonly [number,number])=>readonly [number,number];
 offset?:readonly [number,number];
}
/** A host adapter owns only the map instance it creates, never a shared map. */
export interface MapOverlayHost {
 snapshot:()=>MapOverlaySnapshot;
 subscribe:(event:MapOverlayEvent,listener:()=>void)=>()=>void;
 destroy:()=>void;
}

export function observeMapOverlayHost(host:MapOverlayHost,onChange:(snapshot:MapOverlaySnapshot)=>void){
 let stopped=false;
 const cleanups:(()=>void)[]=[];
 const refresh=()=>{
  if(stopped)return;
  const snapshot=host.snapshot();
  if(!Number.isFinite(snapshot.width)||!Number.isFinite(snapshot.height)||snapshot.width<=0||snapshot.height<=0)return;
  // A host may reuse its snapshot object; React still needs a fresh update identity.
  onChange({...snapshot,offset:snapshot.offset?[...snapshot.offset]:undefined});
 };
 const dispose=()=>{
  if(stopped)return;
  stopped=true;
  try{for(const cleanup of cleanups.splice(0).reverse()){try{cleanup();}catch{/* Continue detaching the remaining listeners. */}}}
  finally{host.destroy();}
 };
 try{
  for(const event of ['moving','moveend','zoomend','resize'] as const)cleanups.push(host.subscribe(event,refresh));
  refresh();
 }catch(error){dispose();throw error;}
 return dispose;
}
