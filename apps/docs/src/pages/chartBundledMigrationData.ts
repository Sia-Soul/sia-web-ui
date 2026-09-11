import source from './chartBundledMigrationSource.json';
import raw from './chartBundledMigrationData.json';
type Point=readonly [number,number];
const coordinates=source[0]!.bindings.geoCoord as Record<string,number[]>;
/** Original names may contain province prefixes; the final segment is the lookup key. */
export function bundledMigrationCoordinate(name:string):Point {
 const city=name.split('_').at(-1)!,point=coordinates[city];
 if(!point||point.length!==2||!point.every(Number.isFinite))throw new Error(`缺少原始城市坐标：${name}`);
 return [point[0]!,point[1]!];
}
export function createBundledMigrationData(){
 // Stable descending order retains the original order among equal flows; never mutate the source.
 const lines=raw.allLine.map((line,index)=>({...line,index})).sort((a,b)=>b.num-a.num||a.index-b.index).slice(0,3000).map(line=>({id:line.index,from:line.start,to:line.end,value:line.num,singleNum:line.singleNum,source:bundledMigrationCoordinate(line.start),target:bundledMigrationCoordinate(line.end)}));
 const points=raw.topCityOut.map(point=>({name:point.name,coordinate:bundledMigrationCoordinate(point.name)}));
 return {lines,points};
}
