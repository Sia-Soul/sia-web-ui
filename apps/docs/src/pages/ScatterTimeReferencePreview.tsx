import {useMemo,useState} from 'react';
import {Button,ScatterChart} from '@sia.soul/sia-react-ui';
import {createScatterTimeData} from './chartScatterTimeData';
import {scatterCategorySize,scatterCategoryPieces} from './chartScatterCategoryData';
const bounds={x:80,y:80,width:503,height:219};
const visualMap={selectable:true,dimension:'value' as const,min:0,max:100,pieces:scatterCategoryPieces,x:180,y:35,width:320};
export function ScatterTimeReferencePreview(){
 const [seed,setSeed]=useState(31),data=useMemo(()=>createScatterTimeData(seed),[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成时间样本</Button><span>1,500 个三维点，时间以 2014 年 10 月 1 日为基准。</span></div>
 <div className="chart-parity__viewport"><ScatterChart key={seed} title="时间坐标散点图" description="dataZoom支持" data={data} xAxisType="time" xSplitNumber={10} xFormatter={value=>{const d=new Date(value);return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}\n${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}} crosshair dataZoom defaultZoom={[30,70]} visualMap={visualMap} symbolSize={scatterCategorySize} minSymbolRadius={0} largeThreshold={Infinity} plotBounds={bounds} palette={['#2ec7c9']} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">保留原站 1,500 点生成公式、分钟精度、第三维颜色和大小；缩放按时间区间筛选，使用日历刻度及两行标签。待验收与差异：固定种子、刻度间隔选择细节/标签避让、轴触发关联提示、缩放控件位置及数据阴影、点样式仍需对照。数据视图时间使用毫秒时间戳，按原站关闭动画。</p></>;
}
