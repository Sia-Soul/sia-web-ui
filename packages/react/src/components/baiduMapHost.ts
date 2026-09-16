import type {MapOverlayHost,MapOverlayEvent} from './mapOverlayHost';

/** 百度地图经纬度坐标点。 */
export interface BaiduMapPoint {
  /** 地理经度。 */
  lng:number;
  /** 地理纬度。 */
  lat:number}
/** 地图宿主需要的百度地图实例能力，用于视图同步和坐标投影。 */
export interface BaiduMapInstance {
 /** 设置地图中心和缩放级别。 */
 centerAndZoom:(point:BaiduMapPoint,zoom:number)=>void;
 /** 启用鼠标滚轮缩放。 */
 enableScrollWheelZoom:()=>void;
 /** 禁用鼠标滚轮缩放。 */
 disableScrollWheelZoom:()=>void;
 /** 禁用地图拖拽。 */
 disableDragging:()=>void;
 /** 禁用地图自动尺寸调整。 */
 disableAutoResize:()=>void;
 /** 清除地图覆盖物。 */
 clearOverlays:()=>void;
 /** 读取容器或地图尺寸。 */
 getSize:()=>{
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
 /** 将地理坐标转换为屏幕像素坐标。 */
 pointToPixel:(point:BaiduMapPoint)=>{
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number};
 /** 设置地图主题样式。 */
 setMapStyle:(style:{
  /** 地图 SDK 使用的 JSON 样式规则。 */
  styleJson:readonly unknown[]})=>void;
 /** 注册指定事件的监听函数。 */
 addEventListener:(event:string,listener:()=>void)=>void;
 /** 移除指定事件的监听函数。 */
 removeEventListener:(event:string,listener:()=>void)=>void;
}
/** 百度地图 SDK 的构造函数入口集合。 */
export interface BaiduMapNamespace {
 /** 地图构造函数，由接入的地图 SDK 提供。 */
 Map:new(element:HTMLElement,options:{
  /** 是否启用地图点击交互。 */
  enableMapClick:boolean})=>BaiduMapInstance;
 /** 地理坐标点构造函数。 */
 Point:new(longitude:number,latitude:number)=>BaiduMapPoint;
}
/** BaiduMapHost的配置选项。 */
export interface BaiduMapHostOptions {
 /** 中心位置。 */
 center:readonly [number,number];
 /** 缩放级别或缩放范围。 */
 zoom:number;
 /** 地图 SDK 使用的 JSON 样式规则。 */
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
