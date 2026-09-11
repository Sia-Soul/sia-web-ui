/// <reference types="vite/client" />
import {useEffect,useRef,useState} from 'react';
import {ChartComposite,ChartLegend,MapChart,SiaChart} from '@sia-ui/react';
import type {GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import china from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import {mapSwitchTypes,createMapSwitchValues,wheelMapSwitchIndex,clickMapSwitchIndex} from './chartMapSwitchData';
const loaders=import.meta.glob<{default:{geography:GeoJsonFeatureCollection}}>('./chartProvinceMaps/*.json');
export function MapSwitchReferencePreview(){
 const [index,setIndex]=useState(0),[data]=useState(createMapSwitchValues),[visible,setVisible]=useState(true);
 const [range,setRange]=useState<[number,number]>([0,1000]);
 const [loaded,setLoaded]=useState<{name:string;geo:GeoJsonFeatureCollection}>(),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),name=mapSwitchTypes[index]!;
 useEffect(()=>{const node=host.current;if(!node)return;const wheel=(event:WheelEvent)=>{event.preventDefault();event.stopPropagation();setIndex(current=>wheelMapSwitchIndex(current,event.deltaY));};node.addEventListener('wheel',wheel,{passive:false});return ()=>node.removeEventListener('wheel',wheel);},[]);
 useEffect(()=>{setVisible(true);setRange([0,1000]);setError('');let cancelled=false;
  if(name==='china'){setLoaded(undefined);return;}
  const id=china.geography.features.find(feature=>feature.properties.name===name)?.id;
  const load=loaders[`./chartProvinceMaps/${id}.json`];
  if(!load){setError(`缺少 ${name} 原始地图`);return;}
  load().then(module=>{if(!cancelled)setLoaded({name,geo:module.default.geography});}).catch(reason=>{if(!cancelled)setError(String(reason));});
  return ()=>{cancelled=true;};
 },[name]);
 const geo=name==='china'?china.geography as unknown as GeoJsonFeatureCollection:loaded?.name===name?loaded.geo:undefined;
 const hint=name==='china'?'滚轮切换或点击进入该省':'滚轮切换省份或点击返回全国';
 return <div ref={host} className="chart-map-switch" data-map-type={name}>
  {error?<p role="alert">{error}</p>:null}
  {!geo&&!error?<p role="status">正在加载 {name} 原始地图…</p>:null}
  <ChartComposite width={900} height={530} ariaLabel="map3 全国与34省市地图切换" layers={[
   {key:'map',content:geo?<MapChart key={name} width={900} height={530} viewBoxSize={[900,530]} title="全国34个省市自治区" description={`${name} （滚轮或点击切换）`} geoJson={geo}
    geographicInsets={name==='china'?[inset.inset] as unknown as MapChartProps['geographicInsets']:[]} longitudeRatio={.75} plotBounds={{x:110,y:65,width:700,height:400}}
    showMap={visible} data={visible?data:[]} valueDomain={[0,1000]} colors={['#ffff00','#ffa500']} outOfRangeColor="#ccc" showLabels showEmphasisLabels
    selectedMode="single" selected={[]} onSelectionChange={names=>{if(names[0])setIndex(current=>clickMapSwitchIndex(current,names[0]!));}}
    tooltipFormatter={region=><>{hint}<br/>{region}</>} calculableVisualMap visualRange={range} onVisualRangeChange={setRange}
    visualMapLayout={{svgHandles:true,x:5,y:355,width:140,height:20,orientation:'vertical',label:'',endLabels:['低','高']}}
    labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
    regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}/>:null},
   {key:'legend',left:740,top:0,width:160,height:40,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={160} height={40} viewBoxSize={[160,40]} animation={false}><ChartLegend x={150} y={20} align="end" items={[{name:'随机数据',color:'#ff7f50'}]} selected={{'随机数据':visible}} onItemClick={()=>setVisible(current=>!current)}/></SiaChart>},
  ]}/>
  <p className="chart-parity__status">开发中：滚轮循环全国及34省市、点击进入/返回；363市县随机值仅初始化一次。省级地图异步加载、双向值域联动；完整视觉与动画一致性仍待验收。</p>
 </div>;
}
