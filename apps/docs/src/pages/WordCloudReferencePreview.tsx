import {useMemo,useState} from 'react';
import {Button,WordCloudChart} from '@sia.soul/sia-react-ui';
import {chartWordCloudData} from './chartWordCloudData';
const bounds={x:66.3,y:37.9,width:530.4,height:303.2};
const rotations=[0,45,90,-45];
export function WordCloudReferencePreview(){
 const [seed,setSeed]=useState(19),[result,setResult]=useState<{placed:number;unplaced:readonly string[]}>({placed:0,unplaced:[]});
 const data=useMemo(()=>{let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};return chartWordCloudData.map((word,i)=>({...word,color:i===0?'black':`rgb(${[0,1,2].map(()=>Math.round(random()*160)).join(',')})`,rotation:rotations[Math.floor(random()*4)]!}));},[seed]);
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新排布与配色</Button><span>实际排布 {result.placed} / {data.length} 个词条</span><a href="http://www.google.com/trends/hottrends" target="_blank" rel="noreferrer">Google Trends ↗</a></div>
 <div className="chart-parity__viewport"><WordCloudChart key={seed} data={data} title="Google Trends" bounds={bounds} areaSizing autoFit shape="square" rotations={rotations} padding={0} minFontSize={14} fontFamily="sans-serif" fontWeight="normal" width={663} height={379} viewBoxSize={[663,379]} className="sia-chart--macarons" onLayout={setResult}/></div>
 {result.unplaced.length?<p role="status">未能放入当前画布：{result.unplaced.join('、')}</p>:null}
 <p className="chart-parity__status">待验收与差异：原站使用字形像素掩码碰撞，本实现使用实测字宽与旋转包围框；字号缩放、随机排布密度及动画仍未达到一致性。固定随机种子用于复核，可重新排布。</p></>;
}
