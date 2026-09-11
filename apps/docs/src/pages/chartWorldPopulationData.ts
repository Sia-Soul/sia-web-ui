import source from './chartWorldPopulationSource.json';
export const worldPopulationData=source[0]!.option.series[0]!.data;
/** Reproduce the original formatter, including its integer/missing decimal suffix. */
export function formatWorldPopulation(value:number|string){
 const parts=String(value).split('.');
 return parts[0]!.replace(/(\d{1,3})(?=(?:\d{3})+(?!\d))/g,'$1,')+'.'+parts[1];
}
