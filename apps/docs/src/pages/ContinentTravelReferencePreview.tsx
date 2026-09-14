import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,MapChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,GeoJsonFeatureCollection} from '@sia.soul/sia-react-ui';
import geography from './chartContinentGeography.json';
import source from './chartContinentTravelSource.json';
const option=source[0]!.option,series=option.series[0]!;
const coordinates=Object.fromEntries(geography.features.map(feature=>{
 const points=feature.geometry.coordinates.flat(2),xs=points.map(p=>p[0]!),ys=points.map(p=>p[1]!);
 return [feature.properties.name,[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2] as const];
}));
const normalize=([x,y]:readonly [number,number])=>[x<-168.5&&y>63.8?x+360:x,y] as const;
const labelOffsets=Object.fromEntries(Object.entries(series.textFixed).map(([name,offset])=>[name,[offset[0]!,offset[1]!] as const]));
export function ContinentTravelReferencePreview(){
 const [data,setData]=useState(series.data),[error,setError]=useState('');
 const chart=useRef<ChartCompositeRef>(null);
 return <div className="chart-continent-travel"><ChartComposite ref={chart} width={1000} height={560} ariaLabel="map13 洲际出境统计" layers={[
  {key:'map',content:<MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} description={option.title.subtext}
   geoJson={geography as unknown as GeoJsonFeatureCollection} coordinateTransform={normalize} longitudeRatio={.75} plotBounds={{x:80,y:75,width:850,height:390}}
   labelCoordinates={coordinates} labelOffsets={labelOffsets} data={data} clampVisualValues valueDomain={[0,1000]} colors={['lightskyblue','yellow','orangered']} outOfRangeColor="#ccc" showLabels showEmphasisLabels
   visualMapLayout={{svgHandles:true,x:5,y:370,width:140,height:20,orientation:'vertical',label:'',endLabels:['冷','热']}}
   tooltipFormatter={(name,datum)=><>{series.name}<br/>{name} : {datum?.value}万人次 （{((datum?.value??0)/98.19).toFixed(2)}%）</>}
   labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
   regionStyle={{stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   toolbox={{orientation:'vertical',features:['mark','dataView','restore','saveAsImage'],dataView:<ChartDataEditor series={[{name:series.name,data:data.map(d=>d.value)}]} onApply={rows=>setData(data.map((d,i)=>({...d,value:rows[0]![i]!})))}/>,onRestore:()=>{setData(series.data);setError('');},onSaveAsImage:()=>{chart.current?.saveAsImage('map13').catch(reason=>setError(String(reason)));}}}/>}
 ]}/>{error?<p role="alert">{error}</p>:null}<a href={option.title.link} target="_blank" rel="noreferrer">原站标题链接</a>{' · '}<a href={option.title.sublink} target="_blank" rel="noreferrer">原站作者链接</a><p className="chart-parity__status">开发中：原始六大洲地图与出境人次、百分比提示、原始标签偏移、只读色阶双向悬停联动、编辑还原和导出。固定画布、标题链接位置、字体和完整视觉动画仍有差异，未通过完整一致性验收。</p></div>;
}
