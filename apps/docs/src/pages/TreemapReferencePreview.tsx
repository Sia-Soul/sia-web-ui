import {useState} from 'react';
import {Button,TreemapChart} from '@sia-ui/react';
import {chartTreemapFixtures} from './chartTreemapFixtures';
const palette=['#ff7f50','#87cefa','#da70d6','#32cd32','#6495ed','#ff69b4','#ba55d3'];
const bounds={x:66.3,y:37.9,width:530.4,height:303.2};
export function TreemapReferencePreview({id}:{id:string}) {
 const [replay,setReplay]=useState(0);
 return <>
  <div className="chart-parity__controls"><Button onClick={()=>setReplay(v=>v+1)}>重播入场动画</Button><span>点击有子节点的矩形下钻；点击图下路径返回上层。</span></div>
  <div className="chart-parity__viewport"><TreemapChart key={replay} {...chartTreemapFixtures[id]!} width={663} height={379} viewBoxSize={[663,379]} bounds={bounds} palette={palette} gap={0} maxDepth={0} cornerRadius={0} showChildBoundaries breadcrumbPosition="bottom" breadcrumbRootName={id==='treemap1'?'手机占有率':'矩形图'} drilldown showBreadcrumb className="sia-chart--macarons sia-chart--treemap-reference" animationDuration={2000} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
  <p className="chart-parity__status">待验收与差异：面包屑位置和样式、提示框布局、下钻过渡及入场动画尚未通过原站逐帧一致性验收。当前不计入完整一致性通过数量。</p>
 </>;
}
