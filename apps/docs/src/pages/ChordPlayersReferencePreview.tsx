import {useState} from 'react';
import {Button,ChordChart} from '@sia.soul/sia-react-ui';
import source from './chartChordPlayersSource.json';
const option=source.option,original=option.series[0]!;
const palette=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3','#e5cf0d','#97b552','#95706d','#dc69aa','#07a2a4','#9a7fd1','#588dd5','#f5994e','#c05050','#59678c','#c9ab00'];
const colors=new Map([...option.legend.data,...original.nodes.map(n=>n.name).filter(n=>!option.legend.data.includes(n))].map((name,i)=>[name,palette[i%palette.length]!]));
export function ChordPlayersReferencePreview(){
 const [hidden,setHidden]=useState<string[]>([]);
 const links=original.links.filter(link=>!hidden.includes(link.source)&&!hidden.includes(link.target));
 const names=original.nodes.map(n=>n.name).filter(name=>links.some(link=>link.source===name||link.target===name));
 const matrix=names.map(from=>names.map(to=>links.find(link=>link.source===from&&link.target===to)?.weight??0));
 return <>
  <div className="chart-parity__controls" aria-label="效力俱乐部图例">{option.legend.data.map(name=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:colors.get(name)}}>●</span> {name}</Button>)}</div>
  <div className="chart-parity__viewport"><ChordChart nodes={names.map(name=>({id:name,name,color:colors.get(name)}))} links={links.map(link=>({source:link.source,target:link.target,value:link.weight}))} matrix={matrix} showNodeLabels rotateNodeLabels matrixLinkLabel={(from,to)=>`${names[from]} 效力 ${names[to]}`} sort="ascending" sortSub="descending" legacySubSort padAngle={Math.PI/90} matrixGeometry={{center:[360,189.5],innerRadius:123.175,outerRadius:142.125,startAngle:Math.PI/2}} palette={names.map(name=>colors.get(name)!)} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>setHidden([])}}/></div>
  <p style={{textAlign:'right'}}>{option.title.text}</p>
  <p className="chart-parity__status">保留原站 17 个节点、28 条有向关系、0.9/1 双向不对称权重、升序分组、旋转标签、俱乐部过滤、还原与力导向切换。此处为原站历史球员归属数据。待验收与差异：字体与图例/标题位置、弦带边框、关联悬浮高亮、力导向参数和入场动画尚未达到完整一致性。</p>
 </>;
}
