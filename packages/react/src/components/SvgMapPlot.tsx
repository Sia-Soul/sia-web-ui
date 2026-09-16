import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ChartMark} from './Chart';
import {parseSvgMapPaths} from './svgMapSource';
import {chartColorRamp} from './chartColorRamp';
import {useMapRoam} from './useMapRoam';
import {ChartMapLineReveal} from './ChartMapLineReveal';
import {ChartMapLineEffect} from './ChartMapLineEffect';
import {mapLineControl} from './mapLineGeometry';
import {ChartMapPointPulse} from './ChartMapPointPulse';
import {ChartPointMotion} from './ChartPointMotion';
import {ChartMapPointEntrance} from './ChartMapPointEntrance';
import {mapLineEndLabel} from './mapLineLabel';
/** SVG 地图使用的二维坐标点。 */
type Point=readonly [number,number];
/** SVG地图的属性配置。 */
export interface SvgMapPlotProps {
 /** 触发来源，用于区分不同入口的操作。 */
 source:string;
  /** 名称或字段标识。 */
  name:string;
  /** 用于渲染的数据集合。 */
  data:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?:number;
  /** 是否启用鼠标悬停反馈。 */
  hoverable?:boolean;
  /** 是否显示标签文本。 */
  showLabel?:boolean}[];
 /** 横向位置或 X 轴数据值。 */
 x:number;
  /** 纵向位置或 Y 轴数据值。 */
  y:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number;
 /** 坐标轴的数据取值范围。 */
 domain:readonly [number,number];
  /**
   * 是否启用范围选择，或指定选择范围。
   * @defaultValue domain
   */
  range?:readonly [number,number];
  /** 可选颜色或颜色序列。 */
  colors:readonly string[];
 /** 标签相对于默认位置的偏移集合。 */
 labelOffsets?:Readonly<Record<string,readonly number[]>>;
 /** 当前悬停所关联的数据范围。 */
 hoverRange?:readonly [number,number];
  /** 悬停的数据值变化时调用。 */
  onHoverValue?:(value:number|undefined)=>void;
 /**
  * 地图或图表的平移、缩放配置。
  * @defaultValue true
  */
 roam?:boolean;
  /**
   * 该值变化时重置内部交互状态。
   * @defaultValue 0
   */
  resetKey?:number;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?:ReactNode;
 /**
  * 线条动画配置。
  * @defaultValue false
  */
 lineAnimation?:boolean;
  /**
   * 提示框是否仅显示名称。
   * @defaultValue false
   */
  tooltipNameOnly?:boolean;
  /**
   * 是否显示数据标签。
   * @defaultValue true
   */
  showLabels?:boolean;
  /**
   * 数据点动画配置。
   * @defaultValue false
   */
  pointAnimation?:boolean;
  /**
   * 数据点首次出现时的入场效果。
   * @defaultValue false
   */
  pointEntrance?:boolean;
  /**
   * 数据点动画的缓动方式。
   * @defaultValue 'linear'
   */
  pointAnimationEasing?:'linear'|'exponential-out';
 /**
  * 标记点配置集合。
  * @defaultValue []
  */
 markPoints?:readonly {
  /** 唯一标识，用于关联实例或插件。 */
  id?:string;
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?:number|string;
  /** 图表坐标位置或坐标转换配置。 */
  coordinate:Point;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?:string;
  /** 标签文字颜色。 */
  labelColor?:string;
  /** 文字大小，单位为像素。 */
  fontSize?:number;
  /** 边框线宽。 */
  borderWidth?:number;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?:number;
  /** 动态效果的颜色。 */
  effectColor?:string;
  /** 滚动或淡入效果 */
  effect?:boolean;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 数据点或节点使用的图形符号。 */
  symbol?:'pin'|'circle'|'emptyCircle'}[];
 /**
  * 标记线配置集合。
  * @defaultValue []
  */
 markLines?:readonly {
  /** 唯一标识，用于关联实例或插件。 */
  id?:string;
  /** 名称或字段标识。 */
  name:string;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?:number;
  /** 触发来源，用于区分不同入口的操作。 */
  source:Point;
  /** 关联的目标元素或获取目标元素的函数。 */
  target:Point;
  /** 周期动画的周期时长。 */
  period?:number;
  /** 动态效果的颜色。 */
  effectColor?:string;
  /** 阴影模糊半径。 */
  shadowBlur?:number;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 特效覆盖的半径。 */
  effectRadius?:number;
  /** 连线起点和终点使用的图形符号。 */
  endpointSymbols?:readonly string[]}[];
}
function SvgMapRegion({d,name,value,series,color,scale,offset,emphasized,onHover,stroke,strokeWidth,opacity,hoverable=true,showLabel=true,tooltipNameOnly=false}:{d:string;name:string;value?:number;series:string;color:string;scale:number;offset?:readonly number[];emphasized:boolean;onHover:(active:boolean)=>void;stroke?:string;strokeWidth?:number;opacity?:number;hoverable?:boolean;showLabel?:boolean;tooltipNameOnly?:boolean}){
 const path=useRef<SVGPathElement>(null),[center,setCenter]=useState<readonly [number,number]>([0,0]);
 useLayoutEffect(()=>{const box=path.current?.getBBox();if(box)setCenter([box.x+box.width/2,box.y+box.height/2]);},[d]);
 const content=<><path ref={path} d={d} fill={color==='none'?'none':emphasized?'rgba(255,215,0,0.8)':color} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity}/>
  {showLabel?<text x={center[0]+(offset?.[0]??0)/scale} y={center[1]+(offset?.[1]??0)/scale} textAnchor="middle" dominantBaseline="central" fontSize={12/scale} fill={emphasized?'rgb(100,0,0)':'rgb(139,69,19)'} pointerEvents="none">{name}</text>:null}</>;
 if(!hoverable)return <g data-svg-map-region={name} pointerEvents="none">{content}</g>;
 return <ChartMark data-svg-map-region={name} label={`${series}，${name}，${value??'无数据'}`} tooltip={tooltipNameOnly?name:<>{series}<br/>{name} : {value??'-'}</>} onPointerMove={()=>onHover(true)} onPointerLeave={()=>onHover(false)} onFocus={()=>onHover(true)} onBlur={()=>onHover(false)}>{content}</ChartMark>;
}
/** SVG-native map geometry, without geographic projection or source markup insertion. */
export function SvgMapPlot({source,name,data,x,y,width,height,domain,range=domain,colors,labelOffsets,hoverRange,onHoverValue,roam=true,resetKey=0,children,markPoints=[],markLines=[],lineAnimation=false,tooltipNameOnly=false,showLabels=true,pointAnimation=false,pointEntrance=false,pointAnimationEasing='linear'}:SvgMapPlotProps){
 const map=useMemo(()=>parseSvgMapPaths(source),[source]),control=useMapRoam(roam,null,[1.2,1/1.2]),[hovered,setHovered]=useState<string>();
 const [hoveredLine,setHoveredLine]=useState<number>();
 useEffect(()=>{control.reset();setHovered(undefined);},[resetKey]);
 const scale=Math.min(width/map.width,height/map.height),left=x+(width-map.width*scale)/2,top=y+(height-map.height*scale)/2;
 const project=(point:Point):Point=>[left+(point[0]-map.x)*scale,top+(point[1]-map.y)*scale];
 const markColor=(value:number)=>chartColorRamp(colors,(Math.max(domain[0],Math.min(domain[1],value))-domain[0])/Math.max(1,domain[1]-domain[0]));
 return <g ref={control.host} {...control.handlers} data-svg-map={name} tabIndex={roam?0:undefined} role="group" aria-label={`${name}漫游`} style={{touchAction:'none'}}>
  {roam?<rect x={x} y={y} width={width} height={height} fill="transparent"/>:null}
  <g data-svg-map-transform="" transform={`translate(${control.view.x} ${control.view.y}) scale(${control.view.scale})`}>
   <g transform={`translate(${left} ${top}) scale(${scale}) translate(${-map.x} ${-map.y})`}>
    {map.paths.map((path,i)=>{const datum=data.find(d=>d.name===path.name),value=datum?.value,clamped=value===undefined?undefined:Math.max(domain[0],Math.min(domain[1],value));
     const color=path.fill??(clamped===undefined||clamped<range[0]||clamped>range[1]?'#ccc':chartColorRamp(colors,(clamped-domain[0])/Math.max(1,domain[1]-domain[0])));
     return <SvgMapRegion tooltipNameOnly={tooltipNameOnly} key={i} d={path.d} name={path.name} value={value} series={name} color={color} stroke={path.stroke} strokeWidth={path.strokeWidth} opacity={path.opacity} hoverable={datum?.hoverable} showLabel={datum?.showLabel??showLabels} scale={scale} offset={labelOffsets?.[path.name]} emphasized={hovered===path.name||Boolean(value!==undefined&&hoverRange&&value>=hoverRange[0]&&value<=hoverRange[1])} onHover={active=>{setHovered(active?path.name:undefined);onHoverValue?.(active?value:undefined);}}/>;
    })}{children}
   </g>
   {markLines.filter(line=>line.value===undefined||line.value>=range[0]&&line.value<=range[1]).map((line,i)=>{
    const start=project(line.source),fullEnd=project(line.target),fullBend=mapLineControl(start,fullEnd,.2),color=line.color??markColor(line.value??domain[1]);
    return <ChartMapLineReveal key={line.id??`line-${i}`} source={start} control={fullBend} target={fullEnd} enabled={lineAnimation}>{(bend,end)=>{
    const angle=Math.atan2(end[1]-bend[1],end[0]-bend[0])*180/Math.PI;
    const label=mapLineEndLabel(start,end);
    return <ChartMark key={line.id??`line-${i}`} data-svg-map-line={line.name} data-svg-map-mark-id={line.id} label={`${name}，${line.name}，${line.value??'无数据'}`} tooltip={tooltipNameOnly?line.name:<>{name}<br/>{line.name} : {line.value??'-'}</>} onPointerMove={()=>setHoveredLine(i)} onPointerLeave={()=>setHoveredLine(undefined)} onFocus={()=>setHoveredLine(i)} onBlur={()=>setHoveredLine(undefined)}>
     <path d={`M${start[0]} ${start[1]} Q${bend[0]} ${bend[1]} ${end[0]} ${end[1]}`} fill="none" stroke={color} strokeWidth={1}/>
     {line.endpointSymbols?.[0]!=='none'?<circle cx={start[0]} cy={start[1]} r={2} fill={color}/>:null}
     {(line.endpointSymbols?.[1]??line.endpointSymbols?.[0])!=='none'?<path transform={`translate(${end[0]} ${end[1]}) rotate(${angle})`} d="M0 0 L-8 -4 L-8 4 Z" fill={color}/>:null}
     <text x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline={label.baseline} fontSize={12} fill={color} visibility={hoveredLine===i?'hidden':undefined}>{line.value??''}</text>
     <ChartMapLineEffect source={start} control={fullBend} target={fullEnd} period={line.period??30} color={line.effectColor??'#fff'} radius={line.effectRadius??1} shadowBlur={line.shadowBlur??5} trailAlpha={.95}/>
    </ChartMark>;}}</ChartMapLineReveal>;
   })}
   {markPoints.filter(point=>typeof point.value!=='number'||point.value>=range[0]&&point.value<=range[1]).map((point,i)=>{
    const target=project(point.coordinate),size=point.size??10,color=point.color??markColor(typeof point.value==='number'?point.value:domain[1]);
    return <ChartPointMotion key={point.id??`point-${i}`} points={[target]} enabled={pointAnimation} duration={500} animateInitial={false} easing={pointAnimationEasing}>{positions=>{const position=positions[0]!;
    return <ChartMark data-svg-map-point={point.name} data-svg-map-mark-id={point.id} label={`${name}，${point.name}，${point.value??'无数据'}`} tooltip={tooltipNameOnly?point.name:<>{name}<br/>{point.name} : {point.value??'-'}</>}>
     <ChartMapPointEntrance enabled={pointEntrance} x={position[0]} y={position[1]}>
     <circle cx={position[0]} cy={position[1]} r={size} fill="transparent"/>
     {point.effect!==false?<ChartMapPointPulse x={position[0]} y={position[1]} size={size} color={point.effectColor??color}/>:point.symbol==='pin'?<path data-svg-map-pin="" transform={`translate(${position[0]} ${position[1]})`} d={`M0 0 C${-size/2} ${-size} ${-size} ${-size} ${-size} ${-size*1.5} A${size} ${size} 0 1 1 ${size} ${-size*1.5} C${size} ${-size} ${size/2} ${-size} 0 0 Z`} fill={color}/>:<circle cx={position[0]} cy={position[1]} r={size} fill={point.symbol==='emptyCircle'?'none':color} stroke={color} strokeWidth={point.borderWidth}/>}
     {point.label!==undefined?<text x={position[0]} y={position[1]} textAnchor="middle" dominantBaseline="central" fill={point.labelColor??'#fff'} fontSize={point.fontSize??12} pointerEvents="none">{point.label}</text>:null}
     </ChartMapPointEntrance>
    </ChartMark>;}}</ChartPointMotion>;
   })}
  </g>
 </g>;
}
