import {useMemo,useState} from 'react';
import {Button,Slider,ChartDataZoom,MixedChart} from '@sia-ui/react';
import {rainFlowCategories,rainFlowOption,rainFlowSeries} from './chartRainFlowData';
export function RainFlowReferencePreview(){
 const [zoom,setZoom]=useState<[number,number]>([0,100]);
 const [data,setData]=useState(rainFlowSeries);
 const [replay,setReplay]=useState(0),[progress,setProgress]=useState<number>();
 const start=Math.floor(Math.min(...zoom)/100*(rainFlowCategories.length-1));
 const end=Math.max(start+1,Math.ceil(Math.max(...zoom)/100*rainFlowCategories.length));
 const categories=rainFlowCategories.slice(start,end);
 const visible=useMemo(()=>data.map(item=>({...item,data:item.data.slice(start,end)})),[data,start,end]);
 return <div className="chart-rain-flow">
  <div className="chart-parity__controls"><Button onClick={()=>{setProgress(undefined);setReplay(value=>value+1);}}>重播入场动画</Button><Button onClick={()=>setProgress(1)}>查看最终帧</Button></div>
  <Slider aria-label="雨量流量动画时间" min={0} max={2000} step={20} value={(progress??1)*2000} onChange={value=>setProgress(Number(value)/2000)}/>
  <MixedChart key={replay} coordinateAnimation animationDuration={2000} animationDurationUpdate={500} animationProgress={progress} width={995} height={378} viewBoxSize={[995,378]} titleAlign="center" ariaLabel={rainFlowOption.title.text}
   title={<span style={{color:'#008acd',fontSize:18,fontWeight:'normal',fontFamily:'微软雅黑, Arial, Verdana, sans-serif'}}>{rainFlowOption.title.text}</span>}
   description={<span style={{color:'#aaa',fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif'}}>{rainFlowOption.title.subtext}</span>}
   legendLayout={{x:66.5,y:16,symbol:'line'}}
   plotBounds={{x:80.5,y:60.5,width:835,height:258}} boundaryGap={false} categories={categories} series={visible} categoryLabelInterval="auto" clipPlot
   valueAxes={[{name:'流量(m^3/s)',domain:[0,500,100],axisColor:'#008acd',gridColor:'#eee',showTicks:false},{name:'降雨量(mm)',position:'right',formatter:value=>String(-value),axisColor:'#008acd',gridColor:'#eee',showTicks:false}]}
   tooltipTrigger="axis" axisTooltipFormatter={(index,series)=><><strong>{categories[index]}</strong>{series.map(item=><span key={item.name}>{item.name}：{item.data[index]===null?'-':item.name==='降雨量'?-item.data[index]!:item.data[index]} ({item.name==='降雨量'?'mm':'m^3/s'})</span>)}</>}
   onDataChange={next=>setData(current=>current.map((item,row)=>({...item,data:item.data.map((value,index)=>index>=start&&index<end?next[row]!.data[index-start]!:value)})))}
   toolbox={{features:['mark','dataView','restore','saveAsImage'],magicTypes:['line','bar'],onRestore:()=>{setZoom([0,100]);setData(rainFlowSeries);}}}/>
  <ChartDataZoom value={zoom} dataShadow={data[0]!.data.map(value=>value??0)} showDetail onChange={setZoom}/>
  <p className="chart-parity__status">已接入 · 开发中：原始3079时间点、双轴面积、835点绘制采样、降雨负向绘制、范围缩放与编辑、工具箱、入场与更新动画已验证运行。待一致性验收：原站动画中间帧与模式过渡、缩放后的采样边界、轴线宽度和分区背景、字体与图例精细间距、不同尺寸性能。</p>
 </div>;
}
