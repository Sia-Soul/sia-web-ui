import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartVisualMap,MapChart,SiaChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection} from '@sia-ui/react';
import source from './chartWorldGdpSource.json';
import world from './chartWorldSource.json';

const option=source[0]!.option;
const original=option.series.map(series=>series.data[0]!);
const geographies=original.map(datum=>({type:'FeatureCollection',features:world.geography.features.filter(feature=>feature.properties.name===datum.name)}));
const colors=['lightskyblue','yellow','orangered'];
const normalizeLongitude=([x,y]:readonly [number,number]):readonly [number,number]=>[x<-168.5&&y>63.8?x+360:x,y];
const percent=(value:string,total:number)=>Number.parseFloat(value)/100*total;
export function WorldGdpReferencePreview(){
 const [data,setData]=useState(original),[range,setRange]=useState<[number,number]>([2000,16000]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 const [hoverRange,setHoverRange]=useState<readonly [number,number]>(),[indicator,setIndicator]=useState<number>();
 const editor=<ChartDataEditor series={option.series.map((series,index)=>({name:series.name,data:[data[index]!.value]}))} onApply={rows=>setData(data.map((datum,index)=>({...datum,value:rows[index]![0]!})))}/>;
 return <div className="chart-world-gdp"><ChartComposite ref={chart} width={1000} height={600} ariaLabel="map8 2012世界GDP前八名" layers={[
  ...option.series.map((series,index)=>({key:series.name,content:<MapChart width={1000} height={600} viewBoxSize={[1000,600]} geoJson={geographies[index] as unknown as GeoJsonFeatureCollection}
   data={[data[index]!]} plotBounds={{x:percent(series.mapLocation.x,1000),y:percent(series.mapLocation.y,600),width:percent(series.mapLocation.width,1000),height:percent(series.mapLocation.height,600)}}
   emphasisValueRange={hoverRange} onRegionHover={datum=>setIndicator(datum?.value)} coordinateTransform={normalizeLongitude} longitudeRatio={.75} valueDomain={[2000,16000]} clampVisualValues colors={colors} showVisualMap={false} visualRange={range} outOfRangeColor="#ccc" showLabels showEmphasisLabels
   labelStyle={{fill:'rgb(139,69,19)',fontSize:20,fontWeight:'bold',textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   tooltipFormatter={(_name,datum)=><>{series.name}<br/>{String(datum?.value??'-').replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g,'$1,')} Billion</>}/> })),
  {key:'controls',content:<SiaChart width={1000} height={600} viewBoxSize={[1000,600]} title={option.title.text} description={option.title.subtext} titleAlign="center"
   toolbox={{verticalAlign:'bottom',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setData(original);setRange([2000,16000]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map8').catch(reason=>setError(String(reason)));}}}>
   <ChartVisualMap svgHandles onHoverRange={setHoverRange} indicatorValue={indicator} min={2000} max={16000} colors={colors} x={360} y={280} width={280} height={40} orientation="horizontal" calculable range={range} onRangeChange={setRange} endLabels={['2,000B','16,000B']}/>
  </SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站GDP数据来源</a>
 <p className="chart-parity__status">开发中：八国独立区域、2012 GDP原值、共享横向SVG值域、区间拖动、双向悬浮联动、编辑与导出已验证。默认标签中心、固定画布、提示过渡、入场及更新动画尚未通过原站完整一致性验收。</p></div>;
}
