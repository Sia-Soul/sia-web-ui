import {useEffect,useRef} from 'react';
import {mapLineDuration,mapLineSample} from './mapLineGeometry';
export interface CanvasMapEffect {
 source:readonly [number,number];control:readonly [number,number];target:readonly [number,number];
 period?:number;color?:string;radius?:number;shadowBlur?:number;shadowColor?:string;
}
/** Shared raster effect surface: one animation clock and one retained image for all routes. */
export function ChartMapEffectCanvas({effects,width,height,alpha=.95}:{effects:readonly CanvasMapEffect[];width:number;height:number;alpha?:number}){
 const canvas=useRef<HTMLCanvasElement>(null),key=JSON.stringify(effects);
 useEffect(()=>{
  const element=canvas.current;if(!element)return;
  const context=element.getContext('2d');if(!context)return;
  const ratio=window.devicePixelRatio||1;
  element.width=Math.ceil(width*ratio);element.height=Math.ceil(height*ratio);
  context.setTransform(ratio,0,0,ratio,0,0);
  const rows=JSON.parse(key) as CanvasMapEffect[],durations=rows.map(row=>mapLineDuration(row.source,row.target,row.period??30));
  const started=performance.now();let frame=0,frames=0;
  const paint=(now:number)=>{
   context.save();context.globalCompositeOperation='destination-in';context.globalAlpha=Math.max(0,Math.min(1,alpha));context.fillStyle='#000';context.fillRect(0,0,width,height);context.restore();
   rows.forEach((row,index)=>{
    const point=mapLineSample(row.source,row.control,row.target,((now-started)%durations[index]!)/durations[index]!);
    context.save();context.fillStyle=row.color??'#fff';context.shadowColor=row.shadowColor??row.color??'#fff';context.shadowBlur=(row.shadowBlur??10)*ratio;
    context.beginPath();context.arc(point[0],point[1],row.radius??1,0,Math.PI*2);context.fill();context.restore();
   });
   element.dataset.effectFrame=String(++frames);frame=requestAnimationFrame(paint);
  };
  frame=requestAnimationFrame(paint);return ()=>{cancelAnimationFrame(frame);context.clearRect(0,0,width,height);};
 },[key,width,height,alpha]);
 return <foreignObject data-chart-effect-canvas="" x={0} y={0} width={width} height={height} pointerEvents="none">
  <canvas ref={canvas} data-effect-count={effects.length} style={{display:'block',width:'100%',height:'100%'}}/>
 </foreignObject>;
}
