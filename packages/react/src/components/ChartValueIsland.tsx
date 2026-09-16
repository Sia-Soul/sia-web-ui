import {useEffect,useRef,useState} from 'react';
import {ChartMark} from './Chart';
import {findCompositeValueTarget} from './compositeValueTransfer';
import type {ChartValueAddress} from './compositeValueTransfer';
/** 图表数据值暂存区的属性配置。 */
export interface ChartValueIslandProps{
 /** 名称或字段标识。 */
 name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value:number;
  /** 横向位置或 X 轴数据值。 */
  x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /**
   * 显示颜色，可使用 CSS 颜色值。
   * @defaultValue '#2ec7c9'
   */
  color?:string;
 /** 拖放完成时调用，提供拖拽源和目标位置。 */
 onDrop:(target:ChartValueAddress|null,point:readonly [number,number])=>void;
 /**
  * 根据当前上下文解析目标图表或数据位置。
  * @defaultValue findCompositeValueTarget
  */
 resolveTarget?:(element:SVGGElement,x:number,y:number)=>ChartValueAddress|null;
}
/** SVG island representing a value already removed from its source series. */
export function ChartValueIsland({name,value,x,y,color='#2ec7c9',onDrop,resolveTarget=findCompositeValueTarget}:ChartValueIslandProps){
 const drag=useRef<{x:number;y:number}|null>(null);
 const [offset,setOffset]=useState<readonly [number,number]>([0,0]);
 const cancel=()=>{drag.current=null;setOffset([0,0]);};
 useEffect(cancel,[x,y]);
 return <ChartMark label={`孤岛 ${name} ${value}`} tooltip={<>{name}：{value}</>} transform={`translate(${offset[0]} ${offset[1]})`} style={{cursor:'move',touchAction:'none',pointerEvents:drag.current?'none':undefined}}
  onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancel();}}}
  onLostPointerCapture={cancel}
  onPointerDown={event=>{if(event.button!==0)return;event.stopPropagation();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);drag.current={x:event.clientX,y:event.clientY};}}
  onPointerMove={event=>{const start=drag.current,matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!start||!matrix)return;const a=new DOMPoint(start.x,start.y).matrixTransform(matrix.inverse()),b=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());setOffset([b.x-a.x,b.y-a.y]);}}
  onPointerCancel={cancel}
  onPointerUp={event=>{const start=drag.current;drag.current=null;setOffset([0,0]);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);if(!start||Math.hypot(event.clientX-start.x,event.clientY-start.y)<4)return;const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!matrix)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());onDrop(resolveTarget(event.currentTarget,event.clientX,event.clientY),[point.x,point.y]);}}>
  <circle cx={x} cy={y} r={20} fill="#fff" stroke={color} strokeWidth={2}/>
  <text x={x} y={y+4} textAnchor="middle" fontSize={11}>{value}</text>
 </ChartMark>;
}
