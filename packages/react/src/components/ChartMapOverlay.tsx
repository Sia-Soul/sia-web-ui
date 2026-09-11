import {useEffect,useRef,useState} from 'react';
import type {CSSProperties,ReactNode} from 'react';
import {observeMapOverlayHost} from './mapOverlayHost';
import type {MapOverlayHost,MapOverlaySnapshot} from './mapOverlayHost';

export interface ChartMapOverlayProps {
 /** Keep this factory stable. It must return an adapter for a newly owned host instance. */
 createHost:(element:HTMLDivElement)=>MapOverlayHost;
 children:(snapshot:MapOverlaySnapshot)=>ReactNode;
 className?:string;
 style?:CSSProperties;
 ariaLabel?:string;
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
