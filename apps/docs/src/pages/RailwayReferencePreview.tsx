import {useRef,useState} from 'react';
import {ChartComposite,ChartLegend,ChartDataEditor,MapChart,SiaChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps,MapMarkLine} from '@sia-ui/react';
import source from './chartRailwaySource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const option=source[0]!.option,coordinates=option.series[1]!.geoCoord as Record<string,number[]>;
export function RailwayReferencePreview(){
 const [active,setActive]=useState<string|null>(null),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 const lines:MapMarkLine[]=option.series.flatMap((series,index)=>active!==null&&series.name!==active?[]:series.markLine.data.map(pair=>{
  const from=pair[0]!.name,to=pair[1]!.name,name=from+' > '+to;
  return {name,seriesName:series.name,source:coordinates[from]! as [number,number],target:coordinates[to]! as [number,number],color:option.color[index],width:1,curveMode:'directional',curveness:.2,endpointSizes:[1,1],endpointSymbols:['circle','circle'],endpointStyle:{fill:'#fff',stroke:option.color[index],strokeWidth:1},tooltip:name,movingEffect:{period:30,color:'#fff',radius:1,shadowBlur:5,shadowColor:'rgba(220,220,220,0.4)',trailAlpha:.95}};
 }));
 return <div className="chart-railway chart-migration"><ChartComposite style={{background:'#1b1b1b'}} ref={chart} width={1000} height={560} ariaLabel="map12 中国铁路运输主干线" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center"
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}}
   insetStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,1)',strokeWidth:.5}} insetLabelStyle={{fill:'#fff'}} data={[]} showLabels={false} showVisualMap={false} showMap regionHoverable={false} outOfRangeColor="#1b1b1b" regionStyle={{stroke:'rgba(100,149,237,1)',strokeWidth:.5,filter:'none',opacity:1}}
   roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]} markLineEffectRenderer="canvas" markLines={lines}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={option.series.map(series=>({name:series.name,data:series.data}))} onApply={()=>{}}/>,onRestore:()=>{setActive(null);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map12').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:150,height:80,pointerEvents:'none',content:<SiaChart width={150} height={80} viewBoxSize={[150,80]} className="sia-chart--overlay"><ChartLegend x={10} y={20} align="start" orientation="vertical" items={option.series.map((s,i)=>({name:s.name,color:option.color[i]!}))} selected={Object.fromEntries(option.series.map(s=>[s.name,active===null||s.name===active]))} onItemClick={name=>setActive(name)}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站铁路资料来源</a><p className="chart-parity__status">开发中：36纵向／45横向原始线段、65城市原坐标，初始两组显示、点击单选，双圆端点及共享 Canvas 白色拖尾。保留重复线段和原始可疑坐标。尚未完成逐帧一致性验收；固定画布、阴影、缩放时轨迹与特效尺寸仍有差异。</p></div>;
}
