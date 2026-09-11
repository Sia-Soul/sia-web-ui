import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {BarSeries} from './Charts';
import {transferBarValue} from './barTransfer';
import type {CartesianIsland} from './cartesianTransfer';

export function useBarValueTransfer(series:readonly BarSeries[],initial:readonly BarSeries[],categories:readonly string[],enabled:boolean,publish:(next:readonly BarSeries[])=>void,onError?:(message:string)=>void){
 const [islands,setIslands]=useState<(CartesianIsland&{x:number;y:number})[]>([]);
 const drag=useRef<{series:number;index:number;x:number;y:number;moved:boolean}>();
 const [offset,setOffset]=useState<{series:number;index:number;x:number;y:number}>();
 useEffect(()=>{setIslands([]);drag.current=undefined;setOffset(undefined);},[initial]);
 const reset=()=>{setIslands([]);drag.current=undefined;setOffset(undefined);};
 function props(row:number,index:number){
  if(!enabled)return {};
  const moving=offset?.series===row&&offset.index===index;
  return {
   'data-bar-transfer-series':row,'data-bar-transfer-index':index,
   style:{cursor:'move',touchAction:'none',pointerEvents:moving?'none' as const:undefined},
   transform:moving?`translate(${offset.x} ${offset.y})`:undefined,
   onPointerDown:(event:PointerEvent<SVGGElement>)=>{
    const datum=series[row]?.data[index],value=typeof datum==='number'?datum:datum?.value;
    if(event.button!==0||row>=0&&(!Number.isFinite(value)||typeof datum==='object'&&datum.hidden))return;
    event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={series:row,index,x:event.clientX,y:event.clientY,moved:false};
   },
   onPointerMove:(event:PointerEvent<SVGGElement>)=>{
    const source=drag.current;if(!source||source.series!==row||source.index!==index)return;
    if(!source.moved&&Math.hypot(event.clientX-source.x,event.clientY-source.y)<4)return;
    const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();if(!matrix)return;
    source.moved=true;const a=new DOMPoint(source.x,source.y).matrixTransform(matrix.inverse()),b=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());setOffset({series:row,index,x:b.x-a.x,y:b.y-a.y});
   },
   onPointerCancel:()=>{drag.current=undefined;setOffset(undefined);},
   onPointerUp:(event:PointerEvent<SVGGElement>)=>{
    const source=drag.current;drag.current=undefined;setOffset(undefined);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!source?.moved)return;
    const svg=event.currentTarget.ownerSVGElement;
    const hit=document.elementsFromPoint(event.clientX,event.clientY).map(el=>el.closest('[data-bar-transfer-series]')).find(el=>el&&el!==event.currentTarget&&svg?.contains(el)&&Number(el.getAttribute('data-bar-transfer-series'))>=0);
    const target=hit?{series:Number(hit.getAttribute('data-bar-transfer-series')),index:Number(hit.getAttribute('data-bar-transfer-index'))}:null;
    const matrix=svg?.getScreenCTM();if(!matrix)return;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()),position={x:Math.max(25,Math.min((svg?.viewBox.baseVal.width??720)-25,p.x)),y:Math.max(30,Math.min((svg?.viewBox.baseVal.height??360)-30,p.y))};
    try{
     if(source.series<0){
      const island=islands[source.index];if(!island)return;
      if(target){const result=transferBarValue([...series,{name:island.seriesName,data:[island.value]}],{series:series.length,index:0},target,categories);publish(result.series.slice(0,-1));setIslands(old=>old.filter((_,i)=>i!==source.index));}
      else setIslands(old=>old.map((item,i)=>i===source.index?{...item,...position}:item));
     }else{const result=transferBarValue(series,source,target,categories);publish(result.series);if(result.island)setIslands(old=>[...old,{...result.island!,...position}]);}
    }catch(error){onError?.(error instanceof Error?error.message:String(error));}
   },
  };
 }
 return {islands,props,reset};
}
