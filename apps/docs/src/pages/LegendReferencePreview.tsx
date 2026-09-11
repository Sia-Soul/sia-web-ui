import {useEffect,useMemo,useRef,useState} from 'react';
import {ChartAxis,ChartLegend,MixedChart,ChartWhirlingLoading} from '@sia-ui/react';
import type {MixedSeries} from '@sia-ui/react';
import source from './chartLegendReferenceSource.json';

const option=source[0]!.option;
// The original palette is allocated by legend order, not by series order.
const colors:Record<string,string>={'蒸发量':'#2ec7c9','降水量':'#b6a2de','最高气温':'#5ab1ef'};
const series:MixedSeries[]=option.series.map(item=>({name:item.name,type:item.type as 'bar'|'line',data:item.data,valueAxisIndex:'yAxisIndex' in item?item.yAxisIndex:0,color:colors[item.name],curve:'smooth',lineWidth:2,hollowSymbol:true,symbolSize:6,barRadius:5}));
const labels=(domain:readonly [number,number,number])=>Array.from({length:Math.round((domain[1]-domain[0])/domain[2])+1},(_,i)=>String(Number((domain[0]+i*domain[2]).toFixed(10))));

export function LegendReferencePreview(){
 const [selected,setSelected]=useState<Record<string,boolean>>({'蒸发量':true,'降水量':false,'最高气温':true});
 const [added,setAdded]=useState(false),[loading,setLoading]=useState(false);
 const pending=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>()=>{if(pending.current)clearTimeout(pending.current);},[]);
 const currentSeries=useMemo(()=>added?[...series,{name:'最低气温',type:'line' as const,data:[-2,1,2,5,3,2,0],valueAxisIndex:1,color:'#ffb980',curve:'smooth' as const,lineWidth:2,hollowSymbol:true,symbolSize:6}]:series,[added]);
 const toggle=(name:string)=>{
  const next={...selected,[name]:!selected[name]};setSelected(next);
  if(next['最低气温']&&!added&&!pending.current){
   setLoading(true);pending.current=setTimeout(()=>{setAdded(true);setLoading(false);pending.current=undefined;},2000);
  }
 };
 return <div className="chart-legend-reference">
  <div style={{position:'relative'}} aria-busy={loading}>
  <MixedChart width="100%" height={378} viewBoxSize={[995,378]} plotBounds={{x:80.5,y:60.5,width:835,height:258}} categories={option.xAxis.data} series={currentSeries} showLegend={false} legendSelected={selected} onLegendSelectionChange={setSelected} coordinateAnimation barSpacing={{categoryGap:.2,seriesGap:.3,pixelAlign:true}} valueAxes={[{autoDomain:{}},{autoDomain:{targetSplitNumber:5,preferredSteps:[1,2,3,5,10]}}]}
   renderAxes={({plot,categoryPositions,valueDomains})=><>
    <ChartAxis orientation="bottom" x={plot.x} y={plot.y+plot.height} length={plot.width} labels={option.xAxis.data} positions={categoryPositions} boundaryGap gridLength={plot.height} lineStyle={{stroke:'#008acd',strokeWidth:2}} gridStyle={{stroke:'#eee'}} labelStyle={{fontSize:12}}/>
    {selected['蒸发量']||selected['降水量']?<ChartAxis orientation="left" x={plot.x} y={plot.y+plot.height} length={plot.height} labels={labels(valueDomains[0]!)} gridLength={plot.width} boundaryGap={false} formatter={value=>value+' ml'} lineStyle={{stroke:'#008acd',strokeWidth:2}} gridStyle={{stroke:'#eee'}} labelStyle={{fontSize:12}}/>:null}
    {selected['最高气温']||added&&selected['最低气温']?<ChartAxis orientation="right" x={plot.x+plot.width} y={plot.y+plot.height} length={plot.height} labels={labels(valueDomains[1]!)} boundaryGap={false} showGrid={false} formatter={value=>value+' °C'} lineStyle={{stroke:'#008acd',strokeWidth:2}} labelStyle={{fontSize:12}}/>:null}
    <ChartLegend x={639} y={21} align="start" iconWidth={20} iconHeight={14} textGap={5} itemGap={20} inactiveColor="#ccc" textStyle={{fill:'red',fontSize:12,fontFamily:'微软雅黑, Arial, Verdana, sans-serif'}} background={{fill:option.legend.backgroundColor,stroke:option.legend.borderColor,strokeWidth:option.legend.borderWidth,padding:option.legend.padding}}
     items={option.legend.data.map(entry=>{
      const name=typeof entry==='string'?entry:entry.name;
      return {name,color:colors[name]??(added?'#ffb980':'#ccc'),symbol:name==='最高气温'||name==='最低气温'&&added?'line' as const:'rect' as const,textWidth:name.length*12,disabled:!(name in colors)&&!added,image:typeof entry==='string'?undefined:new URL(entry.icon.replace('image://',''),source[0]!.url).href,textStyle:typeof entry==='string'?undefined:{fill:entry.textStyle.color,fontWeight:entry.textStyle.fontWeight}};
     })} selected={selected} onItemClick={toggle}/>
   </>}/>
  {loading?<ChartWhirlingLoading width={995} height={378}/>:null}
  </div>
  <p className="chart-parity__status">自研对应实现 · 开发中：保留初始三系列21个值及事件中追加的7个最低气温值。第一次选择最低气温显示“数据获取中”，2秒后加入折线；后续切换不重复添加。7种图例状态下的两侧数值刻度已对照。图片沿用原站静态资源，不加载原站图表运行时。自研whirling已核对环/水滴/圆心尺寸、颜色及文字位置，减少动态效果时不旋转；初始与追加后柱形及折线点最终几何已对照。曲线控制点、图例轮廓、字体墨迹、首次绘制时序及完整动画尚未一致验收。</p>
 </div>;
}
