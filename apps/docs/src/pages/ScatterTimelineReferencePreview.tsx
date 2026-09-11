import {useMemo, useState} from 'react';
import {ScatterChart} from '@sia-ui/react';
import macro from './chartMacroTimelineData.json';
import reference from './chartScatterTimelineSource.json';

const years=reference[0]!.option.timeline.data.map(value=>value.slice(0,4));
const gdp:Record<string,number[]>=macro.tables.dataGDP;
const estate:Record<string,number[]>=macro.tables.dataEstate;
export function ScatterTimelineReferencePreview(){
 const [index,setIndex]=useState(0);
 const year=years[index]!;
 const data=useMemo(()=>macro.provinces.map((name,i)=>({name,x:estate[year]![i]!,y:gdp[year]![i]!,category:'GDP',size:5,color:'#2ec7c9'})),[year]);
 return <>
  <div className="chart-parity__viewport chart-scatter-timeline">
   <ScatterChart title={`${year}全国宏观经济关联分析（GDP vs 房地产）`} description="数据来自国家统计局"
    ariaLabel="scatter4 宏观经济时间轴散点图" data={data} width={900} height={480} viewBoxSize={[900,480]}
    plotBounds={{x:80,y:80,width:700,height:300}} xDomain={[0,3400,680]} yDomain={[0,53500,10700]}
    xLabel="房地产（亿元）" yLabel="GDP（亿元）" showLegend={false} showPointLabels crosshair markAverage="both" markColor="red"
    timeline={{labels:years,value:index,onChange:setIndex,autoPlay:true,playInterval:1000}}
    toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataViewReadOnly:false,onRestore:()=>setIndex(0)}}/>
  </div>
  <p className="chart-parity__status">开发中：2002—2011 年、31 个地区原始数据，房地产/GDP 固定坐标，地区名称、双均值标线、十字指针、每秒自动播放、年份手动切换及数据编辑。待核对：原站时间轴样式、标签重叠处理、坐标刻度算法、均值箭头和标线颜色、切换过渡动画及工具箱细节；不计入完整一致性通过数量。</p>
 </>;
}
