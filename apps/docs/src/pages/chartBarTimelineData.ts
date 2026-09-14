import macro from './chartMacroTimelineData.json';
import source from './chartBarTimelineSource.json';
import type {MixedSeries} from '@sia.soul/sia-react-ui';

export const barTimelineYears=source[0]!.option.timeline.data.map(date=>date.slice(0,4));
export const barTimelineCategories=source[0]!.option.options[0]!.xAxis![0]!.data;
export const barTimelineSelected=source[0]!.option.options[0]!.legend!.selected;
const names=['GDP','金融','房地产','第一产业','第二产业','第三产业'] as const;
const keys=['dataGDP','dataFinancial','dataEstate','dataPI','dataSI','dataTI'] as const;
const colors=['#2ec7c9','#b6a2de','#5ab1ef','#ffb980','#d87a80','#8d98b3'];
/** Six raw annual series, aligned by province; no normalization between axes. */
export function barTimelineSeries(year:string):MixedSeries[]{
 if(!barTimelineYears.includes(year))throw new RangeError(`未知时间轴年份：${year}`);
 return names.map((name,index)=>({name,type:'bar',valueAxisIndex:index===0?0:1,color:colors[index],markAverage:index===0,markColor:'orange',markFormatter:Math.round,data:[...(macro.tables[keys[index]!] as Record<string,number[]>)[year]!]}));
}
