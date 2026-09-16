import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';
import {observeMapOverlayHost} from './mapOverlayHost';
import type {MapOverlayHost,MapOverlaySnapshot} from './mapOverlayHost';

/** 地图叠加图层的属性配置。 */
export interface ChartMapOverlayProps {
 /** Keep this factory stable. It must return an adapter for a newly owned host instance. */
 createHost:(element:HTMLDivElement)=>MapOverlayHost;
 /** 叠加图层渲染函数，接收地图宿主和视图上下文。 */
 children:(snapshot:MapOverlaySnapshot)=>ReactNode;
 /** 附加到组件根节点的 CSS 类名。 */
 className?:string;
 /** 组件根节点的内联样式。 */
 style?:CSSProperties;
 /**
  控件的无障碍名称，供屏幕阅读器识别。
  * @defaultValue '地图叠加图表'
  */
 ariaLabel?:string;
 /** 操作发生错误时调用，可用于显示业务错误提示。 */
 onError?:(error:unknown)=>void;
}

/** Mounts the external base map separately from the Sia chart's transparent overlay. */
export function ChartMapOverlay({createHost,children,className,style,ariaLabel='地图叠加图表',onError}:ChartMapOverlayProps){
 const container=useRef<HTMLDivElement>(null);
 const errorHandler=useRef(onError);errorHandler.current=onError;
 const [snapshot,setSnapshot]=useState<MapOverlaySnapshot>();
 useEffect(()=>{
  setSnapshot(undefined);
  if(!container.current)return;
  try{return observeMapOverlayHost(createHost(container.current),setSnapshot);}
  catch(error){errorHandler.current?.(error);}
 },[createHost]);
 return <div className={className} aria-label={ariaLabel} style={{position:'relative',width:'100%',height:500,...style}}>
  <div ref={container} data-map-overlay-host style={{position:'absolute',inset:0}}/>
  {snapshot?<div data-map-overlay-content style={{position:'absolute',left:0,top:0,width:snapshot.width,height:snapshot.height,pointerEvents:'none'}}>{children(snapshot)}</div>:null}
 </div>;
}
