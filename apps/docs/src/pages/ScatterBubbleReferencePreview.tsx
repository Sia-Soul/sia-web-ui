import {useMemo,useState} from 'react';
import {Button,ScatterChart} from '@sia.soul/sia-react-ui';
import {createScatterBubbleData,scatterBubbleSize} from './chartScatterBubbleData';
const bounds={x:80,y:60,width:503,height:259};
export function ScatterBubbleReferencePreview(){
 const [seed,setSeed]=useState(23),data=useMemo(()=>createScatterBubbleData(seed),[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成随机样本</Button><span>两组各 100 点，第三维决定气泡大小。</span></div>
 <div className="chart-parity__viewport"><ScatterChart crosshair key={seed} data={data} plotBounds={bounds} xSplitNumber={4} ySplitNumber={4} symbolSize={scatterBubbleSize} minSymbolRadius={0} palette={['#2ec7c9','#b6a2de']} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">保留原站正负随机公式及第三维大小公式；数据视图每组三个数字依次为 x、y、第三维，编辑第三维同步改变气泡大小。待验收与差异：固定种子用于复核；十字提示样式细节、框选缩放、点样式细节和动画尚未完成一致性验收。</p></>;
}
