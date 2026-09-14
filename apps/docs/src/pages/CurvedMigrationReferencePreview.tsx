import {useRef,useState} from 'react';
import {ChartComposite,ChartLegend,ChartDataEditor,MapChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps,MapMarkLine} from '@sia.soul/sia-react-ui';
import source from './chartCurvedMigrationSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import {curvedMigrationGroups} from './chartCurvedMigrationData';
const option=source[0]!.option;
export function CurvedMigrationReferencePreview(){
 const [active,setActive]=useState('北京'),[range,setRange]=useState<[number,number]>([0,100]),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null),group=curvedMigrationGroups.find(item=>item.name===active)!;
 const lines:MapMarkLine[]=group.lines.map(line=>({...line,seriesName:active,visualMap:true,reveal:{initialDuration:2000,updateDuration:option.animationDurationUpdate},shadowBlur:10,width:1,endpointSizes:[2,4],endpointSymbols:['circle','arrow'],curveMode:'directional',tooltip:line.name,movingEffect:{period:30,color:'#fff',radius:1,shadowBlur:10,trailAlpha:.95}}));
 return <div className="chart-curved-migration" data-active-series={active} style={{background:option.backgroundColor}}><ChartComposite style={{background:option.backgroundColor}} ref={chart} width={1000} height={560} ariaLabel="map21 多曲率双向迁徙" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center"
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}}
   insetStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,1)',strokeWidth:.5}} insetLabelStyle={{fill:'#fff'}} data={[]} showLabels={false} regionHoverable={false} outOfRangeColor="#1b1b1b" regionStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,1)',strokeWidth:.5,filter:'none',opacity:1}}
   roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]} markLines={lines} markLineEffectRenderer="canvas"
   valueDomain={[0,100]} colors={[...option.dataRange.color].reverse()} visualRange={range} onVisualRangeChange={setRange} calculableVisualMap visualMapLayout={{svgHandles:true,x:5,y:355,width:140,height:20,orientation:'vertical',label:''}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={option.series.map(series=>({name:series.name,data:series.data}))} onApply={()=>{}}/>,onRestore:()=>{setActive('北京');setRange([0,100]);setError('');},onSaveAsImage:()=>chart.current?.saveAsImage('map21').catch(reason=>setError(String(reason)))}}/>},
  {key:'legend',left:0,top:0,width:150,height:110,pointerEvents:'none',content:<SiaChart width={150} height={110} viewBoxSize={[150,110]} className="sia-chart--overlay"><ChartLegend x={10} y={20} align="start" orientation="vertical" items={option.series.map((s,i)=>({name:s.name,color:option.color[i]!}))} selected={Object.fromEntries(option.series.map(s=>[s.name,s.name===active]))} onItemClick={setActive}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：三组各十条原始双向线路、0.2–0.6 逐线曲率、单选图例、共享值域、Canvas 运动拖尾和 2000ms 线路绘制已接入。阴影合成、缩放后时序、值域端值重复及完整逐帧视觉仍未通过一致性验收。</p></div>;
}
