import { forwardRef, useEffect, useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { SiaChart, ChartLegend, ChartMark, ChartDataZoom, chartTicks, linearScale, niceChartDomain } from "./Chart";
import { chartTimeTicks } from "./chartTimeTicks";
import { scatterValueWindow } from "./scatterValueWindow";
import type { SiaChartProps, SiaChartRef } from "./Chart";
import { ChartPointMotion } from "./ChartPointMotion";
import { ChartDataEditor } from "./ChartDataEditor";
import { linePath } from "./Charts";

/** 二维坐标图中的一个数据点。 */
export type XYPoint = readonly [number, number, number?];
/** XY的数据系列。 */
export interface XYSeries {
  /** 名称或字段标识。 */
  name: string;
  /** 用于渲染的数据集合。 */
  data: readonly XYPoint[];
  /** 连接数据点的曲线类型。 */
  curve?: "smooth" | "straight";
  /** 数据点符号的半径。 */
  symbolRadius?: number | ((point: XYPoint) => number);
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?: string;
  /** 图形几何形状及布局参数。 */
  geometry?: "line" | "bar";
  /** 柱状图的排列方向。 */
  barOrientation?: "vertical" | "horizontal";
  /** 柱形的尺寸。 */
  barSize?: number;
  /** 统计信息或统计标记配置。 */
  statistics?: boolean;
}
/** 二维坐标图的属性配置。 */
export interface XYChartProps extends Omit<SiaChartProps,"children"> {
  /** 图表数据系列。 */
  series: readonly XYSeries[];
  /** X 轴的数据范围。 */
  xDomain?: readonly [number,number,number];
  /** Y 轴的数据范围。 */
  yDomain?: readonly [number,number,number];
  /** 动画当前进度，通常为 0 到 1。 */
  animationProgress?: number;
  /**
   * 是否允许通过拖拽图形修改数据。
   * @defaultValue false
   */
  calculable?: boolean;
  /**
   * X 轴类型。
   * @defaultValue "value"
   */
  xAxisType?: "value" | "time";
  /** X 轴数值的格式化函数。 */
  xFormatter?: (value: number) => string;
  /** 提示框内容的格式化函数。 */
  tooltipFormatter?: (point: XYPoint, series: XYSeries) => ReactNode;
  /**
   * 数据区域缩放配置。
   * @defaultValue false
   */
  dataZoom?: boolean;
  /**
   * 初始缩放范围或缩放级别。
   * @defaultValue [0,100]
   */
  defaultZoom?: readonly [number, number];
  /** 缩放范围变化时调用。 */
  onZoomChange?: (value: readonly [number, number]) => void;
  /** 数据被交互修改后调用。 */
  onDataChange?: (series: readonly XYSeries[]) => void;
}

/** Two genuinely numeric axes; bar direction belongs to the series, not the chart. */
export const XYChart = forwardRef<SiaChartRef,XYChartProps>(function XYChart({series:source,xDomain,yDomain,animationProgress,calculable=false,onDataChange,xAxisType="value",xFormatter,tooltipFormatter,dataZoom=false,defaultZoom=[0,100],onZoomChange,toolbox,...props},ref) {
  const [series,setSeries]=useState(source);
  const [hidden,setHidden]=useState<string[]>([]);
  const [crosshair,setCrosshair]=useState<readonly [number,number]>();
  const [drag,setDrag]=useState<readonly [number,number]>();
  const [geometry,setGeometry]=useState<"line"|"bar">();
  const [zoom,setZoom]=useState<readonly [number,number]>(defaultZoom);
  useEffect(()=>setSeries(source),[source]);
  const window=dataZoom||xAxisType==="time"?scatterValueWindow(series.flatMap(item=>item.data.map(point=>point[0])),dataZoom?zoom:[0,100]):undefined;
  const active=series.filter(item=>!hidden.includes(item.name)).map(item=>({...item,data:window?item.data.filter(point=>point[0]>=window[0]&&point[0]<=window[1]):item.data}));
  const width=props.viewBoxSize?.[0]??663, height=props.viewBoxSize?.[1]??379;
  const plot={left:80,top:60,right:width-80,bottom:height-(dataZoom?80:70)};
  const xd=xDomain??(window?[window[0],window[1],(window[1]-window[0])/10] as const:niceChartDomain(active.flatMap(item=>item.data.map(point=>point[0]))));
  const yd=yDomain??niceChartDomain(active.flatMap(item=>item.data.map(point=>point[1])));
  const sx=(x:number)=>linearScale(x,[xd[0],xd[1]],[plot.left,plot.right]);
  const sy=(y:number)=>linearScale(y,[yd[0],yd[1]],[plot.bottom,plot.top]);
  const options=toolbox===true ? {} : toolbox||undefined;
  function update(next:readonly XYSeries[]) {setSeries(next);onDataChange?.(next);}
  function pointer(event:PointerEvent<SVGGElement>) {
    const matrix=event.currentTarget.ownerSVGElement?.getScreenCTM();
    if(!matrix)return undefined;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    return [Math.max(plot.left,Math.min(plot.right,point.x)),Math.max(plot.top,Math.min(plot.bottom,point.y))] as const;
  }
  return <SiaChart {...props} ref={ref} width={props.width??width} height={props.height??height} viewBoxSize={[width,height]} className={`sia-chart--macarons ${props.className??""}`} toolbox={options ? {
    ...options,
    activeMagicType:geometry??source[0]?.geometry??"line",
    onMagicTypeChange:type=>{if(type==="line"||type==="bar")setGeometry(type);options.onMagicTypeChange?.(type);},
    onRestore:()=>{setSeries(source);setHidden([]);setCrosshair(undefined);setGeometry(undefined);setZoom(defaultZoom);onZoomChange?.(defaultZoom);options.onRestore?.();},
    dataView:options.dataView??<ChartDataEditor readOnly={options.dataViewReadOnly} series={series.map(item=>({name:`${item.name}（${item.data.some(point=>point.length===3)?"x,y,value":"x,y"}）`,data:item.data.flatMap(point=>point.filter((value):value is number=>value!==undefined))}))} onApply={values=>update(series.map((item,index)=>{let offset=0;return {...item,data:item.data.map(point=>{const next=values[index]!.slice(offset,offset+point.length);offset+=point.length;return next as unknown as XYPoint;})};}))} />,
  } : undefined}>
    <ChartLegend symbol={(geometry??source[0]?.geometry??"line")==="line"?"line":"rect"} x={width/2} y={14} itemGap={10} items={series.map((item,index)=>({name:item.name,color:item.color??["#2ec7c9","#b6a2de"][index%2]!,disabled:hidden.includes(item.name)}))} onItemClick={name=>setHidden(current=>current.includes(name)?current.filter(item=>item!==name):[...current,name])} />
    {chartTicks(yd).map((value,index,ticks)=><g key={value}>
      {index<ticks.length-1 ? <rect x={plot.left} y={sy(ticks[index+1]!)} width={plot.right-plot.left} height={sy(value)-sy(ticks[index+1]!)} fill={index%2?"rgba(200,200,200,.1)":"rgba(250,250,250,.1)"} /> : null}
      <line x1={plot.left} x2={plot.right} y1={sy(value)} y2={sy(value)} stroke="#eee" />
      <text x={plot.left-8} y={sy(value)+4} textAnchor="end" className="sia-chart__axis-label">{value}</text>
    </g>)}
    {(xAxisType==="time"?chartTimeTicks([xd[0],xd[1]],10):chartTicks(xd)).map((value,index,ticks)=><g key={value}><line x1={sx(value)} x2={sx(value)} y1={plot.top} y2={plot.bottom} stroke="#eee" />{xAxisType!=="time"||index===0||index===ticks.length-1||index%2===0&&index<ticks.length-2?<text x={sx(value)} y={plot.bottom+19} textAnchor="middle" className="sia-chart__axis-label">{xFormatter?xFormatter(value):xAxisType==="time"?new Date(value).toLocaleDateString():value}</text>:null}</g>)}
    <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke="#dc143c" strokeWidth={2} />
    <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#008acd" strokeWidth={2} />
    {crosshair ? <g pointerEvents="none" stroke="#999" strokeDasharray="5 5"><line x1={crosshair[0]} x2={crosshair[0]} y1={plot.top} y2={plot.bottom} /><line x1={plot.left} x2={plot.right} y1={crosshair[1]} y2={crosshair[1]} /></g> : null}
    {active.map(item=>{
      const seriesIndex=series.findIndex(candidate=>candidate.name===item.name), color=item.color??["#2ec7c9","#b6a2de"][seriesIndex%2]!;
      const shape=geometry??item.geometry??"line";
      const points=item.data.map(point=>[sx(point[0]),sy(point[1])] as const);
      return <g key={item.name}>
        {shape==="line" ? <ChartPointMotion points={points} enabled={props.animation!==false&&!drag} duration={props.animationDuration??2000} progress={animationProgress}>{frame=><path d={linePath(frame,item.curve??"smooth")} fill="none" stroke={color} strokeWidth={2} />}</ChartPointMotion> : null}
        {points.map((point,index)=>{
          const datum=item.data[index]!;
          const dataIndex=series[seriesIndex]!.data.indexOf(datum);
          const horizontal=shape==="bar"&&item.barOrientation==="horizontal";
          const origin=shape==="line" ? [point[0],points[0]![1]] as const : horizontal ? [sx(0),point[1]] as const : [point[0],sy(0)] as const;
          return <ChartPointMotion key={index} points={[origin,point]} horizontal={horizontal} enabled={props.animation!==false&&!drag} duration={props.animationDuration??2000} progress={animationProgress}>{frame=>{
            const end=frame[1]!;
            const size=item.barSize??10;
            return <ChartMark label={`${item.name}，[${datum.join("，")}]`} tooltip={tooltipFormatter?tooltipFormatter(datum,item):<>{item.name}：[ {datum.join(", ")} ]</>} onPointerDown={event=>{if(calculable){event.currentTarget.setPointerCapture(event.pointerId);setDrag([seriesIndex,dataIndex]);}}} onPointerMove={event=>{
              const position=pointer(event);if(!position)return;setCrosshair(position);
              if(drag?.[0]!==seriesIndex||drag[1]!==dataIndex)return;
              const value=[linearScale(position[0],[plot.left,plot.right],[xd[0],xd[1]]),linearScale(position[1],[plot.bottom,plot.top],[yd[0],yd[1]])] as const;
              update(series.map((candidate,i)=>i!==seriesIndex?candidate:{...candidate,data:candidate.data.map((datum,j)=>j===dataIndex?(datum.length===3?[...value,datum[2]] as const:value):datum)}));
            }} onPointerLeave={()=>{if(!drag)setCrosshair(undefined);}} onPointerUp={event=>{if(drag)event.currentTarget.releasePointerCapture(event.pointerId);setDrag(undefined);}} onPointerCancel={()=>setDrag(undefined)}>
              {shape==="line" ? <circle cx={end[0]} cy={end[1]} r={Math.max(0,typeof item.symbolRadius==="function"?item.symbolRadius(datum):item.symbolRadius??3)} fill="#fff" stroke={color} strokeWidth={2} /> : horizontal ? <rect x={Math.min(origin[0],end[0])} y={end[1]-size/2} width={Math.abs(end[0]-origin[0])} height={size} fill={color} rx={5} /> : <rect x={end[0]-size/2} y={Math.min(origin[1],end[1])} width={size} height={Math.abs(end[1]-origin[1])} fill={color} rx={5} />}
            </ChartMark>;
          }}</ChartPointMotion>;
        })}
        {item.statistics && item.data.length > 0 ? ([0,1] as const).flatMap(axis=>{
          const values=item.data.map(point=>point[axis]);
          const stats=[Math.min(...values),values.reduce((sum,value)=>sum+value,0)/values.length,Math.max(...values)];
          const color=axis===0?"#1e90ff":"#dc143c";
          return stats.map((value,stat)=>{
            const coordinate=axis===0?sx(value):sy(value);
            const point=item.data[values.indexOf(value)];
            return <g key={`${axis}-${stat}`} style={{color}} className="sia-chart__mark-line">
              <line x1={axis===0?coordinate:plot.left} x2={axis===0?coordinate:plot.right} y1={axis===0?plot.top:coordinate} y2={axis===0?plot.bottom:coordinate} stroke={color} />
              <circle cx={axis===0?coordinate:plot.left} cy={axis===0?plot.bottom:coordinate} r={2} fill={color} />
              <path d={axis===0?`M ${coordinate-5} ${plot.top+7} L ${coordinate} ${plot.top-3} L ${coordinate+5} ${plot.top+7} L ${coordinate} ${plot.top+4} Z`:`M ${plot.right-5} ${coordinate-5} L ${plot.right+5} ${coordinate} L ${plot.right-5} ${coordinate+5} L ${plot.right-2} ${coordinate} Z`} fill={color} />
              <text x={axis===0?coordinate:plot.right+5} y={axis===0?plot.top-8:coordinate+4} textAnchor={axis===0?"middle":"start"}>{Number(value.toFixed(2))}</text>
              {point&&stat!==1 ? <><circle cx={sx(point[0])} cy={sy(point[1])} r={10} fill="none" stroke={color} strokeWidth={2} /><text x={sx(point[0])+(axis===0?(stat===0?-15:15):0)} y={sy(point[1])+(axis===0?4:stat===0?22:-17)} textAnchor={axis===0?(stat===0?"end":"start"):"middle"}>{value}</text></> : null}
            </g>;
          });
        }) : null}
      </g>;
    })}
    {dataZoom?<foreignObject className="sia-chart__inline-zoom" x={plot.left} y={plot.bottom+35} width={plot.right-plot.left} height={30}><ChartDataZoom value={zoom} dataShadow={series[0]?.data.map(point=>point[1])} onChange={value=>{setZoom(value);onZoomChange?.(value);}}/></foreignObject>:null}
  </SiaChart>;
});
