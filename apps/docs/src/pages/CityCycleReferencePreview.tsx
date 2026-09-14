/// <reference types="vite/client" />
import {useEffect,useRef,useState} from 'react';
import {MapChart} from '@sia.soul/sia-react-ui';
import type {GeoJsonFeatureCollection} from '@sia.soul/sia-react-ui';
import source from './chartCityCycleSource.json';
import {cityCycleEntries,cityCycleNext} from './chartCityCycleData';
const loaders=import.meta.glob<{default:GeoJsonFeatureCollection}>('./chartCityMaps/*.json');
const option=source[0]!.option;
export function CityCycleReferencePreview(){
 const [index,setIndex]=useState(0),[loaded,setLoaded]=useState<{id:string;geo:GeoJsonFeatureCollection}>(),[error,setError]=useState('');
 const [name,id]=cityCycleEntries[index]!,host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const node=host.current;if(!node)return;
  const wheel=(event:WheelEvent)=>{event.preventDefault();event.stopPropagation();setIndex(current=>cityCycleNext(current,event.deltaY));};
  node.addEventListener('wheel',wheel,{passive:false});return ()=>node.removeEventListener('wheel',wheel);
 },[]);
 useEffect(()=>{let cancelled=false;setError('');
  const load=loaders[`./chartCityMaps/${id}.json`];
  if(!load){setError(`缺少 ${name} 原始地图`);return;}
  load().then(module=>{if(!cancelled)setLoaded({id,geo:module.default});}).catch(reason=>{if(!cancelled)setError(String(reason));});
  return ()=>{cancelled=true;};
 },[id,name]);
 const geo=loaded?.id===id?loaded.geo:undefined;
 return <div ref={host} className="chart-city-cycle" data-city-index={index} data-city-name={name}>
  {error?<p role="alert">{error}</p>:null}
  {!geo&&!error?<p role="status">正在加载 {name} 原始地图…</p>:null}
  {geo?<MapChart key={id} width={1000} height={530} viewBoxSize={[1000,530]} title={<a href={option.title.link} target="_blank" rel="noreferrer" style={{color:'inherit',textDecoration:'none'}}>{option.title.text}</a>} description={`${name} （滚轮或点击切换）`} showVisualMap={false} animation={false}
   geoJson={geo} data={[]} longitudeRatio={.75} plotBounds={{x:11,y:11,width:978,height:508}} showLabels showEmphasisLabels
   selectedMode="single" selected={[]} onSelectionChange={names=>{if(names.length)setIndex(current=>cityCycleNext(current,1));}}
   tooltipFormatter={region=><>滚轮或点击切换<br/>{region}</>}
   outOfRangeColor="#ccc" labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{fill:'#ccc',stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}/>:null}
  <p className="chart-parity__status">开发中：344 项原始城市/县边界本地按需加载，滚轮前后切换、点击区域进入下一项及首尾循环已接入。字体、标签布局、强调细节和完整视觉一致性仍待核对。</p>
 </div>;
}
