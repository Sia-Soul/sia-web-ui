import {useRef,useState} from 'react';
import {ChartComposite,ChartLegend,ChartDataEditor,MapChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps,MapMarkLine} from '@sia.soul/sia-react-ui';
import source from './chartAirRoutesSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const option=source[0]!.option,original=option.series[0]!.geoCoord as Record<string,number[]>;
export function AirRoutesReferencePreview(){
 const coordinates=original;
 const [selected,setSelected]=useState<Record<string,boolean>>({}),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 const lines:MapMarkLine[]=option.series.flatMap((series,index)=>selected[series.name]===false?[]:series.markLine.data.map(pair=>{
  const from=pair[0]!.name,to=pair[1]!.name,name=from+' > '+to;
  return {name,seriesName:series.name,source:coordinates[from]! as [number,number],target:coordinates[to]! as [number,number],color:option.color[index],width:1,curveness:0,dashed:true,endpointSizes:[2,4] as const,tooltip:name};
 }));
 const editor=<ChartDataEditor series={option.series.map(series=>({name:series.name,data:series.data}))} onApply={()=>{}}/>;
 return <div className="chart-air-routes"><ChartComposite ref={chart} width={1000} height={560} ariaLabel="map10 南航主要航空线路" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} titleAlign="center" geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']}
   longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}} data={[]} showVisualMap={false} showLabels={false} regionHoverable={false} showMap={lines.length>0} outOfRangeColor="#ccc" regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}}
   roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]} markLines={lines}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:()=>{setSelected({});setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map10').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:140,height:110,pointerEvents:'none',content:<SiaChart width={140} height={110} viewBoxSize={[140,110]} className="sia-chart--overlay"><ChartLegend x={10} y={20} align="start" orientation="vertical" items={option.series.map((series,index)=>({name:series.name,color:option.color[index]!}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:current[name]===false}))}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：150条原始航线、专用城市坐标、三色图例、虚线和端点、空系列数据视图、漫游、标线及导出已验证。不启用原站未配置的流光。箭头几何、虚线节距、固定布局和入场动画仍未通过原站完整一致性验收。</p></div>;
}
