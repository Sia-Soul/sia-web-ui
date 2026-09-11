import {useMemo,useState} from 'react';
import {Button,ScatterChart} from '@sia-ui/react';
import {createScatterRangeData} from './chartScatterRangeData';
const bounds={x:80,y:60,width:503,height:259};
const visualMap={dimension:'value' as const,min:0,max:100,colors:['#ffff00','#90ee90'] as const,calculable:true,orientation:'vertical' as const,x:28,y:105,width:150};
export function ScatterRangeReferencePreview(){
 const [seed,setSeed]=useState(37),data=useMemo(()=>createScatterRangeData(seed),[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成值域样本</Button><span>500 点，拖动左侧值域上下限筛选。</span></div>
 <div className="chart-parity__viewport"><ScatterChart key={seed} data={data} yAxisPosition="right" showLegend={false} visualMap={visualMap} plotBounds={bounds} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">保留原站三维相关随机公式、固定半径 5、右侧纵轴和连续值域过滤。待验收与差异：固定种子、值域三角手柄/高低文字与区间遮罩、框选缩放及点描边透明度尚需对照；按原站关闭动画。</p></>;
}
