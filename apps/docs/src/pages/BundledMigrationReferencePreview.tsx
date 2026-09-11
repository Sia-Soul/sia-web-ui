import {useState} from 'react';
import {MapChart} from '@sia-ui/react';
import type {GeoJsonFeatureCollection,MapChartProps} from '@sia-ui/react';
import source from './chartBundledMigrationSource.json';
import geography from './chartChinaSource.json';
import inset from './chartChinaInsetSource.json';
import {createBundledMigrationData} from './chartBundledMigrationData';
const option=source[0]!.option;
export function BundledMigrationReferencePreview(){
 const [data]=useState(createBundledMigrationData);
 return <div className="chart-bundled-migration" style={{background:option.backgroundColor}}>
  <MapChart width={1000} height={560} viewBoxSize={[1000,560]} title={option.title.text} titleAlign="center" animation={false}
   geoJson={geography.geography as unknown as GeoJsonFeatureCollection} geographicInsets={[inset.inset] as unknown as MapChartProps['geographicInsets']} longitudeRatio={.75} plotBounds={{x:150,y:35,width:700,height:490}}
   data={[]} showLabels={false} showVisualMap={false} regionHoverable={false} outOfRangeColor="#1b1b1b" regionStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,0.2)',strokeWidth:.5,filter:'none',opacity:1}}
   insetStyle={{fill:'#1b1b1b',stroke:'rgba(100,149,237,0.2)',strokeWidth:.5}} insetLabelStyle={{fill:'#fff'}} roam scaleLimit={null} wheelZoomFactors={[1.2,1/1.2]}
   bundledLines={{edges:data.lines,points:data.points.map(p=>p.coordinate),smoothness:.1,color:'rgba(2,166,253,0.05)',opacity:1,lineWidth:.5,pointColor:'rgba(255,0,0,0.5)',pointRadius:1.5,effect:{period:40,color:'rgba(204,246,255,0.09)',radius:1,shadowBlur:1,shadowColor:'rgba(2,166,253,0.05)',alpha:.95}}}/>
  <p className="chart-parity__status">开发中：原始 3000 条线路及 10 个迁出城市、层次捆绑、平滑路径、Canvas 批量绘制和缓冲拖尾已接入。近邻同距排序、缩放重投影、精确布局及完整逐帧视觉仍未通过一致性验收。</p>
 </div>;
}
