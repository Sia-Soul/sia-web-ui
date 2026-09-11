import {ScatterChart} from '@sia-ui/react';
import {scatterDistributionData} from './chartScatterDistributionData';
const bounds={x:80,y:60,width:503,height:259};
export function ScatterDistributionReferencePreview(){
 return <><div className="chart-parity__viewport"><ScatterChart crosshair title="男性女性身高体重分布" description="抽样调查来自: Heinz  2003" data={scatterDistributionData} plotBounds={bounds} xSplitNumber={6} xUnit=" cm" yUnit=" kg" markAppearance="pin" markByCategory markAverage="y" markExtremes minSymbolRadius={4} palette={['#2ec7c9','#b6a2de']} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">女性 260 点、男性 247 点，全部原始坐标保留。待验收与差异：极值标注轮廓精度、十字提示样式细节及框选缩放、动画尚未完成原站一致性验收。</p></>;
}
