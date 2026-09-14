import {useMemo,useState} from 'react';
import {Button,ScatterChart} from '@sia.soul/sia-react-ui';
import {createScatterWaveData} from './chartScatterWaveData';
const bounds={x:80,y:60,width:503,height:259};
export function ScatterWaveReferencePreview(){
 const [seed,setSeed]=useState(17),data=useMemo(()=>createScatterWaveData(seed),[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成随机样本</Button><span>sin 10,000 点 + cos 10,000 点，无抽样。</span></div>
 <div className="chart-parity__viewport"><ScatterChart crosshair key={seed} data={data} plotBounds={bounds} largeThreshold={1000} palette={['#2ec7c9','#b6a2de']} width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" toolbox={{features:['mark','dataView','restore','saveAsImage']}}/></div>
 <p className="chart-parity__status">待验收与差异：使用可复现随机种子；十字坐标提示细节、框选缩放、大数据模式逐点命中、符号细节及动画尚未完成原站一致性验收。数据视图每个系列按 x,y 交替排列。</p></>;
}
