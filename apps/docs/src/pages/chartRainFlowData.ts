import type {MixedSeries} from '@sia-ui/react';
import source from './chartRainFlowSource.json';
import rainfall from './chartRainFlowRainfall.json';
export const rainFlowOption=source[0]!.option;
export const rainFlowCategories=rainFlowOption.xAxis[0]!.data;
// The original IIFE negates numeric literals; no source JavaScript is executed here.
export const rainFlowSeries:MixedSeries[]=[
 {name:'流量',type:'line',sampling:'pixel',area:true,areaOpacity:.5,showPoints:false,color:'#2ec7c9',data:rainFlowOption.series[0]!.data as number[]},
 {name:'降雨量',type:'line',sampling:'pixel',area:true,areaOpacity:.5,showPoints:false,color:'#b6a2de',valueAxisIndex:1,data:rainfall.map(value=>-value)},
];
