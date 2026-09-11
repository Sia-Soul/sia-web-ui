import {useState} from 'react';
import {LineChart,Button,Slider} from '@sia-ui/react';
import {personalizedLineCategories,personalizedLineSeries} from './chartPersonalizedLineData';
export function PersonalizedLineReferencePreview(){
 const [replay,setReplay]=useState(0);
 const [progress,setProgress]=useState<number>();
 return <div className="chart-personalized-line"><div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><span>{progress===undefined?'实时播放':`${Math.round(progress*2000)} ms`}</span></div><Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)}/><LineChart key={replay} animationDuration={2000} animationDurationUpdate={500} animationProgress={progress} calculable calculableMode="transfer" width={995} height={378} viewBoxSize={[995,378]} grid={{left:80.5,top:60.5,right:79.5,bottom:59.5}} appearance="macarons" categories={personalizedLineCategories} series={personalizedLineSeries} toolbox={{magicTypes:["line","bar","stack","tiled"],features:["mark","dataView","restore","saveAsImage"]}} tooltipTrigger="axis"/><p className="chart-parity__status">已接入 · 开发中：原始数据、特殊标记、图片、旋转、逐点标签与渐变已接入预览；工具箱与图形/堆叠切换已接入并做功能检查；折线数值合并、孤岛拖回与面积缺口已做浏览器验证；跨模式孤岛拖回已验证；入场/更新动画已启用并提供时间定位；待一致性验收：原站动画中间帧、模式过渡、字体与逐像素视觉、空槽标签精确定位及不同尺寸适配。</p></div>;
}
