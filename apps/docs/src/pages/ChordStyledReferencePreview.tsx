import {useState} from 'react';
import {Button,ChordChart} from '@sia-ui/react';
import source from './chartChordStyledSource.json';
const option=source.option,series=option.series[0]!,names=series.data.map(n=>n.name);
const colors=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980'];
export function ChordStyledReferencePreview(){
 const [hidden,setHidden]=useState<string[]>([]);
 const indices=names.map((_,i)=>i).filter(i=>!hidden.includes(names[i]!));
 const matrix=indices.map(i=>indices.map(j=>series.matrix[i]![j]!));
 return <>
  <div className="chart-parity__controls" aria-label="个性化和弦图例">{names.map((name,i)=><Button key={name} variant="text" aria-pressed={!hidden.includes(name)} onClick={()=>setHidden(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:colors[i]}}>●</span> {name}</Button>)}</div>
  <div className="chart-parity__viewport"><ChordChart title={option.title.text} nodes={indices.map(i=>({id:names[i]!,name:names[i]!}))} links={indices.flatMap(i=>indices.map(j=>({source:names[i]!,target:names[j]!,value:series.matrix[i]![j]!})))} matrix={matrix} matrixLinkLabel={(i,j)=>String(matrix[i]![j])} showNodeLabels showScale clockwise={false} sort="descending" sortSub="descending" legacySubSort padAngle={Math.PI/90} matrixGeometry={{center:[360,189.5],innerRadius:104.225,outerRadius:142.125,startAngle:-Math.PI/2}} matrixAppearance={{borderColor:'#333',borderWidth:1,hoverBorderColor:'black',hoverBorderWidth:2,labelDistance:40,markers:series.markPoint.data.map(mark=>({name:mark.name,value:mark.value,x:parseFloat(mark.x)/100*720,y:parseFloat(mark.y)/100*379,size:mark.symbolSize,color:'#d87a80'}))}} palette={indices.map(i=>colors[i]!)} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>setHidden([])}}/></div>
  <p className="chart-parity__status">保留原站 4×4 矩阵、逆时针与双降序、55%/75% 半径、角度刻度、两个值为 100 的星形标注、边框悬浮样式、图例过滤与还原。待验收与差异：原站自定义节点强调色、标注在力导向模式的保留、工具箱底部位置、字体、关联高亮和动画尚未完整对齐。</p>
 </>;
}
