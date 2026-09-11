import {MixedChart} from '@sia-ui/react';
import type {MixedSeries} from '@sia-ui/react';
import source from './chartMixedSalesSource.json';

const option=source[0]!.option;
const colors=['#2ec7c9','#b6a2de','rgba(0,0,0,0)','#ffb980'];
export const mixedSalesSeries:MixedSeries[]=option.series.map((item,index)=>({
 name:item.name,type:item.type as 'line'|'bar',color:colors[index],curve:'straight',
 data:item.data.map(point=>typeof point==='number'?point:point.value),
 pointColors:item.data.map(point=>typeof point==='number'?undefined:point.itemStyle.normal.color),
 stack:index>=2?'1':undefined,barWidth:index===2?6:undefined,barRadius:0,
 showPoints:index!==1,lineStyle:index===1?'dashed':'solid',lineWidth:index===1?1:2,
}));

export function MixedSalesReferencePreview(){
 return <>
  <div className="chart-mixed-sales">
  <MixedChart ariaLabel="mix6 销售数据" title={option.title.text} description={option.title.subtext}
   width={800} height={420} viewBoxSize={[800,420]} plotBounds={{x:80,y:65,width:640,height:285}}
   categories={option.xAxis[0]!.data} series={mixedSalesSeries} valueAxes={[{domain:[200,450,50]}]} clipPlot
   legendNames={option.legend.data} legendInteractive={false} legendLayout={{x:400,y:16}}
   tooltipTrigger="axis" axisTooltipFormatter={(index,series)=>{
    const current=series.find(item=>item.name==='本周')?.data[index];
    const previous=series.find(item=>item.name==='上周')?.data[index];
    // ECharts axis tooltip unshifts stacked series: change, base, current, previous.
    const base=series.find(item=>item.name==='上周2')?.data[index];
    const change=series.find(item=>item.name==='变化')?.data[index];
    return <><strong>{option.xAxis[0]!.data[index]} : {current!=null&&base!=null&&current>base?'+':'-'}{change??'-'}</strong><span>本周 : {current??'-'}</span><span>上周 : {previous??'-'}</span></>;
   }} toolbox={{features:['mark','dataView','restore','saveAsImage'],magicTypes:['line','bar'],dataViewReadOnly:false}}/></div>
  <p className="chart-parity__status">开发中：保留四系列 28 个原始数值、透明堆叠底柱、6 像素差值柱、下降日红色、上周无符号虚线、固定 200–450 轴、只读双项图例、涨跌提示及编辑/切换/还原。差异：柱线切换保留本框架分类间距与堆叠策略，符号、工具栏、轴线及逐帧动画尚未通过原站一致性验收；注册为开发中对应示例，不计完整一致性通过。</p>
 </>;
}
