import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartLegend,MapChart,SiaChart} from '@sia-ui/react';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import source from './chartLargeMapPointSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import {createLargeMapPointData} from './chartLargeMapPointData';
const option=source[0]!.option,places=source[0]!.bindings.placeList;
const colors=Object.fromEntries(option.legend.data.map((name,i)=>[name,option.color[i]!]));
export function LargeMapPointReferencePreview(){
 const [groups]=useState(()=>createLargeMapPointData(places)),[selected,setSelected]=useState<Record<string,boolean>>({强:true,中:true,弱:true}),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null),visible=groups.filter(g=>selected[g.name]);
 return <div className="chart-large-map-point chart-migration"><ChartComposite ref={chart} width={1000} height={560} style={{background:'#1b1b1b'}} ariaLabel="map15 大规模MarkPoint特效" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext} titleAlign="center" animation={false}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:65,width:700,height:440}}
   data={[]} showLabels={false} showVisualMap={false} regionHoverable={false} showMap={visible.length>0} roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]}
   outOfRangeColor="#1b1b1b" regionStyle={{stroke:'rgba(100,149,237,1)',strokeWidth:1.5,opacity:1,filter:'none'}} insetStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,1)',strokeWidth:1.5}} insetLabelStyle={{fill:'#fff'}}
   largeMarkPoints={visible.map(g=>({name:g.name,color:colors[g.name]!,size:g.size,symbol:g.symbol,points:g.data.map(p=>p.geoCoord)}))}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={groups.map(g=>({name:g.name,data:[]}))} onApply={()=>{}}/>,onRestore:()=>{setSelected({强:true,中:true,弱:true});setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map15').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:150,height:110,pointerEvents:'auto',zIndex:5,content:<SiaChart width={150} height={110} viewBoxSize={[150,110]} className="sia-chart--overlay"><ChartLegend x={10} y={20} orientation="vertical" align="start" items={option.legend.data.map(name=>({name,color:colors[name]!}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:!current[name]}))}/></SiaChart>}
 ]}/>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：3000弱点、1000中点、190强点，原随机规则、20通道批量闪烁、图例、漫游、标线、数据视图和当前特效导出。完整帧序列/阴影混合尚未原站像素验收，缩放采用整体变换，固定画布及初始随机帧仍有差异。</p></div>;
}
