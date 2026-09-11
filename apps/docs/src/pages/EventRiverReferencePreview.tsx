import {EventRiverChart} from '@sia-ui/react';
import type {EventRiverSeries} from '@sia-ui/react';
import source from './chartEventRiverSource.json';
import {personalizedLineIcon} from './chartPersonalizedLineIcon';
const option=source[0]!.option;
export const eventRiverReferenceSeries:EventRiverSeries[]=option.series.map(series=>({name:series.name,weight:series.weight,data:series.data.map(event=>({name:event.name,weight:event.weight,evolution:event.evolution.map(point=>({time:point.time,value:point.value,detail:<span><img src={personalizedLineIcon} width={20} height={20} alt="原站图标"/><a href={new URL(point.detail.link,source[0]!.url).href} target="_blank" rel="noreferrer">{point.detail.text}</a></span>}))}))}));
export function EventRiverReferencePreview(){return <div className="chart-event-river-reference">
 <EventRiverChart appearance="macarons" viewBoxSize={[1015,398]} height={398} plot={{x:80.5,y:60.5,width:835,height:258}} title={option.title.text} description={option.title.subtext} series={eventRiverReferenceSeries} tooltipProps={{enterable:true}} toolbox={{features:['mark','restore','saveAsImage']}}/>
 <p className="chart-parity__status">已接入，开发中：保留原始2系列、6事件、30时间点及权重/详情；支持权重堆叠、纵向拖动、可进入详情、日历刻度、缩放入场、更新插值与导出。原站6事件坐标、周刻度及526个轮廓采样点已核对；提示布局、图例联动强调和交互计时等仍有差异，未通过完整一致性验收。</p>
 </div>;}
