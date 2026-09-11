import {useMemo,useRef,useState} from 'react';
import {CandlestickChart,ChartDataZoom,ChartLegend,MixedChart,SiaChart,niceChartDomain,paddedValueExtent,serializeChartStack,saveCompositeImage} from '@sia-ui/react';
import {mixedMarketRows,mixedMarketWindow} from './chartMixedMarketData';

const names=['上证指数','成交金额(万)','虚拟数据'];
export function MixedMarketReferencePreview(){
 const host=useRef<HTMLDivElement>(null);
 const [exportError,setExportError]=useState('');
 const saveImage=()=>{setExportError('');if(host.current)saveCompositeImage(serializeChartStack(host.current),'mix8').catch(error=>setExportError(String(error)));};
 const [brushing,setBrushing]=useState(false);
 const [zoom,setZoom]=useState<[number,number]>([50,100]);
 const [geometry,setGeometry]=useState<'line'|'bar'>();
 const [activeDate,setActiveDate]=useState<string|null>(null);
 const [selected,setSelected]=useState<Record<string,boolean>>(()=>Object.fromEntries(names.map(name=>[name,true])));
 const rows=useMemo(()=>mixedMarketWindow(mixedMarketRows,zoom),[zoom]);
 const categories=useMemo(()=>rows.map(row=>row.date),[rows]);
 const candles=useMemo(()=>rows.map(row=>({name:row.date,open:row.open,close:row.close,low:row.low,high:row.high})),[rows]);
 const priceDomain=niceChartDomain(paddedValueExtent(rows.flatMap(row=>[row.low,row.high])),false);
 const amountDomain=niceChartDomain(paddedValueExtent(rows.map(row=>row.amount)),false,3);
 const virtualDomain=niceChartDomain(paddedValueExtent(rows.map(row=>row.virtual)),false,3);
 const activeIndex=activeDate==null?null:rows.findIndex(row=>row.date===activeDate);
 const onActive=(index:number|null)=>setActiveDate(index==null?null:rows[index]?.date??null);
 const changeZoom=(value:[number,number])=>{setZoom(value);setActiveDate(null);};
 const restore=()=>{setBrushing(false);setGeometry(undefined);changeZoom([50,100]);setSelected(Object.fromEntries(names.map(name=>[name,true])));};
 const brush=(height:number)=>brushing?{bounds:{x:80,y:15,width:700,height},onCancel:()=>setBrushing(false),onSelect:([a,b]:readonly [number,number])=>{
  const low=Math.min(...zoom),span=Math.abs(zoom[1]-zoom[0]);changeZoom([low+span*a,low+span*b]);
 }}:undefined;
 const amount=useMemo(()=>[{name:names[1]!,type:geometry??'line' as const,data:rows.map(row=>row.amount),showPoints:false,color:'#2ec7c9',markAverage:true,markColor:'#1e90ff',markSymbol:'none' as const,showMarkLabel:false}], [rows,geometry]);
 const virtual=useMemo(()=>[{name:names[2]!,type:geometry??'bar' as const,data:rows.map(row=>row.virtual),color:'#2ec7c9',showPoints:false,barRadius:0,markAverage:true,markColor:'#1e90ff',markSymbol:'none' as const,showMarkLabel:false}], [rows,geometry]);
 const row=activeIndex!=null&&activeIndex>=0?rows[activeIndex]:undefined;
 const tooltipX=activeIndex!=null?80+(activeIndex+.5)*700/Math.max(1,rows.length):80;
 const linkedTooltip=(name:string)=>row&&selected[name]?{point:[tooltipX,25] as const,content:<><strong>{row.date}</strong><span>{name}</span>{name===names[0]?<><span>开盘 : {row.open}　最高 : {row.high}</span><span>收盘 : {row.close}　最低 : {row.low}</span></>:<span>{name===names[1]?row.amount:row.virtual}</span>}</>}:null;
 return <><div ref={host} className="chart-mixed-market">
  <SiaChart width={800} height={55} viewBoxSize={[800,55]}  animation={false} ariaLabel="三面板联动图例"><text x={10} y={19} fontSize={18} fontWeight={600}>2013年上半年上证指数</text><ChartLegend x={470} y={34} items={names.map((name,index)=>({name,color:['#f5222d','#2ec7c9','#2ec7c9'][index]!}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:!current[name]}))}/></SiaChart>
  <div data-market-panel="index"><CandlestickChart brush={brush(210)} width={800} height={260} viewBoxSize={[800,260]} plotBounds={{x:80,y:15,width:700,height:210}} controlledTooltip={linkedTooltip(names[0]!)} data={candles} valueDomain={priceDomain} axisLabelFormatter={value=>value.toLocaleString("en-US")} showLegend={false} seriesName="上证指数" seriesVisible={selected[names[0]!]} activeIndex={activeIndex} onActiveIndexChange={onActive} toolbox={{features:['mark','dataZoom','restore','saveAsImage'],zoomActive:brushing,onZoom:()=>{setActiveDate(null);setBrushing(value=>!value);},onMark:()=>setBrushing(false),magicTypes:['line','bar'],activeMagicType:geometry,onMagicTypeChange:type=>{if(type==='line'||type==='bar')setGeometry(type);},onSaveAsImage:saveImage,onRestore:restore}}/></div>
  <ChartDataZoom ariaLabel="上证指数联动范围" value={zoom} onChange={changeZoom} dataShadow={mixedMarketRows.map(row=>row.close)}/>
  <div data-market-panel="amount"><MixedChart width={800} height={200} viewBoxSize={[800,200]} plotBounds={{x:80,y:15,width:700,height:150}} categories={categories} series={amount} brush={brush(150)} controlledTooltip={linkedTooltip(names[1]!)} showLegend={false} legendSelected={selected} clipPlot valueAxes={[{domain:amountDomain,formatter:value=>`${Math.round(value/10000)} 万`}]} showCategoryLabels={false} tooltipTrigger="axis" activeIndex={activeIndex} onActiveIndexChange={onActive}/></div>
  <ChartDataZoom ariaLabel="成交金额联动范围" value={zoom} onChange={changeZoom} dataShadow={mixedMarketRows.map(row=>row.amount)}/>
  <div data-market-panel="virtual"><MixedChart width={800} height={220} viewBoxSize={[800,220]} plotBounds={{x:80,y:15,width:700,height:160}} categories={categories} series={virtual} brush={brush(160)} controlledTooltip={linkedTooltip(names[2]!)} showLegend={false} legendSelected={selected} clipPlot valueAxes={[{domain:virtualDomain,formatter:value=>`${Math.round(value/10000)} 万`}]} categoryLabelInterval="auto" tooltipTrigger="axis" activeIndex={activeIndex} onActiveIndexChange={onActive}/></div>
  <ChartDataZoom ariaLabel="虚拟数据联动范围" value={zoom} onChange={changeZoom} dataShadow={mixedMarketRows.map(row=>row.virtual)}/>
  {row?<div className="chart-market-readout" role="status">{row.date} · 上证指数：开盘 {row.open}，最高 {row.high}，收盘 {row.close}，最低 {row.low} · 成交金额(万)：{row.amount} · 虚拟数据：{row.virtual}</div>:null}
 </div>{exportError?<p role="alert">{exportError}</p>:null}<p className="chart-parity__status">开发中：88日原始数据、三面板同步提示/图例/滑块缩放、横向框选、柱线切换、均值线与合并导出已验证。差异：框选仅缩放日期、不缩放纵轴；未提供缩放历史后退；刻度取整、提示限位、动画和原站布局仍未完全一致；导出不含HTML缩放控件。不计完整一致性通过。</p></>;
}
