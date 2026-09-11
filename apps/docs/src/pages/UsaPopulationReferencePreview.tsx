import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,MapChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection} from '@sia-ui/react';
import geography from './chartUsaGeography.json';
import source from './chartUsaPopulationSource.json';
const worldPopulationData=source[0]!.option.series[0]!.data;
const formatWorldPopulation=(value:number|string)=>String(value).split('.')[0]!.replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g,'$1,');
const specialAreas={Alaska:{left:-127,top:30,width:15,height:15},Hawaii:{left:-110,top:28,width:5,height:5},'Puerto Rico':{left:-76,top:26,width:2,height:2}};
export function UsaPopulationReferencePreview(){
 const [data,setData]=useState(worldPopulationData),[range,setRange]=useState<[number,number]>([500000,38000000]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null),option=source[0]!.option;
 const editor=<ChartDataEditor series={[{name:option.series[0]!.name,data:data.map(d=>d.value)}]} onApply={rows=>setData(data.map((d,i)=>({...d,value:rows[0]![i]!})))}/>;
 return <div className="chart-world-population"><ChartComposite ref={chart} width={1000} height={560} ariaLabel="map7 2012美国人口" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="right" geoJson={geography.geography as unknown as GeoJsonFeatureCollection}
   wheelZoomFactors={[1.2,1/1.2]} clampVisualValues data={data} roam scaleLimit={null} longitudeRatio={.75} specialAreas={specialAreas} labelOffsets={{Alaska:[20,-20]}} plotBounds={{x:40,y:75,width:850,height:340}} showLabels={false} showEmphasisLabels
   valueDomain={[500000,38000000]} colors={['lightskyblue','yellow','orangered']} outOfRangeColor="#ccc" calculableVisualMap visualRange={range} onVisualRangeChange={setRange}
   visualMapLayout={{realtime:true,svgHandles:true,x:875,y:370,width:140,height:20,orientation:'vertical',label:'',endLabels:['Low','High']}}
   tooltipFormatter={(name,datum)=><>{option.series[0]!.name}<br/>{name} : {formatWorldPopulation(datum?.value??'-')}</>}
   labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   toolbox={{orientation:'horizontal',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setData(worldPopulationData);setRange([500000,38000000]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map7').catch(reason=>setError(String(reason)));}}}/>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站人口数据来源</a><p className="chart-parity__status">开发中：52项2012美国人口原值、三个特殊区域移位、阿拉斯加标签偏移、实时三色值域、编辑与导出。画布布局、工具栏位置、标签中心及动画尚未通过原站一致性验收。</p></div>;
}
