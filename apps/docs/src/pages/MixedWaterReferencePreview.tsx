import {useState} from 'react';
import {MixedChart} from '@sia.soul/sia-react-ui';
import type {MixedSeries} from '@sia.soul/sia-react-ui';
import source from './chartMixedWaterSource.json';

const option=source[0]!.option;
const colors=['#2ec7c9','#b6a2de','#5ab1ef'];
const series:MixedSeries[]=option.series.map((item,index)=>({name:item.name,type:item.type as 'bar'|'line',valueAxisIndex:'yAxisIndex' in item?item.yAxisIndex:0,data:item.data,color:colors[index],curve:'straight'}));
export function MixedWaterReferencePreview(){
 const [error,setError]=useState('');
 return <>
  <div className="chart-parity__viewport chart-mixed-water">
   <MixedChart ariaLabel="mix1 蒸发量降水量与平均温度" width={800} height={420} viewBoxSize={[800,420]}
    plotBounds={{x:80,y:60,width:620,height:280}} categories={option.xAxis[0]!.data} series={series}
    valueAxes={option.yAxis.map(axis=>({name:axis.name,formatter:value=>axis.axisLabel.formatter.replace('{value}',String(value))}))}
    legendLayout={{x:400,y:16}} calculable tooltipTrigger="axis" onTransferError={setError}
    toolbox={{features:['mark','dataView','restore','saveAsImage'],magicTypes:['line','bar'],dataViewReadOnly:false,onRestore:()=>setError('')}}/>
  </div>
  {error?<p role="alert">{error}</p>:null}
  <p className="chart-parity__status">开发中：原始十二个月三系列，两柱一线及独立水量/温度轴、ml/°C 单位、图例、轴提示、数据编辑、图形切换和拖放。差异：轴刻度与样式、符号、拖出孤岛细节、工具箱及逐帧动画尚未完全一致；不计完整一致性通过。</p>
 </>;
}
