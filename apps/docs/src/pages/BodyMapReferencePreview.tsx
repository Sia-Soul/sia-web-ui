import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartVisualMap,SiaChart,SvgMapPlot} from '@sia-ui/react';
import type {ChartCompositeRef} from '@sia-ui/react';
import source from './chartBodyMapSource.json';
import male from './chartBodyMale.svg?raw';
import female from './chartBodyFemale.svg?raw';
const option=source[0]!.option;
export function BodyMapReferencePreview(){
 const [rows,setRows]=useState(option.series.map(s=>s.data)),[range,setRange]=useState<[number,number]>([0,100]),[hover,setHover]=useState<number>(),[hoverRange,setHoverRange]=useState<readonly [number,number]>(),[reset,setReset]=useState(0),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 return <div className="chart-body-map"><ChartComposite ref={chart} width={1000} height={600} ariaLabel="map16 人体密码" layers={[
  {key:'body',content:<SiaChart width={1000} height={600} viewBoxSize={[1000,600]} title={option.title.text} description={option.title.subtext} titleAlign="center" animation={false}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={rows.map((data,i)=>({name:option.series[i]!.name,data:data.map(d=>d.value)}))} onApply={values=>setRows(rows.map((data,i)=>data.map((d,j)=>({...d,value:values[i]![j]!}))))}/>,onRestore:()=>{setRows(option.series.map(s=>s.data));setRange([0,100]);setReset(n=>n+1);setHover(undefined);setHoverRange(undefined);},onSaveAsImage:()=>{chart.current?.saveAsImage('map16').catch(reason=>setError(String(reason)));}}}>
   {[male,female].map((svg,i)=><SvgMapPlot key={i} source={svg} name={option.series[i]!.name} data={rows[i]!} x={i===0?12:699.2} y={18} width={300.8} height={564} domain={[0,100]} range={range} colors={['lightskyblue','yellow','orangered']} labelOffsets={i===0?{'上肢':[-60,0]}:undefined} hoverRange={hoverRange} onHoverValue={setHover} resetKey={reset}
    markPoints={option.series[i]!.markPoint.data.map(point=>({name:point.name,value:point.value,coordinate:[point.geoCoord[0]!,point.geoCoord[1]!],size:option.series[i]!.markPoint.symbolSize}))}
    markLines={option.series[i]!.markLine.data.map(pair=>({name:pair[0]!.name+' > '+pair[1]!.name,value:pair[1]!.value!,source:[pair[0]!.geoCoord[0]!,pair[0]!.geoCoord[1]!],target:[pair[1]!.geoCoord[0]!,pair[1]!.geoCoord[1]!],...option.series[i]!.markLine.effect,effectColor:option.series[i]!.markLine.effect.color}))}
   />)}
   <ChartVisualMap svgHandles calculable min={0} max={100} range={range} onRangeChange={setRange} onHoverRange={setHoverRange} indicatorValue={hover} colors={['lightskyblue','yellow','orangered']} x={470} y={170} width={300} height={20} orientation="vertical"/>
  </SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：保留男女14原始SVG部位、双独立漫游、共享色阶、随机周期心脏脉动及连接线效果，支持编辑、标线和导出。光晕/拖尾像素效果、部分文字位置及漫游缩放细节尚未通过原站完整一致性验收。</p></div>;
}
