import {useMemo,useRef,useState} from 'react';
import {ChartComposite,ChartDataEditor,FunnelChart,GaugeChart,SiaChart} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef,FunnelSeries} from '@sia.soul/sia-react-ui';
import snapshot from './chartMixedBusinessSource.json';
const option=snapshot[0]!.option;
const initial=option.series.map(series=>series.data.map(item=>item.value));
const names=option.legend.data;
export function MixedBusinessReferencePreview(){
 const composite=useRef<ChartCompositeRef>(null);
 const [values,setValues]=useState(initial),[selected,setSelected]=useState<Record<string,boolean>>({}),[replay,setReplay]=useState(0),[error,setError]=useState('');
 const funnels=useMemo<FunnelSeries[]>(()=>option.series.slice(1).map((series,index)=>({name:series.name,left:405,top:60,width:405,height:330,min:0,max:100,maxSize:index===1?.8:1,gap:0,sort:'descending',labelPosition:index===1?'inside':'right',showLabelLines:false,borderColor:'#fff',borderWidth:index===1?2:1,emphasisLabelPosition:'inside',emphasisLabelFormatter:item=>item.name+series.name+' : '+item.value+'%',tooltipFormatter:item=><><strong>{series.name}</strong><span>{item.name} : {item.value}%</span></>,labelFormatter:item=>index===1?item.value+'%':item.name+'预期',data:series.data.map((item,i)=>({...item,value:values[index+1]![i]!,color:option.color[names.indexOf(item.name)]}))})),[values]);
 const restore=()=>{setValues(initial);setSelected({});setReplay(value=>value+1);setError('');};
 const editor=<ChartDataEditor series={option.series.map((series,i)=>({name:series.name,data:values[i]!}))} onApply={setValues}/>;
 return <><div className="chart-parity__viewport chart-mixed-business"><ChartComposite ref={composite} width={900} height={450} ariaLabel="mix11 商业BI仪表盘与双层漏斗" layers={[
  {key:'funnel',left:0,top:0,width:900,height:450,content:<FunnelChart key={replay} appearance="macarons" width={900} height={450} viewBoxSize={[900,450]} series={funnels} legendOrder={names} legendLayout={{x:530,y:25}} legendSelected={selected} onLegendSelectionChange={setSelected}/>},
  {key:'gauge',left:0,top:0,width:900,height:450,pointerEvents:'none',content:<GaugeChart key={replay} className="sia-chart--overlay" appearance="macarons" tooltipFormatter={item=><><strong>业务指标</strong><span>{item.name} : {item.value}%</span></>} width={900} height={450} viewBoxSize={[900,450]} startAngle={-225} endAngle={45} data={[{name:'完成率',value:values[0]![0]!,center:[225,247.5],radius:168.75,axisWidth:8,splitNumber:10,tickCount:10,tickLength:12,tickColor:'auto',splitLength:30,splitColor:'auto',labelColor:'auto',pointerWidth:5,nameFontWeight:'bolder',detailFontWeight:'bolder',detailColor:'auto',unit:'%',segments:[{until:.2,color:'#228b22'},{until:.8,color:'#48b'},{until:1,color:'#ff4500'}]}]}/>},
  {key:'heading',left:0,top:0,width:900,height:450,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={900} height={450} viewBoxSize={[900,450]} animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView:editor,onRestore:restore,onSaveAsImage:()=>{composite.current?.saveAsImage('mix11').catch(reason=>setError(String(reason)));}}}><text x={10} y={22} fontSize={18} fontWeight={600}>{option.title.text}</text><text x={10} y={43} fontSize={12} fill="#999">{option.title.subtext}</text></SiaChart>},
 ]}/></div>{error&&<p role="alert">{error}</p>}<p className="chart-parity__status">开发中：原始完成率与预期/实际双层漏斗、共享图例、联合编辑、强调标签、百分比提示、跨层标线、还原及导出已验证。字体、指针形状、标签排版、响应式尺寸与动画尚未通过原站完整一致性验收。</p></>;
}
