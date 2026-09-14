import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,SiaChart,SvgMapPlot} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef} from '@sia.soul/sia-react-ui';
import source from './chartFootballMapSource.json';
import pitch from './chartFootball.svg?raw';
const option=source[0]!.option,series=option.series[0]!;
// Same 2% margin and equal SVG scale as the reference map projection.
const height=564,width=841.89*height/595.275,left=Math.floor((1000-width)/2);
export function FootballMapReferencePreview(){
 const chart=useRef<ChartCompositeRef>(null),[reset,setReset]=useState(0),[value,setValue]=useState<number|null>(null),[error,setError]=useState('');
 return <div className="chart-football-map"><ChartComposite ref={chart} width={1000} height={600} style={{background:option.backgroundColor}} ariaLabel="map17 2014世界杯" layers={[
  {key:'pitch',content:<SiaChart width={1000} height={600} viewBoxSize={[1000,600]} title={option.title.text} description={option.title.subtext} animation={false}
   toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor allowNull series={[{name:series.name,data:[value]}]} onApply={values=>setValue(values[0]![0]!)}/>,onRestore:()=>{setReset(n=>n+1);setValue(null);setError('');},onSaveAsImage:()=>chart.current?.saveAsImage('map17').catch(reason=>setError(String(reason)))}}>
   <SvgMapPlot source={pitch} name={series.name} data={[{name:'草地',value:value??undefined,hoverable:false,showLabel:false}]} x={left} y={18} width={width} height={height} domain={[0,100]} colors={['#fff','#fff']} resetKey={reset} labelOffsets={series.textFixed}
    markPoints={series.markPoint.data.map(point=>({name:point.name,value:point.value,coordinate:[point.geoCoord[0]!,point.geoCoord[1]!],size:series.markPoint.symbolSize,effectColor:series.markPoint.effect.color}))}
    markLines={series.markLine.data.map(pair=>({name:pair[0]!.name+' > '+pair[1]!.name,source:[pair[0]!.geoCoord[0]!,pair[0]!.geoCoord[1]!],target:[pair[1]!.geoCoord[0]!,pair[1]!.geoCoord[1]!],color:series.markLine.itemStyle.normal.color,effectColor:series.markLine.effect.color,period:series.markLine.effect.period,shadowBlur:series.markLine.effect.shadowBlur}))}/>
  </SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：保留26个原始足球场图形、8块草地禁用提示和标签、开球点脉动及两条原坐标传球线路，支持漫游、数据视图、标线和导出。描边强调、光晕/拖尾像素效果、整体缩放下的标记与文字大小尚未通过完整一致性验收。</p></div>;
}
