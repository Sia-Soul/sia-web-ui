import source from './chartMapSwitchSource.json';

export const mapSwitchTypes:readonly string[]=source[0]!.bindings.mapType;
/** One initialization only; navigation must retain this array and its values. */
export function createMapSwitchValues(random:()=>number=Math.random){
 return source[0]!.option.series[0]!.data.map(item=>{
  const value=random();
  if(!Number.isFinite(value)||value<0||value>=1)throw new Error('随机数必须在[0,1)范围内');
  return {name:item.name,value:Math.round(value*1000)};
 });
}
/** DOM wheel deltaY is opposite to the original wheelDelta sign. */
export function wheelMapSwitchIndex(index:number,deltaY:number){
 if(!Number.isFinite(deltaY)||deltaY===0)return index;
 return (index+(deltaY<0?-1:1)+mapSwitchTypes.length)%mapSwitchTypes.length;
}
export function clickMapSwitchIndex(index:number,name:string){
 if(index!==0)return 0;
 const found=mapSwitchTypes.indexOf(name);
 return found<0?index:found;
}
