import {useState} from 'react';
import {Button,RadarChart,type RadarPanel} from '@sia.soul/sia-react-ui';
import source from './chartRadarStyledSource.json';
const option=source[0]!.option;
const colors=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80'];
const panels:RadarPanel[]=[
 {autoScale:true,scale:true,levels:8,shape:'circle',center:[180,210],radius:150,
  indicators:option.polar[0]!.indicator.map(item=>({name:item.text})),
  axisColor:'green',axisWidth:2,splitLineColor:'yellow',splitLineWidth:2,splitAreaColors:['rgba(0,200,200,0.3)','rgba(250,0,250,0.3)'],indicatorColor:'red',indicatorFormatter:name=>`【${name}】`,showAxisLabels:true,axisLabelColor:'#ccc',
  series:option.series[0]!.data.map((item,index)=>({name:item.name,data:item.value,color:colors[index],pointSymbol:index===0?'star':'circle',pointRadius:4,showPoints:index!==2,areaOpacity:index===1?.5:0,lineStyle:index===0?'dashed':index===2?'dotted':'solid',emphasisLineWidth:4}))},
 {center:[540,210],radius:150,indicators:option.polar[1]!.indicator.map(item=>({name:item.text,max:'max' in item?item.max:undefined})),
  series:option.series[1]!.data.map((item,index)=>({name:item.name,data:item.value,color:colors[index+3],areaOpacity:index===0?1:.5,lineStyle:index===1?'dashed':'solid',showValueLabels:index===0,pointColor:index===0?(value:number)=>value>=120?'green':'red':undefined,areaGradient:index===0?{center:[470,200],focus:[470,210],radius:150,stops:[{offset:0,color:'rgba(255,255,0,0.3)'},{offset:1,color:'rgba(255,0,0,0.5)'}]}:undefined}))}
];
export function RadarStyledReferencePreview(){
 const [selected,setSelected]=useState<Record<string,boolean>>({});
 const [currentPanels,setCurrentPanels]=useState<readonly RadarPanel[]>(panels);
 const [transferError,setTransferError]=useState('');
 return <>
  <div className="chart-parity__controls">{(currentPanels[0]?.series??[]).map((series,index)=><Button key={series.name} variant="text" aria-pressed={selected[series.name]!==false} onClick={()=>setSelected(previous=>({...previous,[series.name]:previous[series.name]===false}))}><span style={{color:series.color??colors[index]}}>━</span> {series.name}</Button>)}</div>
  <div className="chart-parity__viewport"><RadarChart calculable onTransferError={message=>setTransferError(`拖放未应用：${message}`)} onDataChange={next=>{setCurrentPanels(next);setTransferError('');}} appearance="macarons" radars={panels} showLegend={false} legendSelected={selected} markers={[{name:'打酱油的标注',value:100,x:360,y:63,size:64,color:'#8d98b3',hollow:true}]} width={720} height={420} viewBoxSize={[720,420]} toolbox={{features:['mark','dataView','restore','saveAsImage'],onRestore:()=>{setSelected({});setCurrentPanels(panels);setTransferError('');}}}/></div>
  {transferError?<p role="alert">{transferError}</p>:null}
  <p className="chart-parity__status">开发中，未通过完整一致性验收。原始五组数据、双极坐标、小数与负值自动轴、八层圆环、星形点、成绩颜色与数值标签、径向渐变、心形标注已组合为可运行预览。整组拖放合并、图例更新、拖出删除及还原已通过浏览器鼠标测试；跨面板图例与不同维度合并、刻度、标签与标注定位、提示触发及动画仍需原站一致性核验。</p>
 </>;
}
