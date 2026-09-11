import {CandlestickChart} from '@sia-ui/react';
import {chartCandlestickFixtures} from './chartCandlestickFixtures';
export function CandlestickReferencePreview({id}:{id:string}) {
 return <><div className="chart-parity__viewport"><CandlestickChart {...chartCandlestickFixtures[id]!} width={663} height={379} viewBoxSize={[663,379]} toolbox={{features:['mark','dataView','restore','saveAsImage'],magicTypes:id==='k1'?['line','bar']:[]}}/></div>
 <p className="chart-parity__status">待验收与差异：原站轴触发十字提示、工具箱框选缩放、精确坐标轴留白、缩放控件细节及动画尚未完成一致性验收；原始数据和两个页面的不同样式分别保留。</p></>;
}
