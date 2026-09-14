import {useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartLegend,ChartVisualMap,MapChart,PieChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {GeoJsonFeatureCollection} from '@sia.soul/sia-react-ui';
import snapshot from './chartMixedGdpSource.json';
import geography from './chartChinaSource.json';
import insetSource from './chartChinaInsetSource.json';
import type {MapChartProps} from '@sia.soul/sia-react-ui';

const option=snapshot[0]!.option;
const original=option.series[0]!.data as {name:string;value:number;selected?:boolean}[];
const initial=original.filter(item=>item.selected).map(item=>item.name);
const palette=['#c23531','#2f4554','#61a0a8','#d48265','#91c7ae','#749f83','#ca8622','#bda29a'];
export function MixedGdpReferencePreview(){
 const [data,setData]=useState(original);
 const [selected,setSelected]=useState(initial);
 // Original MAP_SELECTED callback filters in map-series order, not click order.
 const comparison=data.filter(item=>selected.includes(item.name)).map((item,index)=>({...item,color:palette[index%palette.length]}));
 const legendHeight=Math.max(45,Math.ceil(comparison.length/4)*24);
 const extraHeight=legendHeight-45;
 const dataView=<ChartDataEditor series={[{name:'2011全国GDP分布（原站省份顺序）',data:data.map(item=>item.value)}]} onApply={rows=>{
  if(rows[0]!.some(value=>value<0))throw new Error('GDP 必须为非负数');
  setData(data.map((item,index)=>({...item,value:rows[0]![index]!})));
 }}/>;
 return <>
  <div className="chart-parity__viewport chart-mixed-gdp">
   <ChartComposite width={1000} height={500+extraHeight} ariaLabel="mix3 全国 GDP 地图与玫瑰图联动" layers={[
    {key:'map',height:500,content:<MapChart longitudeRatio={0.75} geographicInsets={[insetSource.inset] as unknown as MapChartProps['geographicInsets']} geoJson={geography.geography as unknown as GeoJsonFeatureCollection} width={1000} height={500} viewBoxSize={[1000,500]} title={option.title.text} description={option.title.subtext} seriesName="2011全国GDP分布" data={data} plotBounds={{x:25,y:70,width:500,height:350}} valueDomain={[0,55000]} colors={['#e0ffff','#006edd']} showVisualMap={false} animation={false} selectedMode="multiple" selected={selected} onSelectionChange={setSelected} toolbox={{orientation:'vertical',features:['mark','dataView'],dataView}}/>},
    {key:'pie',left:550,top:50+extraHeight,width:400,height:380,content:<PieChart outsideLabelLayout={{top:20,bottom:340,gap:18}} width={400} height={380} viewBoxSize={[400,380]} center={[200,175]} series={[{name:'2011全国GDP对比',data:comparison,innerRadius:30,outerRadius:120,rose:'area'}]} showLegend={false} animation={false} ariaLabel="2011全国GDP对比"/>},
    {key:'legend',left:540,top:0,width:410,height:legendHeight,content:<SiaChart width={410} height={legendHeight} viewBoxSize={[410,legendHeight]} animation={false} ariaLabel="GDP 对比图例"><ChartLegend items={comparison.map(item=>({name:item.name,color:item.color!}))} x={400} y={16} align="end" maxWidth={400}/></SiaChart>},
    {key:'range',left:20,top:440,width:250,height:60,content:<SiaChart width={250} height={60} viewBoxSize={[250,60]} animation={false} ariaLabel="GDP 色域"><ChartVisualMap min={0} max={55000} colors={['#e0ffff','#006edd']} x={10} y={24} width={180} label="GDP（亿元）"/></SiaChart>},
   ]}/>
  </div>
  <p className="chart-parity__status">开发中：31 项原站 GDP 数据、34 个原站地理区域及南海附图，地图采用 0.75 经纬缩放比例。默认北京/上海/广东，多选地图同步玫瑰图及不可筛选图例，关闭动画。全量选择、空选择、编辑联动、长图例及 31 项标签避让已验证。差异：南海附图目前仅展示，不可选择；地图框位置、选中发光样式、色带端点文字、动态增高布局及标签左右分列仍未通过原站视觉一致性验收。</p>
 </>;
}
