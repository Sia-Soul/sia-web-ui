import {useCallback,useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,MapChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import source from './chartMapTimelineSource.json';
import macro from './chartMacroTimelineData.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const option=source[0]!.option,base=option.options[0]!,years=option.timeline.data.map(date=>date.slice(0,4));
const original=macro.tables.dataGDP as Record<string,number[]>;
export function MapTimelineReferencePreview(){
 const [index,setIndex]=useState(0),[tables,setTables]=useState(original),[range,setRange]=useState<[number,number]>([0,53000]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null),year=years[index]!,data=macro.provinces.map((name,i)=>({name,value:tables[year]![i]!}));
 const changeYear=useCallback((next:number)=>{setTables(original);setIndex(next);},[]);
 return <div className="chart-map-timeline" data-year={year}><ChartComposite ref={chart} width={1000} height={600} ariaLabel="map14 十年全国宏观经济指标" layers={[
  {key:'map',content:<MapChart width={1000} height={600} viewBoxSize={[1000,600]} title={option.options[index]!.title.text} description={base.title.subtext}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:180,y:70,width:650,height:410}}
   animation={false} data={data} seriesName="GDP" showLabels={false} showEmphasisLabels={false} clampVisualValues valueDomain={[0,53000]} colors={['lightskyblue','yellow','orangered']} outOfRangeColor="#ccc"
   calculableVisualMap visualRange={range} onVisualRangeChange={setRange} visualMapLayout={{svgHandles:true,x:5,y:340,width:140,height:20,orientation:'vertical',label:'',endLabels:['低','高']}}
   tooltipFormatter={(name,datum)=><>GDP<br/>{name} : {datum?datum.value.toLocaleString('en-US',{maximumFractionDigits:20}):'-'}</>}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   timeline={{renderer:'nodes',dates:option.timeline.data,x:80,y:540,width:840,labels:years,value:index,onChange:changeYear,autoPlay:true,playInterval:1000}}
   toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={[{name:`${year} GDP`,data:data.map(d=>d.value)}]} onApply={rows=>setTables(current=>({...current,[year]:[...rows[0]!]}))}/>,onRestore:()=>{setTables(original);setRange([0,53000]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map14').catch(reason=>setError(String(reason)));}}}/>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：2002—2011年310项原始GDP、日期节点时间轴、500ms检查点过渡、200ms拖动提交、跨年值域保留、当前年编辑还原、标线与含时间轴导出。固定画布、时间轴总体布局、拖动标记自由移动细节和完整视觉仍有差异，未通过完整一致性验收。</p></div>;
}
