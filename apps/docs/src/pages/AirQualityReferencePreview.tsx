import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartLegend,MapChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps,MapMarkPoint} from '@sia.soul/sia-react-ui';
import source from './chartAirQualitySource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const option=source[0]!.option,original=option.series.map(series=>series.markPoint.data);
const coordinates=option.series[0]!.geoCoord as Record<string,number[]>;
export function AirQualityReferencePreview(){
 const [data,setData]=useState(original),[visible,setVisible]=useState(true),[range,setRange]=useState<[number,number]>([0,500]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 const [periods]=useState(()=>original[1]!.map(()=>1500+1000*Math.random()));
 const points:MapMarkPoint[]=data.flatMap((rows,index)=>index===0&&!visible?[]:rows.map((datum,j)=>({...datum,seriesName:option.series[index]!.name,coordinate:coordinates[datum.name]! as [number,number],visualMap:true,
  symbol:index===0?'pin':'emptyCircle',size:index===0?5:10+datum.value/100,scaleEffect:index===1?{duration:periods[j]!,scaleSize:2}:undefined,
  style:index===0?{stroke:'#87cefa',strokeWidth:1}:{strokeWidth:1},emphasisStyle:index===0?{stroke:'#1e90ff',strokeWidth:5}:undefined})));
 const editor=<ChartDataEditor series={data.map((rows,index)=>({name:option.series[index]!.name,data:rows.map(d=>d.value)}))} onApply={rows=>setData(data.map((items,index)=>items.map((datum,j)=>({...datum,value:rows[index]![j]!}))))}/>;
 return <div className="chart-air-quality"><ChartComposite ref={chart} width={1000} height={560} ariaLabel="map9 城市PM2.5与Top5特效" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center"
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}}
   regionHoverable={false} data={[]} showLabels={false} outOfRangeColor="#ccc" regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}}
   roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]} markPoints={points} markPointTooltipFormatter={point=><>{point.seriesName}<br/>{point.name} : {point.value}</>}
   valueDomain={[0,500]} colors={['#90ee90','#ffff00','#ffa500','#ff0000','#800080','#800000']} visualRange={range} onVisualRangeChange={setRange} calculableVisualMap
   visualMapLayout={{svgHandles:true,x:5,y:355,width:140,height:20,orientation:'vertical',label:''}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setData(original);setRange([0,500]);setVisible(true);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map9').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:140,height:50,pointerEvents:'none',content:<SiaChart width={140} height={50} viewBoxSize={[140,50]} className="sia-chart--overlay"><ChartLegend x={10} y={20} align="start" items={[{name:'pm2.5',color:'#ff7f50'}]} selected={{'pm2.5':visible}} onItemClick={()=>setVisible(value=>!value)}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站空气质量数据来源</a>
 <p className="chart-parity__status">开发中：190城市及独立Top5原值、六色值域、图例、编辑、漫游、标线与导出已验证；Top5按每点1.5–2.5秒循环缩放，无淡出。针形几何、字体布局、缩放锚点与完整动画观感尚未通过原站一致性验收。</p></div>;
}
