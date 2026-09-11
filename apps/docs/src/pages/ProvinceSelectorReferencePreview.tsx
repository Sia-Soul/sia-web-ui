/// <reference types="vite/client" />
import {useEffect,useState} from 'react';
import {ChartComposite,ChartDataEditor,ChartLegend,ChartVisualMap,MapChart,SiaChart} from '@sia-ui/react';
import type {GeoJsonFeatureCollection,MapDatum,MapChartProps} from '@sia-ui/react';
import china from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import {createProvinceSelectorValues} from './chartProvinceSelectorData';

const loaders=import.meta.glob<{default:{geography:GeoJsonFeatureCollection}}>('./chartProvinceMaps/*.json');
export function ProvinceSelectorReferencePreview(){
 const [selected,setSelected]=useState<string[]>([]),[data,setData]=useState<MapDatum[]>([]);
 const [loaded,setLoaded]=useState<{name:string;geo:GeoJsonFeatureCollection}>(),[error,setError]=useState('');
 const [visible,setVisible]=useState(true);
 const name=selected[0];
 useEffect(()=>{
  let cancelled=false;setLoaded(undefined);setError('');
  if(!name)return;
  const id=china.geography.features.find(feature=>feature.properties.name===name)?.id;
  const load=loaders[`./chartProvinceMaps/${id}.json`];
  if(!load){setError(`未找到 ${name} 的原始地理数据`);return;}
  load().then(module=>{if(!cancelled)setLoaded({name,geo:module.default.geography});}).catch(reason=>{if(!cancelled)setError(String(reason));});
  return ()=>{cancelled=true;};
 },[name]);
 const choose=(names:string[])=>{setSelected(names);setData(names.length?createProvinceSelectorValues():[]);setVisible(true);};
 const dataView=name?<ChartDataEditor series={[{name:'随机数据（原站全部 363 市县顺序）',data:data.map(item=>item.value)}]} onApply={rows=>setData(data.map((item,index)=>({...item,value:rows[0]![index]!})))}/>:<p>请选择省份以查看随机数据。</p>;
 return <>
  {error?<p role="alert">{error}</p>:null}
  {name&&!loaded&&!error?<p role="status">正在加载 {name} 原始地图…</p>:null}
  <div className="chart-parity__viewport chart-province-selector">
   <ChartComposite width={1000} height={500} ariaLabel="mix5 全国与省级地图选择器" layers={[
    {key:'tools',content:<SiaChart width={1000} height={500} viewBoxSize={[1000,500]} ariaLabel="省级地图工具箱" toolbox={{orientation:'vertical',features:['mark','dataView'],dataView}}/>},
    {key:'selector',width:330,height:310,content:<MapChart width={330} height={310} viewBoxSize={[330,310]} geoJson={china.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:10,y:10,width:290,height:240}} data={[]} colors={['#ccc','#ccc']} showVisualMap={false} showLabels={false} showEmphasisLabels tooltipFormatter={name=>name} selectedMode="single" selected={selected} onSelectionChange={choose} roam animation={false} ariaLabel="全国省份选择器"/>},
    ...(loaded&&loaded.name===name&&visible?[{key:'province',left:350,top:40,width:590,height:400,content:<MapChart key={name} width={590} height={400} viewBoxSize={[590,400]} geoJson={loaded.geo} longitudeRatio={.75} plotBounds={{x:10,y:20,width:560,height:340}} data={data} valueDomain={[0,1000]} colors={['#ffff00','#ffa500']} showVisualMap={false} roam animation={false} seriesName="随机数据" ariaLabel={`${name} 省级地图`}/>}]:[]),
    ...(name?[{key:'legend',left:730,top:0,width:200,height:40,content:<SiaChart width={200} height={40} viewBoxSize={[200,40]} ariaLabel="省级数据图例"><ChartLegend x={190} y={16} align="end" items={[{name:'随机数据',color:'#ffa500',disabled:!visible}]} onItemClick={()=>setVisible(value=>!value)}/></SiaChart>},{key:'range',left:710,top:445,width:240,height:55,content:<SiaChart width={240} height={55} viewBoxSize={[240,55]} ariaLabel="省级数据色域"><ChartVisualMap min={0} max={1000} colors={['#ffff00','#ffa500']} x={10} y={16} width={200}/></SiaChart>}]:[]),
   ]}/>
  </div>
  <p className="chart-parity__status">开发中：全国单选并按需加载 34 份原始省级地图，每次选择生成完整 363 市县值；取消选择清理右图、图例和色带。逐省区域数、连续切换、编辑联动、真实鼠标点击/拖动不误选及两图独立缩放已验证。差异：地图边框/选中色、色带文字、漫游缩放范围与速度尚未逐项对齐；切换或隐藏后再显示省级图会重置其漫游视图；南海附图仅展示。原站历史区划与缺失市县值保留，不擅自补造数据。</p>
 </>;
}
