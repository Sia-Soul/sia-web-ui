import {useEffect,useMemo,useRef} from 'react';
import {bundleEdges} from './edgeBundling';
import type {BundleEdge,BundlePoint} from './edgeBundling';
import {smoothBundledPath,sampleBundledPath} from './bundledPath';
/** 地图捆绑路径数据及其视觉和动画配置。 */
export interface BundledMapLines {
 /** 节点之间的边集合。 */
 edges:readonly BundleEdge[];
  /** 数据点集合。 */
  points?:readonly BundlePoint[];
  /** 曲线平滑程度。 */
  smoothness?:number;
 /** 显示颜色，可使用 CSS 颜色值。 */
 color?:string;
  /** 透明度，0 为完全透明，1 为完全不透明。 */
  opacity?:number;
  /** 线条粗细。 */
  lineWidth?:number;
  /** 数据点颜色。 */
  pointColor?:string;
  /** 数据点半径。 */
  pointRadius?:number;
 /** 滚动或淡入效果 */
 effect?:{
  /** 周期动画的周期时长。 */
  period?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 图形半径或圆角配置。 */
  radius?:number;
  /** 阴影模糊半径。 */
  shadowBlur?:number;
  /** 阴影颜色。 */
  shadowColor?:string;
  /** 透明度或布局迭代的衰减参数。 */
  alpha?:number};
}
/** Batched static strokes and one shared retained animation canvas, with no per-edge DOM. */
export function ChartBundledMapCanvas({edges,points=[],smoothness=.1,color='rgba(2,166,253,0.05)',opacity=.2,lineWidth=.5,pointColor='rgba(255,0,0,0.5)',pointRadius=1.5,effect,width,height}:BundledMapLines&{width:number;height:number}){
 const signature=JSON.stringify(edges),pointKey=JSON.stringify(points),effectKey=JSON.stringify(effect);
 const paths=useMemo(()=>bundleEdges(JSON.parse(signature) as BundleEdge[]).map(row=>({index:row.index,curves:smoothBundledPath(row.points,smoothness)})),[signature,smoothness]);
 const base=useRef<HTMLCanvasElement>(null),moving=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const node=base.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
  const ratio=window.devicePixelRatio||1;node.width=Math.ceil(width*ratio);node.height=Math.ceil(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.strokeStyle=color;ctx.globalAlpha=opacity;ctx.lineWidth=lineWidth;ctx.beginPath();
  for(const path of paths){const first=path.curves[0];if(!first)continue;ctx.moveTo(...first.start);for(const c of path.curves)ctx.bezierCurveTo(...c.c1,...c.c2,...c.end);}ctx.stroke();
  ctx.globalAlpha=1;ctx.fillStyle=pointColor;for(const p of JSON.parse(pointKey) as BundlePoint[]){ctx.beginPath();ctx.arc(p[0],p[1],pointRadius,0,Math.PI*2);ctx.fill();}
 },[paths,pointKey,width,height,color,opacity,lineWidth,pointColor,pointRadius]);
 useEffect(()=>{const node=moving.current,ctx=node?.getContext('2d');if(!node||!ctx)return;
  const ratio=window.devicePixelRatio||1;node.width=Math.ceil(width*ratio);node.height=Math.ceil(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  if(!effectKey)return;const settings=JSON.parse(effectKey) as NonNullable<BundledMapLines['effect']>;
  const history=document.createElement('canvas');history.width=node.width;history.height=node.height;const retained=history.getContext('2d');if(!retained)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)'),started=performance.now();let frame=0,ticks=0;
  const draw=(now:number)=>{
   retained.globalCompositeOperation='copy';retained.drawImage(node,0,0);ctx.clearRect(0,0,width,height);
   ctx.save();ctx.shadowBlur=0;ctx.globalAlpha=settings.alpha??.95;ctx.drawImage(history,0,0,width,height);ctx.restore();
   ctx.fillStyle=settings.color??'rgba(204,246,255,0.09)';ctx.shadowBlur=(settings.shadowBlur??1)*ratio;ctx.shadowColor=settings.shadowColor??color;ctx.beginPath();
   const radius=settings.radius??1;
   for(const path of paths){const total=path.curves.at(-1)?.until??0;if(!total)continue;const duration=Math.max(1,total*(settings.period??40)),progress=motion.matches?0:Math.max(0,now-started)%duration/duration,p=sampleBundledPath(path.curves,progress);ctx.moveTo(p[0]+radius,p[1]);ctx.arc(p[0],p[1],radius,0,Math.PI*2);}ctx.fill();ctx.shadowBlur=0;node.dataset.effectFrame=String(++ticks);
   if(!motion.matches)frame=requestAnimationFrame(draw);
  };
  const restart=()=>{cancelAnimationFrame(frame);ctx.clearRect(0,0,width,height);frame=requestAnimationFrame(draw);};restart();motion.addEventListener('change',restart);
  return ()=>{cancelAnimationFrame(frame);motion.removeEventListener('change',restart);ctx.clearRect(0,0,width,height);};
 },[paths,effectKey,width,height,color]);
 return <g data-bundled-map="" data-bundled-count={paths.length} data-bundled-segments={paths.reduce((n,p)=>n+p.curves.length,0)}>
  <foreignObject x={0} y={0} width={width} height={height} pointerEvents="none"><canvas ref={base} data-bundled-static="" data-point-count={points.length} style={{display:'block',width:'100%',height:'100%'}}/></foreignObject>
  <foreignObject x={0} y={0} width={width} height={height} pointerEvents="none"><canvas ref={moving} data-bundled-effects="" style={{display:'block',width:'100%',height:'100%'}}/></foreignObject>
 </g>;
}
