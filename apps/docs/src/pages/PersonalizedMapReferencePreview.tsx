import {useState} from 'react';
import {MapChart} from '@sia-ui/react';
import type {GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import source from './chartPersonalizedMapSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import image from './chartPersonalizedMapImage.json';

export function PersonalizedMapReferencePreview(){
 const [value]=useState(()=>Math.round(Math.random()*1000));
 const series=source[0]!.option.series[0]!;
 return <div className="chart-personalized-map">
  <MapChart width={1000} height={530} viewBoxSize={[1000,530]} animation={false}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} longitudeRatio={.75} plotBounds={{x:10,y:10,width:680,height:488}}
   geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']}
   showVisualMap={false} showLabels={false} showEmphasisLabels selectedMode="multiple"
   regionStyle={{fill:'orange',stroke:'lightgreen',strokeWidth:2,filter:'none'}} emphasisRegionStyle={{fill:'#32cd32',stroke:'#fff',strokeWidth:2}}
   emphasisLabelStyle={{fill:'#fff'}} tooltipFormatter={()=>null} markPointTooltipFormatter={()=>null}
   insetStyle={{fill:'orange',stroke:'lightgreen',strokeWidth:2}} insetLabelStyle={{display:'none'}}
   data={[{name:'广东',value,regionStyle:{fill:'#32cd32'},emphasisRegionStyle:{fill:'#cd5c5c',stroke:'yellow',strokeWidth:5},showLabels:true,showEmphasisLabels:false,labelStyle:{fill:'#fff',fontSize:15},emphasisLabelStyle:{fill:'blue'}}]}
   markPoints={[{name:'天津',value:350,label:'350',size:10,style:{stroke:'skyblue',strokeWidth:2},emphasisStyle:{strokeWidth:4},coordinate:series.geoCoord.天津 as [number,number],symbol:'pin',pinShape:'arc',entrance:true,color:'skyblue'},{name:'上海',value:103,label:'103',size:10,style:{stroke:'skyblue',strokeWidth:2},emphasisStyle:{strokeWidth:4},coordinate:series.geoCoord.上海 as [number,number],symbol:'pin',pinShape:'arc',entrance:true,color:'skyblue'},{name:'echarts',entrance:true,coordinateSpace:'svg',coordinate:[310,110],size:21,imageSrc:image.data}]}/>
  <p className="chart-parity__status">开发中：广东独立普通/高亮样式、标签反转、区域多选、标点内数值、固定坐标原图标、圆弧图钉和两秒入场缩放已接入。精确投影布局、标签排版及逐帧动画一致性仍未通过验收。</p>
 </div>;
}
