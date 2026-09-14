import {useMemo,useState} from 'react';
import {Button,ScatterChart} from '@sia.soul/sia-react-ui';
import {createScatterCategoryData,scatterCategories,scatterCategorySize,scatterCategoryPieces} from './chartScatterCategoryData';
const bounds={x:80,y:80,width:503,height:219};
const visualMap={selectable:true,dimension:'value' as const,min:0,max:100,pieces:scatterCategoryPieces,x:180,y:35,width:320};
export function ScatterCategoryReferencePreview(){
 const [seed,setSeed]=useState(29),data=useMemo(()=>createScatterCategoryData(seed),[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成类目样本</Button><span>500 个类目，两组共 1,000 点，无抽样。</span></div>
 <div className="chart-parity__viewport"><ScatterChart key={seed} title="类目坐标散点图" description="dataZoom支持" data={data} xCategories={scatterCategories} xFormatter={value=>`类目${value}`} crosshair dataZoom defaultZoom={[30,70]} visualMap={visualMap} symbolSize={scatterCategorySize} minSymbolRadius={0} plotBounds={bounds} palette={['#2ec7c9','#b6a2de']} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">每组保留全部 500 个三维数据，默认按类目窗口筛选，第三维决定五段颜色与气泡大小。待验收与差异：固定种子、分段图例布局、缩放控件位置/数据阴影、标签间距及提示布局仍需对照；按原站关闭动画。</p></>;
}
