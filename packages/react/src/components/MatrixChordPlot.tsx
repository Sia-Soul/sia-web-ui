import {chordMatrixLayout,chordMultiMatrixLayout,chordScaleTicks} from './chordMatrixLayout';
import {useState} from 'react';
import {ChartMark,chartColor,svgArcPath} from './Chart';
export interface MatrixChordAppearance {
 borderColor?:string; borderWidth?:number; hoverBorderColor?:string; hoverBorderWidth?:number;
 labelDistance?:number;
 markers?:readonly {name:string;value:number;x:number;y:number;size:number;color?:string}[];
}
export function MatrixChordPlot({names,matrix,series,appearance,showNodeLabels=false,rotateNodeLabels=false,linkLabel,sort,sortSub,padAngle,clockwise,palette,geometry,legacySubSort=false,showScale=false}:{appearance?:MatrixChordAppearance;names:readonly string[];matrix:readonly (readonly number[])[];series?:readonly {name:string;color:string;matrix:readonly (readonly number[])[]}[];showNodeLabels?:boolean;rotateNodeLabels?:boolean;linkLabel?:(source:number,target:number)=>string;sort:'none'|'ascending'|'descending';sortSub:'none'|'ascending'|'descending';padAngle:number;clockwise:boolean;palette?:readonly string[];showScale?:boolean;legacySubSort?:boolean;geometry?:{center:readonly [number,number];innerRadius:number;outerRadius:number;startAngle?:number}}){
 const [hoveredLink,setHoveredLink]=useState<number|null>(null);
 const layout=series?chordMultiMatrixLayout(series.map(s=>s.matrix),{padAngle,clockwise,startAngle:geometry?.startAngle}):chordMatrixLayout(matrix,{sort,sortSub,padAngle,clockwise,legacySubSort,startAngle:geometry?.startAngle}),cx=geometry?.center[0]??360,cy=geometry?.center[1]??182,r=geometry?.innerRadius??108,outer=geometry?.outerRadius??128;
 const point=(angle:number)=>[cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];
 return <g className="sia-chart__matrix-chord">
  {layout.ribbons.map((edge,i)=>{
   const {source:s,target:t}=edge;
   const customLabel=linkLabel?.(s.index,t.index);
   const relation=series&&'seriesIndex' in edge?series[edge.seriesIndex as number]:undefined;
   const a=point(s.start),b=point(s.end),c=point(t.start),d=point(t.end),sweep=clockwise?1:0;
   const sourceArc=`M ${a} A ${r} ${r} 0 ${Math.abs(s.end-s.start)>Math.PI?1:0} ${sweep} ${b}`;
   const path=s.index===t.index?`${sourceArc} Q ${cx} ${cy} ${a} Z`:`${sourceArc} Q ${cx} ${cy} ${c} A ${r} ${r} 0 ${Math.abs(t.end-t.start)>Math.PI?1:0} ${sweep} ${d} Q ${cx} ${cy} ${a} Z`;
   return <g key={i} onPointerEnter={()=>setHoveredLink(i)} onPointerLeave={()=>setHoveredLink(null)} onFocus={()=>setHoveredLink(i)} onBlur={()=>setHoveredLink(null)}><ChartMark label={customLabel??(relation?`${names[s.index]} ${relation.name} ${names[t.index]}`:`${names[s.index]} 到 ${names[t.index]}，${s.value} / ${t.value}`)} tooltip={customLabel?<strong>{customLabel}</strong>:relation?<strong>{names[s.index]} {relation.name} {names[t.index]}</strong>:<><strong>{names[s.index]} ↔ {names[t.index]}</strong><b>{s.value} / {t.value}</b></>} tooltipPoint={[cx,cy]}><path d={path} fill={relation?.color??chartColor(t.index,palette)} data-relation={relation?.name} stroke={hoveredLink===i?appearance?.hoverBorderColor??appearance?.borderColor:appearance?.borderColor} strokeWidth={hoveredLink===i?appearance?.hoverBorderWidth??appearance?.borderWidth:appearance?.borderWidth} className="sia-chart__chord-link"/></ChartMark></g>;
  })}
  {layout.groups.map(g=><ChartMark key={g.index} label={`${names[g.index]}，${g.value}`} tooltip={<><strong>{names[g.index]}</strong><b>{g.value}</b></>} tooltipPoint={[cx,cy]}><path d={svgArcPath(cx,cy,outer,g.start,g.end,r,clockwise)} fill={chartColor(g.index,palette)} className="sia-chart__sector"/></ChartMark>)}
  {showNodeLabels?layout.groups.map(g=>{const angle=(g.start+g.end)/2,x=Math.cos(angle),y=Math.sin(angle);return <text key={g.index} className="sia-chart__chord-node-label" x={cx+x*(outer+(appearance?.labelDistance??5))} y={cy+y*(outer+(appearance?.labelDistance??5))} textAnchor={x<0?'end':'start'} dominantBaseline="central" transform={rotateNodeLabels?`rotate(${angle*180/Math.PI+(x<0?180:0)} ${cx+x*(outer+(appearance?.labelDistance??5))} ${cy+y*(outer+(appearance?.labelDistance??5))})`:undefined} fontSize={12} fill="currentColor" pointerEvents="none">{names[g.index]}</text>;}):null}
  {showScale?layout.groups.flatMap(g=>chordScaleTicks(g.start,g.end,layout.total,padAngle).map(({value,angle,label},i)=>{
   const x=Math.cos(angle),y=Math.sin(angle),tx=cx+x*(outer+11),ty=cy+y*(outer+11);
   return <g key={`${g.index}-${i}`} className="sia-chart__chord-scale" pointerEvents="none"><line x1={cx+x*outer} y1={cy+y*outer} x2={cx+x*(outer+4)} y2={cy+y*(outer+4)} stroke="currentColor" strokeWidth={1}/>{label?<text x={tx} y={ty} textAnchor={x<0?'end':'start'} dominantBaseline="central" transform={`rotate(${angle*180/Math.PI+(x<0?180:0)} ${tx} ${ty})`} fontSize={10} fill="currentColor">{Number((value/1000).toFixed(1))}k</text>:null}</g>;
  })):null}
  {appearance?.markers?.map((marker,i)=>{const points=Array.from({length:10},(_,j)=>{const a=-Math.PI/2+j*Math.PI/5,r=j%2?marker.size*.5:marker.size;return `${marker.x+Math.cos(a)*r},${marker.y+Math.sin(a)*r}`;}).join(' ');return <ChartMark key={`marker-${i}`} label={`${marker.name}，${marker.value}`} tooltip={<><strong>{marker.name}</strong><b>{marker.value}</b></>} tooltipPoint={[marker.x,marker.y]}><polygon className="sia-chart__chord-marker" points={points} fill={marker.color??chartColor(0,palette)}/><text x={marker.x} y={marker.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12}>{marker.value}</text></ChartMark>;})}
 </g>;
}
