import {LineChart} from '@sia-ui/react';
import source from './chartDataZoomSource.json';
const categories=source.option.xAxis[0]!.data.map(String);
const series=source.option.series.map(item=>({name:item.name,data:item.data,color:'#2ec7c9',curve:'smooth' as const,hollowSymbol:true,symbolSize:6}));
export function DataZoomReferencePreview(){return <div className="chart-datazoom-reference">
 <LineChart height={378} viewBoxSize={[995,378]} grid={{left:80.5,right:79.5,top:60.5,bottom:59.5}} zoomControlBounds={{x:80.5,y:36,width:835,height:20}} categories={categories} series={series} appearance="macarons" dataZoom zoomMinSelectionSize={[10,10]} zoomSelectionStyle={{fill:"rgba(182,162,222,0.2)",fillOpacity:1,stroke:"#008acd",strokeWidth:2}} zoomSelectionShape="rectangle" zoomPan zoomIndexMode="slice" zoomPosition="top" defaultZoom={[40,60]} showLegend={false} tooltipTrigger="axis" calculable={false} toolbox={{features:['mark','dataZoom','dataView','restore','saveAsImage'],magicTypes:['line','bar'],dataViewReadOnly:false}}/>
 <p className="chart-parity__status">开发中：保留原站一次实际运行的150个随机数据值及完整生成源码；原站每次刷新会重新生成数据，此处冻结样本供重复对照。初始40%～60%显示第61～90项。已验证整体拖动、矩形框选与逐级后退、编辑/还原、柱线切换保留窗口、缩放条位置及152个阴影顶点。已知差异：全范围下原站仅绘制30个常驻符号，本实现显示150个；手柄仍按整数百分比步进，曲线控制点、命中细节及完整动画尚未通过一致性验收。</p>
</div>;}
