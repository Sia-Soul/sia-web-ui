import {useRef,useState} from 'react';
import {ChartLegend,SiaChart,ChartComposite,ChartDataEditor,MixedChart,PieChart,transferCompositeValue} from '@sia.soul/sia-react-ui';
import type {MixedSeries,ChartCompositeRef,ChartValueTransferHandler} from '@sia.soul/sia-react-ui';
import source from './chartMixedTrafficSource.json';

const option=source[0]!.option;
const colors=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3','#e5cf0d','#97b552','#95706d'];
const cartesian:MixedSeries[]=option.series.filter(item=>item.type!=='pie').map((item,index)=>({name:item.name,type:item.type as 'bar'|'line',data:item.data as number[],stack:'stack' in item?item.stack:undefined,tooltipTrigger:'tooltip' in item?'item':undefined,color:colors[index],curve:'straight'}));
const slices=option.series.find(item=>item.type==='pie')!.data as {name:string;value:number}[];
export function MixedTrafficReferencePreview(){
 const composite=useRef<ChartCompositeRef>(null);
 const [exportError,setExportError]=useState('');
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [replay,setReplay]=useState(0);
 const [cartesianData,setCartesianData]=useState<readonly MixedSeries[]>(cartesian);
 const [pieData,setPieData]=useState(slices);
 const onValueTransfer:ChartValueTransferHandler=(from,to)=>{
  const next=transferCompositeValue([{id:'traffic',series:cartesianData},{id:'engines',nonNegative:true,series:[{name:'搜索引擎细分',data:pieData.map(item=>item.value)}]}],from,to);
  setCartesianData(cartesianData.map((item,index)=>({...item,data:next[0]!.series[index]!.data})));
  setPieData(pieData.map((item,index)=>({...item,value:next[1]!.series[0]!.data[index]??0})));
  return true;
 };
 const dataView=<ChartDataEditor<number|null> allowNull series={[...cartesianData,{name:'搜索引擎细分（百度、谷歌、必应、其他）',data:pieData.map(item=>item.value)}]} onApply={values=>{
  const pieValues=values[5]!;
  if(pieValues.some(value=>value===null||value<0))throw new Error('饼图细分必须为非负数字，不能使用 null。');
  setCartesianData(cartesianData.map((item,index)=>({...item,data:values[index]!})));
  setPieData(pieData.map((item,index)=>({...item,value:pieValues[index]! as number})));
 }}/>;
 return <>
  <div className="chart-parity__viewport chart-mixed-traffic">
   <ChartComposite ref={composite} width={900} height={400} ariaLabel="mix2 堆叠柱折线与饼图" layers={[
    {key:'legend',left:0,top:0,width:900,height:45,zIndex:3,content:<SiaChart width={900} height={45} viewBoxSize={[900,45]} ariaLabel="mix2 共享图例"><ChartLegend x={450} y={18} itemGap={12} items={option.legend.data.map((name,index)=>({name,color:colors[index]!,disabled:selected[name]===false}))} selected={selected} onItemClick={name=>setSelected(value=>({...value,[name]:value[name]===false}))}/></SiaChart>},
    {key:'cartesian',content:<MixedChart transferId="traffic" onValueTransfer={onValueTransfer} onTransferError={setExportError} key={replay} width={900} height={400} viewBoxSize={[900,400]} plotBounds={{x:80,y:60,width:720,height:260}} categories={option.xAxis[0]!.data} series={cartesianData} onDataChange={setCartesianData} valueAxes={[{position:'right'}]} showLegend={false} legendSelected={selected} tooltipTrigger="axis" calculable toolbox={{verticalAlign:'bottom',dataView,onSaveAsImage:()=>{setExportError('');composite.current?.saveAsImage('mix2').catch(error=>setExportError(String(error)));},features:['mark','dataView','restore','saveAsImage'],magicTypes:['line','bar','stack','tiled'],onRestore:()=>{setExportError('');setSelected({});setCartesianData(cartesian);setPieData(slices);setReplay(value=>value+1);}}}/>},
    {key:'pie',left:40,top:65,width:240,height:180,content:<PieChart transferId="engines" onValueTransfer={onValueTransfer} onTransferError={setExportError} key={replay} width={240} height={180} viewBoxSize={[240,180]} center={[120,65]} showLegend={false} legendSelected={selected} series={[{name:'搜索引擎细分',innerRadius:0,outerRadius:50,data:pieData.map(item=>({...item,color:colors[option.legend.data.indexOf(item.name)]}))}]} ariaLabel="搜索引擎细分"/>},
   ]}/>
  </div>
  {exportError?<p role="alert">{exportError}</p>:null}
  <p className="chart-parity__status">开发中：原始五组周数据与四项搜索细分，命名堆叠、右轴、共享图例、底部工具箱、六系列编辑与组合 PNG 导出。饼图与柱线双向拖放、空槽填充和负数拒绝已验证。差异：饼图拖空后保留零值条目，饼图拖到空白处不会生成孤岛，柱线孤岛尚不能转入饼图；标签布局、提示样式和动画仍未通过原站一致性验收。</p>
 </>;
}
