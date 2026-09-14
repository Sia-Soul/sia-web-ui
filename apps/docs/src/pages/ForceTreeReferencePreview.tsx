import {useMemo,useState} from 'react';
import {Button,ForceChart} from '@sia.soul/sia-react-ui';
import {createForceTreeData} from './chartForceTreeData';
const categories=['叶子节点','非叶子节点','根节点'];
const colors=['#2ec7c9','#b6a2de','#5ab1ef'];
const physics={model:'legacy' as const,width:720,height:379,center:{x:360,y:189.5},maxNodes:500,minRadius:2,maxRadius:10,coolDown:.995,iterations:1000,seed:53};
export function ForceTreeReferencePreview(){
 const [seed,setSeed]=useState(53),[hidden,setHidden]=useState<string[]>([]);
 const data=useMemo(()=>createForceTreeData(seed),[seed]);
 const values=data.nodes.map(n=>n.value),min=Math.min(...values),max=Math.max(...values);
 const nodes=useMemo(()=>data.nodes.filter(n=>!hidden.includes(categories[n.category]!)).map(n=>({id:String(n.id),name:n.name,value:n.value,radius:2+(n.value-min)/(max-min)*8,color:colors[n.category],borderColor:'rgba(255,215,0,0.6)',borderWidth:1})),[data,hidden,min,max]);
 const links=useMemo(()=>{const ids=new Set(nodes.map(n=>n.id));return data.links.filter(l=>ids.has(String(l.source))&&ids.has(String(l.target))).map(l=>({source:String(l.source),target:String(l.target),value:l.weight,color:'#5ab1ef',width:1}));},[data,nodes]);
 return <>
  <div className="chart-parity__controls">{categories.map((name,i)=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(v=>v.includes(name)?v.filter(n=>n!==name):[...v,name])}><span style={{color:colors[i]}}>●</span> {name}</Button>)}<Button onClick={()=>setSeed(n=>n+1)}>重新生成随机树</Button></div>
  <div className="chart-parity__viewport"><ForceChart nodes={nodes} links={links} progressiveForce forceOptions={physics} showLabels={false} chordOptions={{ribbon:false,nodeGeometry:{center:[360,189.5],orbitRadius:142.125,minRadius:2,maxRadius:10,startAngle:Math.PI/2}}} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>{setSeed(53);setHidden([]);}}}/></div>
  <p style={{textAlign:'right'}}>Force<br/><small>Force-directed tree</small></p>
  <p className="chart-parity__status">原站递归规则生成 {data.nodes.length} 个节点、{data.links.length} 条边，保留三类节点、每个非叶节点 4–7 个孩子、深度优先随机顺序及 2–10 权重范围。固定种子用于复核，可重新生成。已接入密度相关力学和 coolDown=.995 冷却；数值精度、随机初始化、固定 1000 步停止策略、拖动重热、悬浮和切换标签仍需一致性验收。</p>
 </>;
}
