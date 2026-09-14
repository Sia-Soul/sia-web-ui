import {useEffect,useMemo,useRef,useState} from 'react';
import {ChartAxis,ChartComposite,ChartDataEditor,PieChart,SiaChart,chartTicks,linearScale,niceChartDomain} from '@sia.soul/sia-react-ui';
import type {ChartCompositeRef} from '@sia.soul/sia-react-ui';
import {createMixedPieScatterData,mixedPieScatterGlyphs} from './chartMixedPieScatterData';

export function MixedPieScatterReferencePreview(){
 const [original]=useState(()=>createMixedPieScatterData());
 const [data,setData]=useState(original),[replay,setReplay]=useState(0),[error,setError]=useState('');
 const [marking,setMarking]=useState(false);
 const host=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(800);
 useEffect(()=>{
  const element=host.current;if(!element)return;
  const measure=()=>setWidth(Math.max(1,element.getBoundingClientRect().width));
  measure();const observer=new ResizeObserver(measure);observer.observe(element);
  return ()=>observer.disconnect();
 },[]);
 const plotLeft=Math.min(80,width*.15),plotRight=width-plotLeft;
 const composite=useRef<ChartCompositeRef>(null);
 const xDomain=niceChartDomain(data.first.map(point=>point[0]),true,2);
 const yDomain=niceChartDomain(data.first.map(point=>point[1]),true,2);
 const series=useMemo(()=>mixedPieScatterGlyphs(data).map(point=>({
  name:`坐标 ${point.index+1}`,center:[linearScale(point.x,[xDomain[0],xDomain[1]],[plotLeft,plotRight]),linearScale(point.y,[yDomain[0],yDomain[1]],[350,65])] as const,
  innerRadius:0,outerRadius:point.radius,showLabels:false,
  data:[{name:'系列1',value:point.values[0],color:'rgba(255, 69, 0, 0.5)'},{name:'系列2',value:point.values[1],color:'rgba(30, 144, 255, 0.5)'}],
 })),[data,plotLeft,plotRight,xDomain[0],xDomain[1],yDomain[0],yDomain[1]]);
 const dataView=<ChartDataEditor series={[{name:'共同坐标与两组值（x,y,value1,value2）',data:data.first.flatMap((point,index)=>[point[0],point[1],point[2],data.second[index]![2]])}]} onApply={rows=>{
  const values=rows[0]!;
  if(values.some((value,index)=>index%4>=2&&value<0))throw new Error('饼图数值不能为负数。');
  setData({first:data.first.map((_,index)=>[values[index*4]!,values[index*4+1]!,values[index*4+2]!]),second:data.second.map((_,index)=>[values[index*4]!,values[index*4+1]!,values[index*4+3]!])});
 }}/>;
 return <><div ref={host} className={`chart-mixed-pie-scatter${marking?' is-marking':''}`}>
  <ChartComposite ref={composite} width={width} height={420} ariaLabel="mix7 饼图代替散点" layers={[
   {key:'axes',content:<SiaChart width={width} height={420} viewBoxSize={[width,420]} ariaLabel="饼图代替散点 坐标轴" animation={false} toolbox={{features:['mark','dataView','restore','saveAsImage'],dataView,onMark:()=>setMarking(value=>!value),onRestore:()=>{setMarking(false);setData(original);setReplay(value=>value+1);setError('');},onSaveAsImage:()=>{composite.current?.saveAsImage('mix7').catch(reason=>setError(String(reason)));}}}>
    <text x={10} y={22} fontSize={18} fontWeight={600}>饼图代替散点</text><text x={10} y={43} fontSize={12} fill="#777">混搭</text>
    <ChartAxis orientation="bottom" x={plotLeft} y={350} length={plotRight-plotLeft} boundaryGap={false} labels={chartTicks(xDomain).map(String)} gridLength={285}/>
    <ChartAxis orientation="left" x={plotLeft} y={350} length={285} boundaryGap={false} labels={chartTicks(yDomain).map(String)} gridLength={plotRight-plotLeft}/>
   </SiaChart>},
   {key:'pies',pointerEvents:'none',content:<PieChart key={replay} className="sia-chart--overlay" width={width} height={420} viewBoxSize={[width,420]} ariaLabel="40 个坐标饼图" series={series} showLabels={false} showLabelLines={false} legendLayout={{x:width/2,y:16}}/>},
  ]}/>
 </div>{error?<p role="alert">{error}</p>:null}<p className="chart-parity__status">开发中：保留 40 对随机点、倒序双扇区饼图、数值求和半径；响应式重算坐标并保持像素半径，图例、百分比提示、编辑、零值、标线和导出已验证。差异：自动刻度算法、负值编辑限制、提示附带坐标编号、100ms 延迟与逐帧动画尚未和原页一致，不计完整一致性通过。</p></>;
}
