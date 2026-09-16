import {transferCartesianValue} from './cartesianTransfer';

/** 图表中可转移数据值的定位信息。 */
export interface ChartValueAddress {
  /** 关联的图表实例或配置。 */
  chart:string;
  /** 图表数据系列。 */
  series:number;
  /** 项目在当前集合中的索引，从 0 开始。 */
  index:number}
/** 图表之间转移数据值的处理函数。 */
export type ChartValueTransferHandler=(source:ChartValueAddress,target:ChartValueAddress)=>boolean;
/** 组合图表参与数据转移的通信通道。 */
export interface ChartValueChannel {
  /** 唯一标识，用于关联实例或插件。 */
  id:string;
  /** 图表数据系列。 */
  series:readonly {
  /** 名称或字段标识。 */
  name:string;
  /** 用于渲染的数据集合。 */
  data:readonly (number|null)[]}[];
  /** 是否将数据值限制为非负数。 */
  nonNegative?:boolean}

/** Validate and calculate both sides before publishing either chart's new state. */
export function transferCompositeValue(channels:readonly ChartValueChannel[],source:ChartValueAddress,target:ChartValueAddress){
 if(new Set(channels.map(channel=>channel.id)).size!==channels.length)throw new RangeError('图表标识不能重复');
 const address=(value:ChartValueAddress)=>{
  const channel=channels.findIndex(item=>item.id===value.chart);
  if(channel<0||!Number.isInteger(value.series)||value.series<0||value.series>=channels[channel]!.series.length)throw new RangeError('图表或系列不存在');
  return {series:channels.slice(0,channel).reduce((sum,item)=>sum+item.series.length,0)+value.series,index:value.index};
 };
 const result=transferCartesianValue(channels.flatMap(channel=>channel.series),address(source),address(target),[]);
 let offset=0;
 return channels.map(channel=>{
  const series=result.series.slice(offset,offset+channel.series.length);offset+=channel.series.length;
  if(channel.nonNegative&&series.some(item=>item.data.some(value=>value!==null&&value<0)))throw new RangeError('目标图表不接受负数');
  return {...channel,series};
 });
}

/** A drop must remain in the same explicit ChartComposite, never another gallery card. */
export function findCompositeValueTarget(element:SVGGElement,x:number,y:number):ChartValueAddress|null {
 const host=element.closest('.sia-chart-composite');if(!host)return null;
 const hit=document.elementsFromPoint(x,y).map(node=>node.closest('[data-value-chart]')).find(node=>node&&node!==element&&node.closest('.sia-chart-composite')===host);
 if(!hit)return null;
 const series=Number(hit.getAttribute('data-value-series')),index=Number(hit.getAttribute('data-value-index'));
 if(!Number.isInteger(series)||series<0||!Number.isInteger(index)||index<0)return null;
 return {chart:hit.getAttribute('data-value-chart')!,series,index};
}
