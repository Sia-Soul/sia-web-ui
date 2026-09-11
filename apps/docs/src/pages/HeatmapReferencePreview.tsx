import {useMemo,useState} from 'react';
import {Button,HeatmapChart} from '@sia-ui/react';
import {createReferenceHeatData,customHeatGradient} from './chartHeatmapData';
export function HeatmapReferencePreview({id}:{id:'heatmap'|'heatmap2'}){
 const [seed,setSeed]=useState(41),points=useMemo(()=>createReferenceHeatData(seed),[seed]);
 const custom=id==='heatmap';
 const raster={width:663,height:379,backgroundImage:'http://static.dtws110.com/echarts-2.2.7/doc/asset/img/example/heatmap_baidu.png',...(custom?{gradient:customHeatGradient,minAlpha:.2,valueScale:2,opacity:.6}:{})};
 return <><div className="chart-parity__controls"><Button onClick={()=>setSeed(n=>n+1)}>重新生成热力样本</Button><span>20 + 100 + 200 个原始热点，像素坐标不归一化。</span></div>
 <div className="chart-parity__viewport"><HeatmapChart title={custom?'热力图自定义样式':'热力图'} points={points} raster={raster} width={663} height={379} viewBoxSize={[663,379]} animation={false}/></div>
 <p className="chart-parity__status">320 个热点全部参与强度叠加，画布外坐标自然裁切；按原站关闭热点悬浮响应。{custom?'自定义四段渐变、minAlpha 0.2、valueScale 2、opacity 0.6。':'默认五色渐变、minAlpha 0.05、valueScale 1、opacity 1。'}待验收与差异：固定随机种子；自研衰减核与原站 shadowBlur 的扩散半径和密度尚未达到像素一致。</p></>;
}
