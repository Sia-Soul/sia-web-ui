import {useMemo,useRef,useState} from 'react';
import {ChartComposite,ChartLegend,ChartDataEditor,MapChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection,MapChartProps} from '@sia.soul/sia-react-ui';
import {createMapSalesData,aggregateMapSales} from './chartMapSalesData';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
const colors=['#ff7f50','#87cefa','#da70d6'];
export function MapSalesReferencePreview(){
 const [original]=useState(()=>createMapSalesData()),[series,setSeries]=useState(original);
 const [selected,setSelected]=useState<Record<string,boolean>>({}),[range,setRange]=useState<[number,number]>([0,2500]),[error,setError]=useState('');
 const composite=useRef<ChartCompositeRef>(null);
 const data=useMemo(()=>aggregateMapSales(series,selected).map(region=>({...region,legendSymbols:region.contributors.map(item=>({name:item.name,color:colors[series.findIndex(s=>s.name===item.name)]!}))})),[series,selected]);
 const editor=<ChartDataEditor series={series.map(item=>({name:item.name,data:item.data.map(point=>point.value)}))} onApply={rows=>setSeries(series.map((item,i)=>({...item,data:item.data.map((point,j)=>({...point,value:rows[i]![j]!}))})))}/>;
 const restore=()=>{setSeries(original);setSelected({});setRange([0,2500]);setError('');};
 return <><div className="chart-parity__viewport chart-map-sales"><ChartComposite ref={composite} width={900} height={500} ariaLabel="map1 三系列iphone销量地图" layers={[
  {key:'map',left:0,top:0,width:900,height:500,content:<MapChart visualMapLayout={{svgHandles:true,x:5,y:330,width:140,height:20,orientation:'vertical',label:'',endLabels:['低','高']}} labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}} regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}} scaleLimit={null} outOfRangeColor="#ccc" roamController width={900} height={500} viewBoxSize={[900,500]} title="iphone销量" description="纯属虚构" titleAlign="center" geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:160,y:70,width:610,height:360}} data={data} showLabels showEmphasisLabels valueDomain={[0,2500]} colors={['#e0ffff','#006edd']} calculableVisualMap visualRange={range} onVisualRangeChange={setRange} tooltipFormatter={(name)=>{const row=data.find(item=>item.name===name);return <><strong>{row?.contributors.map(item=>item.name).join(' ')}</strong><span>{name} : {row?.value??'-'}</span></>;}} toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:restore,onSaveAsImage:()=>{composite.current?.saveAsImage('map1').catch(reason=>setError(String(reason)));}}}/>},
  {key:'legend',left:0,top:0,width:150,height:120,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={150} height={120} viewBoxSize={[150,120]} animation={false}><ChartLegend x={10} y={20} align="start" orientation="vertical" items={series.map((item,i)=>({name:item.name,color:colors[i]!}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:current[name]===false}))}/></SiaChart>},
 ]}/></div>{error&&<p role="alert">{error}</p>}<p className="chart-parity__status">开发中：保留原站60次随机数规则、三系列地区求和、图例筛选、双向值域联动、独立方向/缩放控制器、数据编辑、还原与图片导出。固定画布布局、文字测量、标签重叠与动画尚未通过原站完整一致性验收。</p></>;
}
