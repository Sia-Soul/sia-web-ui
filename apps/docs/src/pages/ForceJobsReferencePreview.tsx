import {useState} from 'react';
import {Button,ForceChart} from '@sia.soul/sia-react-ui';
import source from './chartForceJobsSource.json';
const option=source.option,series=option.series[0]!;
const colors=['#5ab1ef','#2ec7c9','#b6a2de'];
const physics={gravity:series.gravity,scaling:series.scaling,weightedLinks:true};
export function ForceJobsReferencePreview(){
 const [hidden,setHidden]=useState<string[]>([]);
 const nodes=series.nodes.filter(n=>!hidden.includes(series.categories[n.category]!.name)).map(n=>({id:n.name,name:n.name,label:n.label,value:n.value,radius:15+(n.value-1)/9*10,labelColor:"#333",borderColor:"rgba(255,215,0,0.4)",borderWidth:1,color:colors[n.category]}));
 const ids=new Set(nodes.map(n=>n.id));
 const links=series.links.filter(l=>ids.has(l.source)&&ids.has(l.target)).map(l=>({source:l.source,target:l.target,value:l.weight,curvature:.2,color:"#5ab1ef",width:1,label:`人物关系 : ${l.name??`${l.source} - ${l.target}`}`}));
 return <>
  <div className="chart-parity__controls" aria-label="人物关系分类图例">{option.legend.data.map((name,i)=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:colors[i+1]}}>●</span> {name}</Button>)}</div>
  <div className="chart-parity__viewport"><ForceChart progressiveForce nodes={nodes} links={links} roam="move" forceOptions={physics} chordOptions={{ribbon:false,nodeGeometry:{center:[360,189.5],orbitRadius:142.125,minRadius:15,maxRadius:25,startAngle:Math.PI/2}}} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>setHidden([])}}/></div>
  <p style={{textAlign:'right'}}>{option.title.text}<br/><small>{option.title.subtext}</small></p>
  <p className="chart-parity__status">保留原站 11 节点、18 条加权关系、主要节点双行文字、分类过滤、15–25 半径、曲线、移动漫游和 force/chord 切换。当前求解器是自研近似，尚非原站物理过程；悬浮标签隐藏、真实鼠标拖动验证、运动轨迹与时序、字体及标题定位仍待完整一致性验收。</p>
 </>;
}
