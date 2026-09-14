import {useState} from 'react';
import {MapChart} from '@sia.soul/sia-react-ui';
import type {GeoJsonFeatureCollection,MapChartProps} from '@sia.soul/sia-react-ui';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import source from './chartMapSelectionSource.json';

export function MapSelectionReferencePreview(){
 const [selected,setSelected]=useState<string[]>(()=>source[0]!.option.series[0]!.data.filter(item=>item.selected).map(item=>item.name));
 const [message,setMessage]=useState('');
 return <div className="chart-map-selection">
  <MapChart width={900} height={500} viewBoxSize={[900,500]} aria-label="map2 中国地图多选" data={[]} showVisualMap={false}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']}
   longitudeRatio={.75} plotBounds={{x:80,y:30,width:740,height:440}} selectedMode="multiple" selected={selected}
   onSelectionChange={names=>{setSelected(names);setMessage('当前选择： '+names.join(' '));}}
   showLabels showEmphasisLabels tooltipFormatter={name=>name}
   regionStyle={{fill:'#ccc',stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}}
   emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
   labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}
  />
  <p role="status" aria-label="地图选择结果">{message}</p>
  <p className="chart-parity__status">开发中：原站广东默认选中、多地区选择及选择结果事件；无数值数据、不显示值域。固定画布和标签布局、动画未通过完整一致性验收。</p>
 </div>;
}
