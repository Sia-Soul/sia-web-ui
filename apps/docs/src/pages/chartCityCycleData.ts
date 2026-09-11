import source from './chartCityCycleSource.json';
export const cityCycleEntries=Object.entries(source[0]!.bindings.cityMap);
/** Positive DOM deltaY advances; the source wheelDelta uses the opposite sign. */
export function cityCycleNext(index:number,delta:number){
 if(!Number.isInteger(index)||index<0||index>=cityCycleEntries.length)throw new RangeError('无效城市索引');
 if(!Number.isFinite(delta)||delta===0)return index;
 return (index+(delta<0?-1:1)+cityCycleEntries.length)%cityCycleEntries.length;
}
