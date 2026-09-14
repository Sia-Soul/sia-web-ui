import {useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,LineChart,ScatterChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef} from '@sia.soul/sia-react-ui';
import {createMixedScatterData} from './chartMixedScatterData';

const pieces=['#ffff00','#e3fb24','#c8f748','#acf26c','#90ee90'].map((color,index)=>({min:index*20,max:(index+1)*20,color,label:`${index*20} - ${(index+1)*20}`}));
export function MixedScatterReferencePreview(){
 const [original]=useState(()=>createMixedScatterData());
 const [data,setData]=useState(original),[replay,setReplay]=useState(0),[error,setError]=useState('');
 const composite=useRef<ChartCompositeRef>(null);
 const dataView=<ChartDataEditor series={[{name:'散点（x,y,value 三元组）',data:data.scatter.flatMap(item=>[item.x,item.y,item.value!])},{name:'折线（2013-03-1 至 2013-03-30）',data:data.line}]} onApply={rows=>{
  const points=data.scatter.map((item,index)=>({...item,x:rows[0]![index*3]!,y:rows[0]![index*3+1]!,value:rows[0]![index*3+2]!,size:Math.round(rows[0]![index*3+2]!/10)}));
  if(points.some(item=>item.x<1||item.x>30||item.value<0||item.value>100))throw new Error('散点日期必须在 1–30，第三维必须在 0–100。');
  setData({...data,scatter:points,line:rows[1]!});
 }}/>;
 return <>
  <div className="chart-parity__viewport chart-mixed-scatter">
   <ChartComposite ref={composite} width={900} height={400} ariaLabel="mix4 散点与折线双轴混搭" layers={[
    {key:'line',content:<LineChart categoryLabelInterval="auto" key={replay} appearance="macarons" width={900} height={400} viewBoxSize={[900,400]} categories={data.categories} series={[{name:'折线',data:data.line,curve:'straight',color:'#b6a2de'}]} showLegend={false} showCategorySplitLine={false} boundaryGap={false} tooltipTrigger="axis" animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView,onSaveAsImage:()=>{setError('');composite.current?.saveAsImage('mix4').catch(reason=>setError(String(reason)));},onRestore:()=>{setData(original);setReplay(value=>value+1);setError('');}}}/>},
    {key:'scatter',pointerEvents:'none',content:<ScatterChart key={replay} className="sia-chart--overlay" width={900} height={400} viewBoxSize={[900,400]} plotBounds={{x:80,y:60,width:740,height:270}} data={data.scatter} xDomain={[1,30,1]} showXAxis={false} showYSplitLine={false} yAxisPosition="right" showLegend={false} minSymbolRadius={0} symbolSize={item=>Math.round(item.value!/10)} animation={false} visualMap={{dimension:'value',min:0,max:100,colors:['#ffff00','#90ee90'],pieces,selectable:true,orientation:'horizontal',x:80,y:20,width:400}} tooltipFormatter={item=><><strong>{`2013-03-${item.x}`}</strong><span>{`散点 : ${item.y}, ${item.value}`}</span></>}/>},
   ]}/>
  </div>
  {error?<p role="alert">{error}</p>:null}
  <p className="chart-parity__status">开发中：保留 200 三维散点与 30 天折线原始随机规则，独立左右轴、五段颜色、第三维大小、单项/轴提示、统一编辑及组合导出，按原站关闭动画。日期间隔、鼠标穿透、筛选与边界值、编辑同步及还原已验证。差异：颜色色阶、点描边/透明度、色块顺序/尺寸、轴刻度算法与工具箱细节仍需对照；日期标签使用估算宽度而非原站字体测量，编辑器暂限制第三维在 0–100。</p>
 </>;
}
