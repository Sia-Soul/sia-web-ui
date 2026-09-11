import type {MapOverlayHost,MapOverlayEvent} from './mapOverlayHost';

export interface BaiduMapPoint {lng:number;lat:number}
export interface BaiduMapInstance {
 centerAndZoom:(point:BaiduMapPoint,zoom:number)=>void;
 enableScrollWheelZoom:()=>void;
 disableScrollWheelZoom:()=>void;
 disableDragging:()=>void;
 disableAutoResize:()=>void;
 clearOverlays:()=>void;
 getSize:()=>{width:number;height:number};
 pointToPixel:(point:BaiduMapPoint)=>{x:number;y:number};
 setMapStyle:(style:{styleJson:readonly unknown[]})=>void;
 addEventListener:(event:string,listener:()=>void)=>void;
 removeEventListener:(event:string,listener:()=>void)=>void;
}
export interface BaiduMapNamespace {
 Map:new(element:HTMLElement,options:{enableMapClick:boolean})=>BaiduMapInstance;
 Point:new(longitude:number,latitude:number)=>BaiduMapPoint;
}
export interface BaiduMapHostOptions {
 center:readonly [number,number];
 zoom:number;
 styleJson?:readonly unknown[];
 /** Optional SDK-version-specific cleanup. v2 has no documented Map.destroy API. */
 releaseMap?:(map:BaiduMapInstance)=>void;
}

/** Uses a caller-provided SDK; never loads scripts, keys or a chart runtime. */
export function createBaiduMapHost(element:HTMLElement,sdk:BaiduMapNamespace,options:BaiduMapHostOptions):MapOverlayHost {
 if(!options.center.every(Number.isFinite)||!Number.isFinite(options.zoom))throw new RangeError('百度地图中心和缩放必须为有限数值');
 const map=new sdk.Map(element,{enableMapClick:false});
 let disposed=false;
 const subscriptions=new Set<()=>void>();
 const destroy=()=>{
  if(disposed)return;disposed=true;
  try{
   for(const unsubscribe of [...subscriptions])unsubscribe();
   map.disableScrollWheelZoom();map.disableDragging();map.disableAutoResize();map.clearOverlays();
  }finally{try{options.releaseMap?.(map);}finally{element.replaceChildren();}}
 };
 try{
  map.centerAndZoom(new sdk.Point(...options.center),options.zoom);
  map.enableScrollWheelZoom();
  if(options.styleJson)map.setMapStyle({styleJson:options.styleJson});
 }catch(error){destroy();throw error;}
 return {
  snapshot:()=>{
   if(disposed)throw new Error('百度地图宿主已释放');
   const size=map.getSize();
   // The Sia overlay is a sibling of the map, so viewport pixels need no pane offset.
   return {...size,project:coordinate=>{
    if(disposed)throw new Error('百度地图宿主已释放');
    const pixel=map.pointToPixel(new sdk.Point(...coordinate));return [pixel.x,pixel.y];
   }};
  },
  subscribe:(event:MapOverlayEvent,listener)=>{
   if(disposed)throw new Error('百度地图宿主已释放');
   const invoke=()=>{if(!disposed)listener();};
   map.addEventListener(event,invoke);
   let active=true;
   const unsubscribe=()=>{if(!active)return;active=false;subscriptions.delete(unsubscribe);map.removeEventListener(event,invoke);};
   subscriptions.add(unsubscribe);return unsubscribe;
  },
  destroy,
 };
}
