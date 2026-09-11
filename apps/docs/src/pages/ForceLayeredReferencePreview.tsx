import {useMemo,useState} from 'react';
import {Button,ForceChart} from '@sia-ui/react';
import {createForceLayeredData} from './chartForceLayeredData';
const categories=['叶子节点','非叶子节点','根节点'];
const colors=['#ff7f50','#6f57bc','#af0000'];
const physics={model:'legacy' as const,width:720,height:379,center:{x:360,y:189.5},maxNodes:500,minRadius:2,maxRadius:10,coolDown:.99,iterations:700,seed:53};
export function ForceLayeredReferencePreview(){
 const [seed,setSeed]=useState(53),[hidden,setHidden]=useState<string[]>([]);
 const data=useMemo(()=>createForceLayeredData(seed),[seed]);
 const nodes=useMemo(()=>{
  const visible=data.nodes.filter(n=>!hidden.includes(categories[n.category]!));
  const values=visible.map(n=>n.value),min=Math.min(...values),max=Math.max(...values);
  return visible.map(n=>({id:String(n.id),name:n.name,value:n.value,x:n.x,y:n.y,fixY:n.fixY,radius:max>min?2+(n.value-min)/(max-min)*8:4,color:colors[n.category],borderColor:'rgba(255,215,0,0.6)',borderWidth:1}));
 },[data,hidden]);
 const links=useMemo(()=>{const ids=new Set(nodes.map(n=>n.id));return data.links.filter(l=>ids.has(String(l.source))&&ids.has(String(l.target))).map(l=>({source:String(l.source),target:String(l.target),value:l.weight,color:'#5ab1ef',width:1}));},[data,nodes]);
 return <>
  <div className="chart-parity__controls">{categories.map((name,i)=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(v=>v.includes(name)?v.filter(n=>n!==name):[...v,name])}><span style={{color:colors[i]}}>●</span> {name}</Button>)}<Button onClick={()=>setSeed(n=>n+1)}>重新生成分层树</Button></div>
  <div className="chart-parity__viewport"><ForceChart nodes={nodes} links={links} progressiveForce forceOptions={physics} showLabels={false} chordOptions={{ribbon:false,nodeGeometry:{center:[360,189.5],orbitRadius:142.125,minRadius:2,maxRadius:10,startAngle:Math.PI/2}}} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>{setSeed(53);setHidden([]);}}}/></div>
  <p style={{textAlign:'right'}}>Force<br/><small>Force-directed tree</small></p>
  <p className="chart-parity__status">原站 force4 生成规则：{data.nodes.length} 个节点、{data.links.length} 条边，深度 0–4、每个非叶节点 2–3 个孩子，初始横坐标位于中心 ±100、纵坐标按深度固定。使用自研按轴固定力学、三类原始颜色及 2–10 节点半径。固定随机种子、数值精度、700 步停止、拖动重热、悬浮和切换动画仍与原站存在差异，未通过完整一致性验收。</p>
 </>;
}
