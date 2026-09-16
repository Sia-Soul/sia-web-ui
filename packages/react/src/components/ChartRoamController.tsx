import {useEffect,useRef,useState} from 'react';
/** 图表漫游控制器的属性配置。 */
export interface ChartRoamControllerProps {
 /**
  * 横向位置或 X 轴数据值。
  * @defaultValue 800
  */
 x?:number;
  /**
   * 纵向位置或 Y 轴数据值。
   * @defaultValue 5
   */
  y?:number;
  /** 视图平移时调用。 */
  onPan:(x:number,y:number)=>void;
  /** 视图缩放时调用。 */
  onZoom:(factor:number)=>void;
}
/** Independent SVG controls; deliberately separate from direct map gestures. */
export function ChartRoamController({x=800,y=5,onPan,onZoom}:ChartRoamControllerProps){
 const [hovered,setHovered]=useState<string>(),[focused,setFocused]=useState<string>();
 const timer=useRef<ReturnType<typeof setInterval>>();
 const stop=()=>{if(timer.current!==undefined)clearInterval(timer.current);timer.current=undefined;};
 useEffect(()=>{window.addEventListener('blur',stop);return ()=>{stop();window.removeEventListener('blur',stop);};},[]);
 const controls=[{name:'地图向上导航',text:'>',rotation:-90,repeat:true,action:()=>onPan(0,15)},{name:'地图向左导航',text:'>',rotation:180,repeat:true,action:()=>onPan(15,0)},{name:'地图向右导航',text:'>',rotation:0,repeat:true,action:()=>onPan(-15,0)},{name:'地图向下导航',text:'>',rotation:90,repeat:true,action:()=>onPan(0,-15)},{name:'地图放大',text:'+',rotation:0,repeat:false,action:()=>onZoom(1.2)},{name:'地图缩小',text:'-',rotation:0,repeat:false,action:()=>onZoom(1/1.2)}];
 const diagonal=40/Math.sqrt(2);
 return <g transform={`translate(${x} ${y})`} aria-label="地图方向与缩放控制器">{controls.map(item=><g key={item.name} transform={item.repeat?`rotate(${item.rotation} 40 40)`:`translate(${item.text==='+'?17.5:62.5} 102.5)`} role="button" tabIndex={0} aria-label={item.name} fill={hovered===item.name||focused===item.name?'#5077bd':'#6495ed'} style={{cursor:'pointer',pointerEvents:'all',touchAction:'none'}} onPointerEnter={()=>setHovered(item.name)} onFocus={()=>setFocused(item.name)} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();stop();item.action();if(item.repeat)timer.current=setInterval(item.action,100);}} onPointerUp={stop} onPointerLeave={()=>{setHovered(undefined);stop();}} onPointerCancel={stop} onBlur={()=>{setFocused(undefined);stop();}} onClick={event=>{if(event.detail===0)item.action();}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();item.action();}}}>
  {item.repeat?<><path d={`M40 40 L${40+diagonal} ${40-diagonal} A40 40 0 0 1 ${40+diagonal} ${40+diagonal} Z`}/><text x={64} y={39.5} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="Arial" fontSize={20} pointerEvents="none">{item.text}</text></>:<><circle r={17.5}/><text y={-2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="Verdana" fontSize={17} pointerEvents="none">{item.text}</text></>}
 </g>)}</g>;
}
