import {useEffect,useState} from 'react';

/** 图表旋转加载的属性配置。 */
export interface ChartWhirlingLoadingProps {
 /**
  * 宽度；数值按像素处理，字符串可使用 CSS 尺寸。
  * @defaultValue 720
  */
 width?:number;
 /**
  * 高度；数值按像素处理，字符串可使用 CSS 尺寸。
  * @defaultValue 360
  */
 height?:number;
 /**
  * 显示文本。
  * @defaultValue '数据获取中'
  */
 text?:string;
 /** Measured text width in viewBox units; omitted uses a CJK-aware estimate. */
 textWidth?:number;
 /** Deterministic frame for previews/tests. Live mode advances every 50 ms. */
 frame?:number;
}

/** A native SVG chart loading layer: ring, rotating droplet and fixed inner dot. */
export function ChartWhirlingLoading({width=720,height=360,text='数据获取中',textWidth,frame}:ChartWhirlingLoadingProps){
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  if(frame!=null)return;
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer:ReturnType<typeof setInterval>|undefined;
  const sync=()=>{if(timer)clearInterval(timer);timer=undefined;if(!media.matches)timer=setInterval(()=>setTick(value=>value+1),50);};
  sync();media.addEventListener('change',sync);
  return ()=>{if(timer)clearInterval(timer);media.removeEventListener('change',sync);};
 },[frame]);
 const labelWidth=textWidth??Array.from(text).reduce((sum,char)=>sum+(char.charCodeAt(0)>255?12:7),0);
 const x=Math.floor((width-labelWidth-46)/2)+18,y=Math.floor((height-36)/2)+18;
 const angle=(frame??tick)*.3*180/Math.PI;
 return <svg className="sia-chart-whirling-loading" role="status" aria-label={text} viewBox={`0 0 ${width} ${height}`} style={{position:'absolute',inset:0,width:'100%',height:'100%',zIndex:10}}>
  <rect width={width} height={height} fill="rgba(250,250,250,0.8)"/>
  <g transform={`translate(${x} ${y})`}>
   <circle r={15} fill="none" stroke="#555" strokeWidth={6}/>
   <path data-whirling-droplet="" d="M0 9 C9 9 13.5 -3 0 -15 C-13.5 -3 -9 9 0 9 Z" fill="#6cf" transform={`rotate(${angle})`}/>
   <circle r={3} fill="#fff"/>
  </g>
  <text x={x+28} y={y} dominantBaseline="central" fill="#888" style={{font:'normal normal 12px 微软雅黑, Arial, Verdana, sans-serif'}}>{text}</text>
 </svg>;
}
