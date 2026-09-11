import {useMemo,useState} from 'react';
import {MixedChart} from '@sia-ui/react';
import {barTimelineYears,barTimelineCategories,barTimelineSelected,barTimelineSeries} from './chartBarTimelineData';

export function BarTimelineReferencePreview(){
 const [index,setIndex]=useState(0);
 const [transferError,setTransferError]=useState('');
 const [selected,setSelected]=useState<Record<string,boolean>>({...barTimelineSelected});
 const year=barTimelineYears[index]!;
 const series=useMemo(()=>barTimelineSeries(year),[year]);
 return <>
  <div className="chart-parity__viewport chart-bar-timeline">
   <MixedChart title={`${year}全国宏观经济指标`} description="数据来自国家统计局" ariaLabel="bar11 宏观经济时间轴柱图"
    width={1100} height={520} viewBoxSize={[1100,520]} plotBounds={{x:80,y:80,width:900,height:340}}
    categories={barTimelineCategories} series={series} tooltipTrigger="axis" calculable onTransferError={setTransferError}
    valueAxes={[{name:'GDP（亿元）',domain:[0,53500,10700]},{name:'其他（亿元）'}]}
    legendLayout={{x:720,y:16}} legendSelected={selected} onLegendSelectionChange={setSelected}
    timeline={{labels:barTimelineYears,value:index,onChange:setIndex,autoPlay:true,playInterval:1000}}
    toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],magicTypes:['line','bar','stack','tiled'],dataViewReadOnly:false,onRestore:()=>{setIndex(0);setSelected({...barTimelineSelected});}}}/>
  </div>
  {transferError?<p role="alert">{transferError}</p>:null}
  <p className="chart-parity__status">开发中：十年六指标、双轴、默认 GDP/房地产、年份播放、图形/堆叠切换、均值与编辑；拖放合并、源空槽、拖出孤岛及拖回通过浏览器测试。差异：孤岛合并/滚轮、跨轴堆叠规则、刻度、轴指针、工具箱、播放时拖放及动画尚未完全一致，不计完整一致性通过。</p>
 </>;
}
