import {useState} from 'react';
import {BarChart,Button,Slider} from '@sia-ui/react';
import {original,series} from './chartPersonalizedBarData';
export function PersonalizedBarReferencePreview(){
 const [replay,setReplay]=useState(0);
 const [progress,setProgress]=useState<number>();
 return <div className="chart-personalized-bar"><div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button><span>{progress===1?'最终帧':'实时播放'}</span></div><Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)}/><BarChart key={replay} animationDuration={2000} animationDurationUpdate={500} animationProgress={progress} width={995} height={378} viewBoxSize={[995,378]} grid={{left:80.5,top:60.5,right:79.5,bottom:59.5}} appearance="macarons" categories={original.xAxis[0]!.data} series={series} calculable calculableMode="transfer" toolbox={{magicTypes:["line","bar","stack","tiled"],features:["mark","dataView","restore","saveAsImage"]}}/><p className="chart-parity__status">已接入 · 开发中：原始数据、个性化样式、统计标线、工具箱、模式切换、空槽及孤岛转移可运行。待一致性验收：模式过渡与更新动画、逐像素布局和字体、缺失槽高亮标签、折线系列级高亮颜色及不同尺寸适配；拖放稳定性仍需持续验证。</p></div>;
}
