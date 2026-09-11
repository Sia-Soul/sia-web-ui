import {useState} from 'react';
import {Button,ChordChart} from '@sia-ui/react';
import {chordReferenceNames as names,chordReferenceMatrix as source} from './chartChordData';
const colors=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980'];
export function ChordReferencePreview(){
 const [hidden,setHidden]=useState<string[]>([]);
 const indices=names.map((_,i)=>i).filter(i=>!hidden.includes(names[i]!));
 const nodes=indices.map(i=>({id:names[i]!,name:names[i]!,color:colors[i]}));
 const matrix=indices.map(i=>indices.map(j=>source[i]![j]!));
 const links=indices.flatMap(i=>indices.map(j=>({source:names[i]!,target:names[j]!,value:source[i]![j]!})));
 return <><div className="chart-parity__controls" aria-label="和弦分组图例">{names.map((name,i)=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:colors[i]}}>●</span> {name}</Button>)}</div>
 <div className="chart-parity__viewport"><ChordChart nodes={nodes} links={links} matrix={matrix} legacySubSort matrixGeometry={{center:[360,189.5],innerRadius:123.175,outerRadius:142.125,startAngle:Math.PI/2}} showScale padAngle={Math.PI/90} sort="ascending" sortSub="descending" palette={indices.map(i=>colors[i]!)} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>setHidden([])}}/></div>
 <p style={{textAlign:'right'}}>测试数据<br/><small>From d3.js</small></p>
 <p className="chart-parity__status">保留原站 4×4 矩阵、分组升序、90° 起始角、65%/75% 半径与角度刻度，以及和弦/力导向切换；显式兼容原站打包版本在分组升序时忽略子弧降序的行为。待验收与差异：图例与标题布局、刻度文字细节、弦带悬浮联动、力导向物理参数及入场动画尚未完成一致性验收。</p></>;
}
