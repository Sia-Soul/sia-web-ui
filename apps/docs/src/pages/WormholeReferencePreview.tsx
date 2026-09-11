import {useState} from 'react';
import {Button,RadarChart} from '@sia-ui/react';
import {wormholeIndicators,wormholeSeries} from './chartWormholeData';
const radars=[{indicators:wormholeIndicators,series:wormholeSeries,center:[360,240] as const,radius:150}];
export function WormholeReferencePreview(){
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 return <>
  <div className="chart-parity__controls" aria-label="年份图例" style={{display:'flex',flexWrap:'wrap',gap:2}}>{wormholeSeries.map(series=><Button key={series.name} variant="text" aria-pressed={selected[series.name]!==false} onClick={()=>setSelected(value=>({...value,[series.name]:value[series.name]===false}))}><span style={{color:series.color}}>━</span> {series.name}</Button>)}</div>
  <div className="chart-parity__viewport"><RadarChart appearance="macarons" radars={radars} showLegend={false} legendSelected={selected} width={720} height={440} viewBoxSize={[720,440]} toolbox={{features:['mark','dataView','restore','saveAsImage'],onRestore:()=>setSelected({})}}/></div>
  <p style={{textAlign:'right'}}>浏览器占比变化<br/><small>纯属虚构</small></p>
  <p className="chart-parity__status">保留原站 2001–2028 年的 28 组五维公式数据、400 上限、黄至红线条、无拐点符号、悬浮绿色填充、逐年筛选、数据编辑与还原。框架图例换行、标题及工具箱位置、悬浮命中、提示背景和动画轨迹仍需一致性验收。</p>
 </>;
}
