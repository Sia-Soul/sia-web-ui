import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,MapChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import geography from './chartHongKongGeography.json';
import source from './chartHongKongDensitySource.json';
const option=source[0]!.option,series=option.series[0]!;
export function HongKongDensityReferencePreview(){
 const [data,setData]=useState(series.data),[range,setRange]=useState<[number,number]>([800,50000]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 const editor=<ChartDataEditor series={[{name:series.name,data:data.map(d=>d.value)}]} onApply={rows=>setData(data.map((d,i)=>({...d,value:rows[0]![i]!})))}/>;
 return <div className="chart-hong-kong-density"><ChartComposite ref={chart} width={900} height={530} ariaLabel="map6 香港18区人口密度" layers={[
  {key:'map',content:<MapChart width={900} height={530} viewBoxSize={[900,530]} title={option.title.text} description={option.title.subtext}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} nameMap={series.nameMap}
   labelCoordinates={series.geoCoord as unknown as MapChartProps['labelCoordinates']} labelOffsets={series.textFixed as unknown as MapChartProps['labelOffsets']}
   data={data} longitudeRatio={.75} plotBounds={{x:110,y:65,width:700,height:390}} showLabels showEmphasisLabels clampVisualValues valueDomain={[800,50000]}
   colors={['lightskyblue','yellow','orangered']} outOfRangeColor="#ccc" calculableVisualMap visualRange={range} onVisualRangeChange={setRange}
   visualMapLayout={{realtime:false,svgHandles:true,x:5,y:350,width:140,height:20,orientation:'vertical',label:'',endLabels:['Low','High']}}
   tooltipFormatter={(name,datum)=><>{name}<br/>{datum?.value??'-'} (p / km2)</>}
   labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setData(series.data);setRange([800,50000]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map6').catch(reason=>setError(String(reason)));}}}/>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站人口密度来源</a><p className="chart-parity__status">开发中：香港专用18区GeoJSON及2011人口密度原值、中文映射、离岛标签坐标和油尖旺偏移。非实时三色值域、编辑、标线与导出已验证；字体布局和动画未通过完整一致性验收。</p></div>;
}
