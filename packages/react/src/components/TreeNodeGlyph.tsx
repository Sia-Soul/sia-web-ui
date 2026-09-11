import {useEffect,useState} from 'react';
import type {TreeItemStyle} from './treeStyles';
export function TreeNodeGlyph({symbol='circle',x,y,width,height,color,itemStyle}:{symbol?:'circle'|'square'|'diamond'|`image://${string}`;x:number;y:number;width:number;height:number;color:string;itemStyle:TreeItemStyle}) {
 const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[symbol]);
 const style={fill:itemStyle.brushType==='stroke'?'none':color,stroke:itemStyle.borderColor,strokeWidth:itemStyle.borderWidth};
 if(symbol.startsWith('image://'))return failed?<g role="img" aria-label="原始节点图片加载失败"><rect x={x-width/2} y={y-height/2} width={width} height={height} fill="none" stroke="#999" strokeDasharray="3 3"/><text x={x} y={y} textAnchor="middle" fontSize={10}>图片不可用</text></g>:<image href={symbol.slice(8)} x={x-width/2} y={y-height/2} width={width} height={height} preserveAspectRatio="none" onError={()=>setFailed(true)}/>;
 if(symbol==='square')return <rect className="sia-chart__tree-node" x={x-width/2} y={y-height/2} width={width} height={height} rx={3} style={style}/>;
 if(symbol==='diamond')return <path className="sia-chart__tree-node" d={`M ${x} ${y-height/2} L ${x+width/2} ${y} L ${x} ${y+height/2} L ${x-width/2} ${y} Z`} style={style}/>;
 return <ellipse className="sia-chart__tree-node" cx={x} cy={y} rx={width/2} ry={height/2} style={style}/>;
}
