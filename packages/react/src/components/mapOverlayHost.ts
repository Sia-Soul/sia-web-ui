/** 地图宿主支持订阅的视图事件名称。 */
export type MapOverlayEvent='moving'|'moveend'|'zoomend'|'resize';
/** 地图宿主当前的尺寸、中心和缩放状态快照。 */
export interface MapOverlaySnapshot {
 /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
 width:number;
 /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
 height:number;
 /** 将数据或地理坐标投影为绘图坐标。 */
 project:(coordinate:readonly [number,number])=>readonly [number,number];
 /** 相对于默认位置的偏移。 */
 offset?:readonly [number,number];
}
/** A host adapter owns only the map instance it creates, never a shared map. */
export interface MapOverlayHost {
 /** 读取地图宿主的当前视图快照。 */
 snapshot:()=>MapOverlaySnapshot;
 /** 订阅状态变化；返回的函数用于取消订阅。 */
 subscribe:(event:MapOverlayEvent,listener:()=>void)=>()=>void;
 /** 销毁地图宿主并释放事件监听及相关资源。 */
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
