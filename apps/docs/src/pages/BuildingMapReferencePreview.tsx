import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartLegend,SiaChart,SvgMapPlot} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef} from '@sia.soul/sia-react-ui';
import source from './chartBuildingMapSource.json';
import building from './chartBuilding.svg?raw';
import {createBuildingMapData} from './chartBuildingMapData';
const option=source[0]!.option,groups=createBuildingMapData(option.series,option.color);
const width=964,height=232*width/750,top=Math.floor((600-height)/2);
const initial=Object.fromEntries(option.legend.data.map(name=>[name,true]));
export function BuildingMapReferencePreview(){
 const chart=useRef<ChartCompositeRef>(null),[selected,setSelected]=useState(initial),[reset,setReset]=useState(0),[error,setError]=useState('');
 const visible=groups.filter(group=>!group.name||selected[group.name]);
 return <div className="chart-building-map"><ChartComposite ref={chart} width={1000} height={600} style={{background:option.backgroundColor}} ariaLabel="map18 百度大厦" layers={[
  {key:'floor',content:<SiaChart width={1000} height={600} viewBoxSize={[1000,600]} title={option.title.text} animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={groups.map(group=>({name:group.name??'匿名系列',data:[]}))} onApply={()=>{}}/>,onRestore:()=>{setSelected(initial);setReset(n=>n+1);setError('');},onSaveAsImage:()=>chart.current?.saveAsImage('map18').catch(reason=>setError(String(reason)))}}>
   <SvgMapPlot source={building} name="百度大厦" data={[]} x={18} y={top} width={width} height={height} domain={[0,100]} colors={option.color} resetKey={reset} tooltipNameOnly
    markPoints={visible.flatMap(group=>group.points.map((point,i)=>({id:`${group.index}-point-${i}`,name:point.name,coordinate:point.coordinate,size:point.size,symbol:point.symbol as 'pin'|'circle'|'emptyCircle',effect:point.effect?.show??false,effectColor:point.effect?.color,color:group.color})))}
    markLines={visible.flatMap(group=>group.lines.map((line,i)=>({id:`${group.index}-line-${i}`,name:line.name,source:line.source,target:line.target,color:group.color,endpointSymbols:line.symbols,effectColor:line.effect.color,period:line.effect.period,shadowBlur:line.effect.shadowBlur})))}/>
   <ChartLegend x={500} y={22} items={option.legend.data.map((name,i)=>({name,color:option.color[i]!}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:!current[name]}))}/>
  </SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：保留57个楼层图形、39个人员标记、17条线路及6个匿名脉动点，支持三组图例、共享漫游、数据视图、标线和导出。pin轮廓与强调、SVG整体缩放、光晕/拖尾混合及原站完整逐帧一致性尚未验收。</p></div>;
}
