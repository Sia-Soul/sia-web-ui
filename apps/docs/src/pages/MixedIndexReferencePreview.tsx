import {useMemo,useRef,useState} from 'react';
import {CandlestickChart,ChartComposite,ChartDataEditor,ChartDataZoom,ChartLegend,ChartMark,MixedChart,SiaChart,niceChartDomain,paddedValueExtent} from '@sia-ui/react';
import type {ChartCompositeRef} from '@sia-ui/react';
import snapshot from './chartMixedIndexSource.json';

const option=snapshot[0]!.option;
const amounts=option.series[0]!.data as number[];
const prices=option.series[1]!.data as number[][];
const original=option.xAxis[0]!.data.map((date,i)=>({date,amount:amounts[i]!,open:prices[i]![0]!,close:prices[i]![1]!,low:prices[i]![2]!,high:prices[i]![3]!}));
const plot={x:80,y:75,width:740,height:315};
const names=['上证指数','成交金额(万)'];
export function MixedIndexReferencePreview(){
 const [data,setData]=useState(original),[brushing,setBrushing]=useState(false);
 const composite=useRef<ChartCompositeRef>(null);
 const [zoom,setZoom]=useState<[number,number]>([50,100]),[active,setActive]=useState<number|null>(null);
 const [selected,setSelected]=useState<Record<string,boolean>>({'上证指数':true,'成交金额(万)':true});
 const [geometry,setGeometry]=useState<'line'|'bar'>('line'),[error,setError]=useState('');
 const rows=useMemo(()=>{const start=Math.min(data.length-1,Math.floor(Math.min(...zoom)/100*data.length));return data.slice(start,Math.max(start+1,Math.ceil(Math.max(...zoom)/100*data.length)));},[zoom,data]);
 const candles=useMemo(()=>rows.map(row=>({name:row.date,open:row.open,close:row.close,low:row.low,high:row.high})),[rows]);
 const priceDomain=niceChartDomain(paddedValueExtent(rows.flatMap(row=>[row.low,row.high]),.01),false,5);
 const amountDomain=niceChartDomain(paddedValueExtent(rows.map(row=>row.amount),.05),false,5);
 const series=useMemo(()=>[{name:names[1]!,type:geometry,valueAxisIndex:1,data:rows.map(row=>row.amount),showPoints:false,curve:'straight' as const,color:'#2ec7c9',barRadius:0,markAverage:true,markColor:'#1e90ff',markSymbol:'none' as const,markFormatter:(value:number)=>Math.round(value/10000)+' 万'}],[rows,geometry]);
 const row=active==null?undefined:rows[active];
 const extrema=selected[names[1]!]?[{name:'最大值',value:Math.max(...rows.map(row=>row.amount))},{name:'最小值',value:Math.min(...rows.map(row=>row.amount))}].map(mark=>{
  const index=rows.findIndex(row=>row.amount===mark.value);
  return {...mark,index,x:plot.x+(index+.5)*plot.width/rows.length,y:plot.y+plot.height-(mark.value-amountDomain[0])/(amountDomain[1]-amountDomain[0])*plot.height};
 }):[];
 const tooltip=row?{point:[80+(active!+.5)*740/rows.length,90] as const,content:<><strong>{row.date}</strong>{selected[names[0]!]&&<><span>上证指数</span><span>开盘 : {row.open}　最高 : {row.high}</span><span>收盘 : {row.close}　最低 : {row.low}</span></>}{selected[names[1]!]&&<span>成交金额(万) : {row.amount}</span>}</>}:null;
 const restore=()=>{setData(original);setBrushing(false);setZoom([50,100]);setActive(null);setGeometry('line');setSelected({'上证指数':true,'成交金额(万)':true});setError('');};
 const editor=<ChartDataEditor series={data.map(row=>({name:row.date+'：开盘/收盘/最低/最高/金额',data:[row.open,row.close,row.low,row.high,row.amount]}))} onApply={values=>{
  const updated=data.map((row,i)=>{const [open,close,low,high,amount]=values[i]!;if(low!>Math.min(open!,close!)||high!<Math.max(open!,close!)||low!>high!)throw new Error(row.date+'：最低值不能高于开收盘，最高值不能低于开收盘。');return {...row,open:open!,close:close!,low:low!,high:high!,amount:amount!};});
  setData(updated);setActive(null);
 }}/>;
 const brush=brushing?{bounds:plot,onCancel:()=>setBrushing(false),onSelect:([a,b]:readonly [number,number])=>{const start=Math.min(...zoom),span=Math.abs(zoom[1]-zoom[0]);setZoom([start+span*a,start+span*b]);setActive(null);}}:undefined;
 return <><div className="chart-parity__viewport chart-mixed-index">
 <ChartComposite ref={composite} width={900} height={450} ariaLabel="mix10 双轴K线与成交金额" layers={[
  {key:'amount',left:0,top:0,width:900,height:450,content:<MixedChart width={900} height={450} viewBoxSize={[900,450]} plotBounds={plot} categories={rows.map(row=>row.date)} series={series} showLegend={false} legendSelected={selected} clipPlot categoryLabelInterval="auto" valueAxes={[{domain:priceDomain,formatter:value=>value.toLocaleString('en-US')},{domain:amountDomain,position:'right',formatter:value=>Math.round(value/10000)+' 万'}]} activeIndex={active} onActiveIndexChange={setActive} tooltipTrigger="axis" controlledTooltip={tooltip} toolbox={{features:['mark','dataZoom','dataView','restore','saveAsImage'],dataView:editor,zoomActive:brushing,onZoom:()=>{setBrushing(value=>!value);setActive(null);},onMark:()=>setBrushing(false),magicTypes:['line','bar'],activeMagicType:geometry,onMagicTypeChange:type=>{if(type==='line'||type==='bar')setGeometry(type);},onRestore:restore,onSaveAsImage:()=>{composite.current?.saveAsImage('mix10').catch(reason=>setError(String(reason)));}}}/>},
  {key:'candles',left:0,top:0,width:900,height:450,pointerEvents:'none',content:<CandlestickChart className="sia-chart--overlay" width={900} height={450} viewBoxSize={[900,450]} plotBounds={plot} data={candles} valueDomain={priceDomain} showAxes={false} showCategoryLabels={false} showLegend={false} seriesName="上证指数" seriesVisible={selected[names[0]!]} activeIndex={active} onActiveIndexChange={setActive} controlledTooltip={null}/>},
  {key:'heading',left:0,top:0,width:900,height:450,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={900} height={450} viewBoxSize={[900,450]} brush={brush} animation={false}><text x={10} y={22} fontSize={18} fontWeight={600}>{option.title.text}</text><ChartLegend x={460} y={42} items={names.map((name,index)=>({name,color:index?'#2ec7c9':'#f5222d'}))} selected={selected} onItemClick={name=>setSelected(current=>({...current,[name]:!current[name]}))}/></SiaChart>},
  {key:'extrema',left:0,top:0,width:900,height:450,pointerEvents:'none',content:<SiaChart className="sia-chart--overlay" width={900} height={450} viewBoxSize={[900,450]} animation={false}>{extrema.map(mark=><ChartMark key={mark.name} label={`${mark.name}，${mark.value}`} tooltip={<><strong>{mark.name}</strong><span>{mark.value}</span></>} tooltipPoint={[mark.x,mark.y]} onFocus={()=>setActive(null)} onPointerMove={()=>setActive(null)}><path data-index-extreme={mark.name} d={`M ${mark.x} ${mark.y} C ${mark.x-2} ${mark.y-3} ${mark.x-5} ${mark.y-5} ${mark.x-5} ${mark.y-9} A 5 5 0 1 1 ${mark.x+5} ${mark.y-9} C ${mark.x+5} ${mark.y-5} ${mark.x+2} ${mark.y-3} ${mark.x} ${mark.y} Z`} fill="white" stroke="#1e90ff"/><text x={mark.x} y={mark.y-19} textAnchor="middle" fill="#1e90ff" fontSize={12}>{Math.round(mark.value/10000)} 万</text></ChartMark>)}</SiaChart>},
 ]}/>
 <ChartDataZoom ariaLabel="双轴行情范围" value={zoom} onChange={value=>{setZoom(value);setActive(null);}} dataShadow={data.map(row=>row.close)}/>
 </div>{error&&<p role="alert">{error}</p>}<p className="chart-parity__status">开发中：88日双轴K线与金额叠加、联合编辑、图例、共享提示与缩放、极值/均值标记和组合导出已验证。差异：框选仅日期范围，无缩放历史回退；导出不含HTML缩放条；轴刻度、标记形状、布局及动画尚未通过原站完整一致性验收。</p></>;
}
