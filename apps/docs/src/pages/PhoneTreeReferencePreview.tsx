import {useState} from 'react';
import {Button,TreeChart} from '@sia-ui/react';
import type {TreeDatum,TreeChartProps} from '@sia-ui/react';
import source from './chartPhoneTreeSource.json';
type Style=NonNullable<TreeChartProps['itemStyle']>;
type OriginalStyle=Omit<Style,'label'>&{label?:Omit<NonNullable<Style['label']>,'color'|'fontSize'|'fontWeight'>&{textStyle?:{color?:string;fontSize?:number;fontWeight?:string}}};
interface SourceNode {name:string;value:number;symbol?:string;symbolSize?:number|number[];itemStyle?:{normal?:OriginalStyle;emphasis?:OriginalStyle};children?:SourceNode[]}
const normalize=(style?:OriginalStyle):Style|undefined=>style?{...style,label:style.label?{...style.label,...style.label.textStyle}:undefined}:undefined;
const mapNode=(node:SourceNode):TreeDatum=>{const symbol=node.symbol;if(symbol&&!['circle','square','diamond'].includes(symbol)&&!symbol.startsWith('image://'))throw new Error(`不支持的原始符号：${symbol}`);const size=node.symbolSize;if(Array.isArray(size)&&size.length!==2)throw new Error('原始图片尺寸必须有宽高两项');return {name:node.name,value:node.value,symbol:symbol as TreeDatum['symbol'],symbolSize:Array.isArray(size)?[size[0]!,size[1]!]:size,itemStyle:normalize(node.itemStyle?.normal),emphasis:normalize(node.itemStyle?.emphasis),children:node.children?.map(mapNode)};};
const option=source[0]!.option,series=option.series[0]!;
export const phoneTreeData=mapNode(series.data[0] as SourceNode);
export function PhoneTreeReferencePreview(){const [replay,setReplay]=useState(0);return <div className="chart-phone-tree">
 <Button onClick={()=>setReplay(value=>value+1)}>重播入场动画</Button>
 <TreeChart key={replay} width={995} height={378} viewBoxSize={[995,378]} title={option.title.text} description={option.title.subtext} data={phoneTreeData} rootPosition={[100,378*.6]} orientation="horizontal" nodeSize={40} nodePadding={20} itemStyle={normalize(series.itemStyle.normal as OriginalStyle)} emphasis={normalize(series.itemStyle.emphasis as OriginalStyle)} linkStyle="broken" edgeColor="#000" edgeWidth={1} toolbox={{features:['mark','dataView','restore','saveAsImage']}}/>
 <p className="chart-parity__status">准备中，未注册：8节点中心和尺寸已与原站匹配。原始5张外链图片本次核查全部加载失败（域名解析失败、404或连接中断），图片失败提示不代表对应图片已实现；仍待原图恢复、工具箱和动画验收，不计入已接入数量。</p>
 </div>;}
