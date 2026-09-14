import {EventRiverChart} from '@sia.soul/sia-react-ui';
import type {EventRiverSeries} from '@sia.soul/sia-react-ui';
import source from './chartLargeEventRiverPlotSource.json';
const series:EventRiverSeries[]=source.groups.map(group=>({name:group.name,weight:group.weight,data:group.data.map(event=>({id:event.event_id,name:event.name,weight:event.weight,evolution:event.evolution.map(point=>({time:point.time,value:point.value}))}))}));
export function LargeEventRiverReferencePreview(){return <div className="chart-large-event-river-reference">
 <EventRiverChart title="Event River" description="纯属虚构" appearance="macarons" viewBoxSize={[1015,628]} height={628} plot={{x:80.5,y:60.5,width:835,height:488}} palette={['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3']} series={series} showLabels={false} tooltipProps={{enterable:true}} toolbox={{features:['mark','restore','saveAsImage']}}/>
 <p className="chart-parity__status">已接入，开发中：保留原始6系列、83事件、245时间点和完整字段，以event_id区分重名事件。1588个轮廓采样点、配色、隐藏标签和日期刻度已与原站核对；入场动画、拖动、图例还原及导出检查通过。提示布局、图例联动强调和帧级动画等尚未通过完整一致性验收。</p>
 </div>;}
