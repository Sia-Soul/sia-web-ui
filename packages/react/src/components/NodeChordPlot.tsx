import {ChartMark,chartColor} from './Chart';
import {chordNodeLayout} from './chordMatrixLayout';
export function NodeChordPlot({nodes,links,geometry,palette,sort,clockwise,padAngle,rotateLabels}:{nodes:readonly {id:string;name:string;value?:number;color?:string;nodeSymbol?:'circle'|'star'}[];links:readonly {source:string;target:string;value:number;color?:string;label?:string}[];geometry:{center:readonly [number,number];orbitRadius:number;minRadius:number;maxRadius:number;startAngle?:number};palette?:readonly string[];sort:'none'|'ascending'|'descending';clockwise:boolean;padAngle:number;rotateLabels:boolean}){
 const layout=chordNodeLayout(nodes,links,{...geometry,sort,clockwise,padAngle});
 const byId=new Map(layout.map(n=>[n.id,n]));
 const [cx,cy]=geometry.center;
 return <g className="sia-chart__node-chord">
  {links.map((link,i)=>{const a=byId.get(link.source),b=byId.get(link.target);if(!a||!b)return null;const label=link.label??`${nodes[a.index]!.name} → ${nodes[b.index]!.name}`;return <ChartMark key={i} label={label} tooltip={<strong>{label}</strong>} tooltipPoint={[cx+(a.x+b.x)/2,cy+(a.y+b.y)/2]}><path className="sia-chart__node-chord-link" d={`M ${cx+a.x} ${cy+a.y} Q ${cx} ${cy} ${cx+b.x} ${cy+b.y}`} fill="none" stroke={link.color??'black'} strokeWidth={1} opacity={.5}/></ChartMark>;})}
  {layout.map(n=>{const node=nodes[n.index]!,color=node.color??chartColor(n.index,palette),x=cx+n.x,y=cy+n.y,r=n.radius;
   const star=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,radius=i%2?r*.5:r;return `${x+Math.cos(a)*radius},${y+Math.sin(a)*radius}`;}).join(' ');
   const distance=geometry.orbitRadius+r+5,lx=cx+Math.cos(n.middle)*distance,ly=cy+Math.sin(n.middle)*distance,left=Math.cos(n.middle)<0;
   return <g key={n.id}><ChartMark label={node.name} tooltip={<strong>{node.name}</strong>} tooltipPoint={[x,y]}>{node.nodeSymbol==='star'?<polygon className="sia-chart__node-chord-symbol" data-symbol="star" points={star} fill={color}/>:<circle className="sia-chart__node-chord-symbol" cx={x} cy={y} r={r} fill={color}/>}</ChartMark><text x={lx} y={ly} textAnchor={left?'end':'start'} dominantBaseline="central" fontSize={12} fill="currentColor" transform={rotateLabels?`rotate(${n.middle*180/Math.PI+(left?180:0)} ${lx} ${ly})`:undefined}>{node.name}</text></g>;
  })}
 </g>;
}
