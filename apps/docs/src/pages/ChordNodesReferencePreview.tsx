import {useState} from 'react';
import {Button,ChordChart} from '@sia-ui/react';
import source from './chartChordNodesSource.json';
const option=source.option,original=option.series[0]!;
const palette=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3','#e5cf0d','#97b552','#95706d','#dc69aa','#07a2a4','#9a7fd1','#588dd5','#f5994e','#c05050','#59678c','#c9ab00'];
const colors=new Map([...option.legend.data,...original.nodes.map(n=>n.name).filter(n=>!option.legend.data.includes(n))].map((name,i)=>[name,palette[i%palette.length]!]));
export function ChordNodesReferencePreview(){
 const [hidden,setHidden]=useState<string[]>([]);
 const links=original.links.filter(link=>!hidden.includes(link.source)&&!hidden.includes(link.target));
 const nodes=original.nodes.filter(node=>links.some(link=>link.source===node.name||link.target===node.name)).map(node=>({id:node.name,name:node.name,color:colors.get(node.name),nodeSymbol:node.symbol==='star'?'star' as const:'circle' as const}));
 return <>
  <div className="chart-parity__controls" aria-label="节点和弦俱乐部图例">{option.legend.data.map(name=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:colors.get(name)}}>●</span> {name}</Button>)}</div>
  <div className="chart-parity__viewport"><ChordChart nodes={nodes} links={links.map(link=>({source:link.source,target:link.target,value:link.weight,label:`${link.target} ${link.name} ${link.source}`}))} ribbon={false} rotateNodeLabels sort="ascending" nodeGeometry={{center:[360,189.5],orbitRadius:113.7,minRadius:original.minRadius,maxRadius:original.maxRadius,startAngle:Math.PI/2}} padAngle={Math.PI/90} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>setHidden([])}}/></div>
  <p style={{textAlign:'right'}}>{option.title.text}</p>
  <p className="chart-parity__status">保留原站 17 节点、14 条权重为 1 的单向效力关系、7–20 节点半径映射、60% 圆周半径、旋转标签与穆勒星形，支持图例过滤、还原和力导向切换。数据为历史示例；字体/标题/图例定位、悬浮关联高亮、力导向物理参数和动画仍待一致性验收。</p>
 </>;
}
