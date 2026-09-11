import {useState} from 'react';
import {Button,ChordChart} from '@sia-ui/react';
import source from './chartChordRelationsSource.json';
const option=source.option;
const names=option.series[0]!.data.map(node=>node.name);
// Legend consumes the first fifteen palette entries for nodes, then relation colors.
const relationColors=option.color.slice(15,18);
export function ChordRelationsReferencePreview(){
 const [hiddenNodes,setHiddenNodes]=useState<string[]>([]);
 const [hiddenSeries,setHiddenSeries]=useState<string[]>([]);
 const indices=names.map((_,i)=>i).filter(i=>!hiddenNodes.includes(names[i]!));
 const nodes=indices.map(i=>({id:names[i]!,name:names[i]!,color:option.color[i]}));
 const series=option.series.flatMap((entry,k)=>hiddenSeries.includes(entry.name)?[]:[{name:entry.name,color:relationColors[k]!,matrix:indices.map(i=>indices.map(j=>entry.matrix[i]![j]!))}]);
 const links=series.flatMap(entry=>entry.matrix.flatMap((row,i)=>row.flatMap((value,j)=>value>0?[{source:nodes[i]!.id,target:nodes[j]!.id,value,color:entry.color}]:[])));
 return <>
  <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
   <div aria-label="敌友关系图例" style={{display:'flex',flexDirection:'column',flex:'0 0 126px'}}>
    {names.map((name,i)=><Button key={name} variant="text" size="small" aria-pressed={!hiddenNodes.includes(name)} onClick={()=>setHiddenNodes(current=>current.includes(name)?current.filter(n=>n!==name):[...current,name])}><span style={{color:option.color[i]}}>●</span> {name}</Button>)}
    {option.series.map((entry,i)=><Button key={entry.name} variant="text" size="small" aria-pressed={!hiddenSeries.includes(entry.name)} onClick={()=>setHiddenSeries(current=>current.includes(entry.name)?current.filter(n=>n!==entry.name):[...current,entry.name])}><span style={{color:relationColors[i]}}>●</span> {entry.name}</Button>)}
   </div>
   <div className="chart-parity__viewport" style={{flex:1,minWidth:0}}><ChordChart nodes={nodes} links={links} matrixSeries={series} showNodeLabels clockwise={false} matrixGeometry={{center:[360,189.5],innerRadius:123.175,outerRadius:142.125,startAngle:-Math.PI/2}} padAngle={Math.PI/90} palette={indices.map(i=>option.color[i]!)} width={720} height={379} viewBoxSize={[720,379]} toolbox={{features:['restore','saveAsImage'],magicTypes:['force','chord'],onRestore:()=>{setHiddenNodes([]);setHiddenSeries([]);}}}/></div>
  </div>
  <p style={{textAlign:'right'}}>{option.title.text}<br/><small>{option.title.subtext}</small></p>
  <p className="chart-parity__status">保留原站 15 个节点、支持/反对/未表态三份矩阵及独立关系色，共享圆弧、逆时针布局、节点与关系图例筛选、还原及力导向切换。数据为原站历史示例，不代表当前现实关系。待验收与差异：图例尺寸与画布占位、标题定位、弦带边框、悬浮关联高亮、力导向物理参数和动画尚未达到完整一致性。</p>
 </>;
}
