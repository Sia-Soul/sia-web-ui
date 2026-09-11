export interface LargeMapPlace {name:string;geoCoord:readonly number[]}
export interface LargeMapPoint {name:string;value:number;geoCoord:readonly [number,number]}
/** Original page runs these once, descending len; do not regenerate on legend/hover updates. */
export function createLargeMapPointData(places:readonly LargeMapPlace[],random:()=>number=Math.random):{name:string;size:number;symbol:'rect'|'diamond';data:LargeMapPoint[]}[]{
 if(!places.length)return [];
 const scattered=(count:number,value:number)=>Array.from({length:count},(_,i)=>{
  const len=count-1-i,place=places[len%places.length]!;
  return {name:place.name+len,value,geoCoord:[place.geoCoord[0]!+random()*5-2.5,place.geoCoord[1]!+random()*3-1.5] as const};
 });
 return [
  {name:'弱',size:2,symbol:'rect',data:scattered(3000,10)},
  {name:'中',size:3,symbol:'rect',data:scattered(1000,50)},
  {name:'强',size:6,symbol:'diamond',data:[...places].reverse().map(place=>({name:place.name,value:90,geoCoord:[place.geoCoord[0]!,place.geoCoord[1]!] as const}))},
 ];
}
