import {useRef,useState} from 'react';
import {ChartComposite,ChartLegend,ChartDataEditor,MapChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps,MapMarkLine,MapMarkPoint} from '@sia.soul/sia-react-ui';
import source from './chartMigrationSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const option=source[0]!.option,coordinates=option.series[0]!.geoCoord as Record<string,number[]>;
export function MigrationReferencePreview(){
 const [active,setActive]=useState('北京 Top10'),[range,setRange]=useState<[number,number]>([0,100]),[error,setError]=useState('');
 const [periods]=useState(()=>Array.from({length:30},()=>1500+Math.random()*1000));
 const chart=useRef<ChartCompositeRef>(null);
 const lines:MapMarkLine[]=option.series.flatMap((series,index)=>index>0&&series.name!==active?[]:series.markLine.data.map(pair=>{
  const from=pair[0]!.name,to=pair[1]!.name,name=from+' > '+to,value='value' in pair[1]!?(pair[1] as {value:number}).value:undefined;
  return {name,seriesName:series.name,source:coordinates[from]! as [number,number],target:coordinates[to]! as [number,number],color:index===0?'rgba(30,144,255,0.5)':undefined,value,visualMap:index>0,width:1,endpointSizes:index===0?[0,1]:[2,4],endpointSymbols:index===0?['none','circle']:['circle','arrow'],curveMode:'directional',curveness:.2,dashed:index===0,tooltip:name,movingEffect:index>0?{period:30,color:'#fff',radius:1,shadowBlur:10,trailAlpha:.95}:undefined};
 }));
 const points:MapMarkPoint[]=option.series.flatMap((series,index)=>index===0||series.name!==active?[]:(series.markPoint!.data.map((datum,j)=>({...datum,seriesName:series.name,coordinate:coordinates[datum.name]! as [number,number],visualMap:true,showEmphasisLabel:true,symbol:'emptyCircle',size:10+datum.value/10,scaleEffect:{duration:periods[(index-1)*10+j]!,scaleSize:2}}))));
 return <div className="chart-migration" style={{background:'#1b1b1b'}}><ChartComposite style={{background:'#1b1b1b'}} ref={chart} width={1000} height={560} ariaLabel="map11 模拟迁徙" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center"
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}}
   insetStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,1)',strokeWidth:.5}} insetLabelStyle={{fill:'#fff'}} data={[]} showLabels={false} regionHoverable={false} outOfRangeColor="#1b1b1b" regionStyle={{stroke:'rgba(100,149,237,1)',strokeWidth:.5,filter:'none',opacity:1}}
   roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]} markLines={lines} markPoints={points} markPointTooltipFormatter={point=>point.name}
   valueDomain={[0,100]} colors={['#00ffff','#00ff00','#ffff00','#ffa500','#ff3333']} visualRange={range} onVisualRangeChange={setRange} calculableVisualMap visualMapLayout={{svgHandles:true,x:5,y:355,width:140,height:20,orientation:'vertical',label:''}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={option.series.map(series=>({name:series.name,data:series.data}))} onApply={()=>{}}/>,onRestore:()=>{setActive('北京 Top10');setRange([0,100]);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map11').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:150,height:110,pointerEvents:'none',content:<SiaChart width={150} height={110} viewBoxSize={[150,110]} className="sia-chart--overlay"><ChartLegend x={10} y={20} align="start" orientation="vertical" items={option.series.slice(1).map((s,i)=>({name:s.name,color:option.color[i]!}))} selected={Object.fromEntries(option.series.slice(1).map(s=>[s.name,s.name===active]))} onItemClick={name=>setActive(name)}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：150背景曲线、三组单选Top10原值、参数化运动、0.95历史帧拖尾、缩放标点、深色导出、漫游及标线已验证。SVG残影与Canvas整层合成、阴影、缩放后的速度和完整动画观感尚未通过原站一致性验收。</p></div>;
}
