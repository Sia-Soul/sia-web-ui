import {useEffect,useRef} from 'react';
import {largeMapPointPulse,largeMapPointSize} from './largeMapPointPulse';
/** 使用 Canvas 批量绘制的地图点分组。 */
export interface LargeMapPointCanvasGroup {
  /** 名称或字段标识。 */
  name:string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color:string;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size:number;
  /** 数据点或节点使用的图形符号。 */
  symbol:'rect'|'diamond';
  /** 数据点集合。 */
  points:readonly (readonly [number,number])[]}
/** One retained raster surface, with twenty independent pulse channels per series. */
export function ChartLargeMapPointCanvas({groups,width,height}:{groups:readonly LargeMapPointCanvasGroup[];width:number;height:number}){
 const canvas=useRef<HTMLCanvasElement>(null),key=JSON.stringify(groups);
 useEffect(()=>{
  const element=canvas.current,context=element?.getContext('2d');if(!element||!context)return;
  const ratio=window.devicePixelRatio||1;element.width=Math.ceil(width*ratio);element.height=Math.ceil(height*ratio);context.setTransform(ratio,0,0,ratio,0,0);
  const rows=JSON.parse(key) as LargeMapPointCanvasGroup[];
  element.dataset.effectFrame='0';
  // An empty selection must not run a perpetual raster animation.
  if(!rows.some(group=>group.points.length))return;
  const channels=rows.map(()=>Array.from({length:20},(_,i)=>({initial:Math.random(),delay:Math.random()*1500*i})));
  const started=performance.now();let request=0,frames=0;
  const paint=(now:number)=>{
   context.save();context.globalCompositeOperation='destination-in';context.globalAlpha=.95;context.fillStyle='#000';context.fillRect(0,0,width,height);context.restore();
   rows.forEach((group,groupIndex)=>{
    const sizes=channels[groupIndex]!.map(channel=>largeMapPointSize(group.size,largeMapPointPulse(now-started,15,channel.initial,channel.delay)));
    context.save();context.fillStyle=group.color;context.shadowColor=group.color;context.shadowBlur=4*ratio;context.beginPath();
    group.points.forEach(([x,y],i)=>{const size=sizes[i%20]!,r=size/2;if(size<3||group.symbol==='rect'){context.rect(x-r,y-r,size,size);return;}
     context.moveTo(x,y-r);context.lineTo(x+r/3,y-r/3);context.lineTo(x+r,y);context.lineTo(x+r/3,y+r/3);context.lineTo(x,y+r);context.lineTo(x-r/3,y+r/3);context.lineTo(x-r,y);context.lineTo(x-r/3,y-r/3);context.closePath();
    });context.fill();context.restore();
   });
   element.dataset.effectFrame=String(++frames);request=requestAnimationFrame(paint);
  };request=requestAnimationFrame(paint);return ()=>{cancelAnimationFrame(request);context.clearRect(0,0,width,height);};
 },[key,width,height]);
 return <foreignObject data-chart-effect-canvas="" x={0} y={0} width={width} height={height} pointerEvents="none"><canvas ref={canvas} data-large-map-point-count={groups.reduce((n,g)=>n+g.points.length,0)} data-large-map-groups={JSON.stringify(groups.map(g=>({name:g.name,count:g.points.length,coordinateTotals:g.points.reduce((s,p)=>[s[0]!+p[0],s[1]!+p[1]],[0,0])})))} style={{display:'block',width:'100%',height:'100%'}}/></foreignObject>;
}
