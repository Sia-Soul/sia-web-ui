import {useState} from 'react';
import {MapChart} from '@sia-ui/react';
import type {GeoJsonFeatureCollection} from '@sia-ui/react';
import world from './chartWorldSource.json';
import source from './chartWorldNamesSource.json';
export function WorldNamesReferencePreview(){
 const [selected,setSelected]=useState<string[]>([]),[message,setMessage]=useState('');
 return <div className="chart-world-names"><MapChart width={1000} height={530} viewBoxSize={[1000,530]} ariaLabel="map5 中文世界地图单选"
  geoJson={world.geography as unknown as GeoJsonFeatureCollection} nameMap={source[0]!.option.series[0]!.nameMap} data={[]}
  showVisualMap={false} showLabels={false} showEmphasisLabels roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]}
  longitudeRatio={1} plotBounds={{x:30,y:30,width:940,height:440}} selectedMode="single" selected={selected}
  onSelectionChange={names=>{setSelected(names);setMessage('当前选择： '+names.join(' '));}} tooltipFormatter={name=>name}
  regionStyle={{fill:'#ccc',stroke:'rgba(0,0,0,0)',strokeWidth:1,filter:'none',opacity:1}} emphasisRegionStyle={{fill:'rgba(255,215,0,0.8)'}}
  labelStyle={{fill:'rgb(139,69,19)',fontSize:12,fontWeight:400,textShadow:'none'}} emphasisLabelStyle={{fill:'rgb(100,0,0)'}}/>
  <p role="status" aria-label="世界地图选择结果">{message}</p><p className="chart-parity__status">开发中：177项原站中文映射、强调标签、单选结果事件与漫游。保留原站历史译名，投影布局和动画未通过完整一致性验收。</p>
 </div>;
}
