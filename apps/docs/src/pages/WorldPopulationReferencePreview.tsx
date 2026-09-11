import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,MapChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection} from '@sia-ui/react';
import geography from './chartWorldSource.json';
import source from './chartWorldPopulationSource.json';
import {worldPopulationData,formatWorldPopulation} from './chartWorldPopulationData';
export function WorldPopulationReferencePreview(){
 const [data,setData]=useState(worldPopulationData),[range,setRange]=useState<[number,number]>([0,1000000]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null),option=source[0]!.option;
 const editor=<ChartDataEditor series={[{name:option.series[0]!.name,data:data.map(d=>d.value)}]} onApply={rows=>setData(data.map((d,i)=>({...d,value:rows[0]![i]!})))}/>;
 return <div className="chart-world-population"><ChartComposite ref={chart} width={1000} height={560} ariaLabel="map4 2010世界人口" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center" geoJson={geography.geography as unknown as GeoJsonFeatureCollection}
   wheelZoomFactors={[1.2,1/1.2]} clampVisualValues data={data} roam scaleLimit={null} longitudeRatio={1} plotBounds={{x:90,y:60,width:850,height:380}} showLabels={false} showEmphasisLabels
   valueDomain={[0,1000000]} colors={['lightskyblue','yellow','orangered']} outOfRangeColor="#ccc" calculableVisualMap visualRange={range} onVisualRangeChange={setRange}
   visualMapLayout={{realtime:false,svgHandles:true,x:5,y:370,width:140,height:20,orientation:'vertical',label:'',endLabels:['Low','High']}}
   tooltipFormatter={(name,datum)=><>{option.series[0]!.name}<br/>{name} : {formatWorldPopulation(datum?.value??'-')}</>}
   labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setData(worldPopulationData);setRange([0,1000000]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map4').catch(reason=>setError(String(reason)));}}}/>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站人口数据来源</a><p className="chart-parity__status">开发中：177项2010人口原值、世界地图、三段渐变、松手提交值域、编辑与导出。世界投影、漫游速度及动画尚未通过原站一致性验收。</p></div>;
}
