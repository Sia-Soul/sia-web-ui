import {useEffect,useRef,useState} from 'react';
import {ChartComposite,ChartValueIsland,SiaChart,MixedChart,PieChart,transferCompositeValue} from '@sia-ui/react';
import type {ChartCompositeRef,ChartValueTransferHandler,MixedSeries} from '@sia-ui/react';
import snapshot from './chartMixedVisitorsSource.json';

const option=snapshot[0]!.option,other=snapshot[0]!.bindings.option2;
const palette=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80'];
const initialBars:MixedSeries[]=other.series.map((item,index)=>({name:item.name,type:'bar',stack:item.stack,data:item.data,color:palette[index],barRadius:0,curve:'straight'}));
const initialSlices=option.series[0]!.data;
export function MixedVisitorsReferencePreview(){
 const host=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(1100);
 useEffect(()=>{const element=host.current;if(!element)return;const measure=()=>setWidth(Math.max(1,element.clientWidth));measure();const observer=new ResizeObserver(measure);observer.observe(element);return ()=>observer.disconnect();},[]);
 const pieWidth=width*.45,weekWidth=width*.5;
 const composite=useRef<ChartCompositeRef>(null);
 const [bars,setBars]=useState<readonly MixedSeries[]>(initialBars),[slices,setSlices]=useState(initialSlices);
 const [selected,setSelected]=useState<Record<string,boolean>>({}),[replay,setReplay]=useState(0),[error,setError]=useState('');
 const [islands,setIslands]=useState<{id:number;name:string;value:number;x:number;y:number}[]>([]);
 useEffect(()=>{setIslands(current=>current.map(item=>({...item,x:Math.max(22,Math.min(Math.max(22,width-22),item.x))})));},[width]);
 const nextIsland=useRef(0);
 const transfer:ChartValueTransferHandler=(from,to)=>{
  const result=transferCompositeValue([{id:'visitors-pie',nonNegative:true,series:[{name:'访问来源',data:slices.map(item=>item.value)}]},{id:'visitors-week',series:bars}],from,to);
  setSlices(slices.map((item,index)=>({...item,value:result[0]!.series[0]!.data[index]??0})));
  setBars(bars.map((item,index)=>({...item,data:result[1]!.series[index]!.data})));
  return true;
 };
 const restore=()=>{setIslands([]);setBars(initialBars);setSlices(initialSlices);setSelected({});setReplay(value=>value+1);setError('');};
 return <><div ref={host} className="chart-parity__viewport chart-mixed-visitors">
  <ChartComposite ref={composite} width={width} height={450} ariaLabel="mix9 访问来源饼图与七日堆叠图" layers={[
   {key:'pie',left:0,top:0,width:pieWidth,height:450,content:<PieChart key={replay} width={pieWidth} height={450} viewBoxSize={[pieWidth,450]} title={option.title.text} description={option.title.subtext} titleAlign="center" ariaLabel="访问来源饼图" center={[pieWidth/2,225]} outsideLabelLayout={{top:140,bottom:410,gap:20,left:6,right:pieWidth-6}} legendLayout={{x:10,y:60,align:'start',orientation:'vertical'}} legendSelected={selected} onLegendSelectionChange={setSelected} series={[{name:'访问来源',innerRadius:0,outerRadius:Math.min(pieWidth,450)*.275,data:slices.map((item,index)=>({...item,color:palette[index]}))}]} transferId="visitors-pie" onValueDragOut={(_,index,point)=>{
    const source=slices[index];if(!source||source.value===0)return;
    setIslands(current=>[...current,{id:nextIsland.current++,name:source.name,value:source.value,x:Math.max(22,Math.min(width-22,point[0])),y:Math.max(22,Math.min(428,point[1]))}]);
    setSlices(current=>current.map((item,i)=>i===index?{...item,value:0}:item));
   }} onValueTransfer={transfer} onTransferError={setError}/>},
   {key:'week',left:pieWidth,top:0,width:weekWidth,height:450,content:<MixedChart key={replay} width={weekWidth} height={450} viewBoxSize={[weekWidth,450]} ariaLabel="访问来源七日堆叠图" plotBounds={{x:60,y:65,width:Math.max(1,weekWidth-100),height:315}} categories={other.xAxis[0]!.data} series={bars} valueAxes={[{}]} legendLayout={{x:weekWidth/2,y:20,maxWidth:Math.max(1,weekWidth-20)}} legendSelected={selected} onLegendSelectionChange={setSelected} tooltipTrigger="axis" calculable onDataChange={setBars} transferId="visitors-week" onValueTransfer={transfer} onTransferError={setError} toolbox={{orientation:'vertical',features:['mark','restore','saveAsImage'],magicTypes:['line','bar','stack','tiled'],onRestore:restore,onSaveAsImage:()=>{composite.current?.saveAsImage('mix9').catch(reason=>setError(String(reason)));}}}/>},
   {key:'islands',left:0,top:0,width,height:450,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={width} height={450} viewBoxSize={[width,450]} ariaLabel="访问来源数据孤岛" animation={false}>{islands.map((island,index)=><ChartValueIsland key={island.id} {...island} onDrop={(target,point)=>{
    if(!target){setIslands(current=>current.map(item=>item.id===island.id?{...item,x:Math.max(22,Math.min(width-22,point[0])),y:Math.max(22,Math.min(428,point[1]))}:item));return;}
    try{
     const next=transferCompositeValue([{id:'visitors-pie',nonNegative:true,series:[{name:'访问来源',data:slices.map(item=>item.value)}]},{id:'visitors-week',series:bars},{id:'visitors-islands',series:islands.map(item=>({name:item.name,data:[item.value]}))}],{chart:'visitors-islands',series:index,index:0},target);
     setSlices(slices.map((item,i)=>({...item,value:next[0]!.series[0]!.data[i]??0})));
     setBars(bars.map((item,i)=>({...item,data:next[1]!.series[i]!.data})));
     setIslands(current=>current.filter(item=>item.id!==island.id));
    }catch(reason){setError(String(reason));}
   }}/>)}</SiaChart>},
  ]}/>
 </div>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：保留五项访问来源与35项周数据、双向图例、堆叠/平铺及柱线切换、跨图拖放、饼图数据孤岛、还原和组合导出。尚未通过完整一致性验收：孤岛合并与滚轮调值、跨图提示、标签布局及动画仍有差异。</p></>;
}
