import { useState } from "react";
import { Button, Slider, XYChart } from "@sia-ui/react";
import type { XYSeries } from "@sia-ui/react";

export const xyReferenceIds = ["line7", "bar13"] as const;

export function XYReferencePreview({ id }: { id: string }) {
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState<number>();
  const bar = id === "bar13";
  const [series] = useState<XYSeries[]>([
    {name:"数据1", color:"#2ec7c9", geometry:bar?"bar":"line", statistics:true,
      data:[[1.5,10],[5,7],[8,8],[12,6],[11,12],[16,9],[14,6],[17,4],[19,9]]},
    {name:"数据2", color:"#b6a2de", geometry:bar?"bar":"line", barOrientation:"horizontal",
      data:bar ? [[1,2],[2,3],[4,4],[7,5],[11,11],[18,15]] : [[1,2],[2,3],[4,2],[7,5],[11,2],[18,3]]},
  ]);
  return <>
    <div className="chart-parity__controls">
      <Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button>
      <Button onClick={()=>setProgress(1)}>查看最终帧</Button>
      <span>{progress == null ? "实时播放" : `${Math.round(progress*2000)} ms / 2000 ms`}</span>
    </div>
    <Slider aria-label="入场动画时间定位" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)} />
    <div className="chart-parity__viewport">
      <XYChart key={`${id}-${replay}`} series={series} title={bar?"双数值柱形图":"双数值轴折线"} description="纯属虚构"
        ariaLabel={`${id} 原始数据对照图`} xDomain={[0,20,5]} yDomain={bar?[0,15,3]:[0,12,2]} calculable
        animationDuration={2000} animationProgress={progress}
        toolbox={{features:["mark","dataView","restore","saveAsImage"],magicTypes:["line","bar"],onRestore:()=>{setProgress(undefined);setReplay(value=>value+1);}}} />
    </div>
    <p className="chart-parity__status">开发中：双数值坐标、各系列独立柱方向、X/Y 统计标线、数据编辑及拖拽。待验收与差异：框选缩放、统计标记动画及端点细节、曲线及工具箱细节、逐帧视觉对比。当前不计入完整一致性通过数量。</p>
  </>;
}
