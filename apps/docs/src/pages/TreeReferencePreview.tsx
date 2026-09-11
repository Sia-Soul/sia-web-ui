import {useState} from 'react';
import {Button,TreeChart} from '@sia-ui/react';
import {chartTreeFixtures} from './chartTreeFixtures';
export function TreeReferencePreview({id}:{id:string}) {
 const [replay,setReplay]=useState(0);
 const height=id==='tree2'?579:379;
 return <><div className="chart-parity__controls"><Button onClick={()=>setReplay(n=>n+1)}>重播入场动画</Button><span>{id==='tree2'?'拖动画布平移，滚轮缩放；聚焦画布后可用方向键、加减键及 Home 还原。':'悬停或键盘聚焦节点显示名称。'}</span></div>
  <div className="chart-parity__viewport"><TreeChart key={replay} {...chartTreeFixtures[id]!} width={663} height={height} viewBoxSize={[663,height]} className="sia-chart--macarons" animationDuration={2000} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
  <p className="chart-parity__status">待验收与差异：曲线控制点、阴影模糊和强调标签细节仍需逐像素校正；入场和更新动画尚未通过原站逐帧一致性验收。不计入完整一致性通过数量。</p>
 </>;
}
