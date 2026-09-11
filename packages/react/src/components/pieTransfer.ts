export interface PieTransferDatum {name:string;value:number|'-'}
export interface PieTransferSeries {name?:string;data:readonly PieTransferDatum[]}
export interface PieTransferAddress {series:number;index:number}

/** Original pie semantics: missing source, named merge, or append into a calculable case. */
export function transferPieValue(series:readonly PieTransferSeries[],source:PieTransferAddress,target:PieTransferAddress|null,connector=' & '){
 const at=(address:PieTransferAddress,allowCase=false)=>{
  if(!Number.isInteger(address.series)||!Number.isInteger(address.index)||address.series<0||address.series>=series.length||address.index<(allowCase?-1:0)||address.index>=series[address.series]!.data.length)throw new RangeError('饼图数据位置不存在');
  return address.index===-1?undefined:series[address.series]!.data[address.index];
 };
 const origin=at(source)!;if(origin.value==='-'||!Number.isFinite(origin.value)||origin.value<0)throw new RangeError('源项必须是非负有限数值');
 const destination=target?at(target,true):undefined;
 const next=series.map(ring=>({...ring,data:ring.data.map(item=>({...item}))}));
 if(target?.series===source.series&&(target.index===source.index||target.index===-1))return {series:next};
 if(destination){
  const value=destination.value==='-'?0:destination.value;if(!Number.isFinite(value)||value<0)throw new RangeError('目标项必须是非负有限数值或缺失值');
  // Add decimal strings exactly before converting back to the numeric chart model.
  const parts=(n:number)=>{const [m,e='0']=String(n).split('e');return {integer:BigInt(m!.replace('.','')),scale:(m!.split('.')[1]?.length??0)-Number(e)};};
  const a=parts(value),b=parts(origin.value),scale=Math.max(a.scale,b.scale);
  const merged=Number(`${a.integer*10n**BigInt(scale-a.scale)+b.integer*10n**BigInt(scale-b.scale)}e${-scale}`);
  if(!Number.isFinite(merged))throw new RangeError('合并值超出有限数值范围');
  next[target!.series]!.data[target!.index]={...destination,value:merged,name:destination.name+connector+origin.name};
 }else if(target){
  const data=next[target.series]!.data,missing=data.findIndex(item=>item.name===origin.name&&item.value==='-');
  if(missing>=0)data[missing]={...data[missing]!,value:origin.value};else data.push({name:origin.name,value:origin.value});
 }
 next[source.series]!.data[source.index]!.value='-';
 return {series:next,...(!target?{island:{name:origin.name,value:origin.value,seriesName:series[source.series]!.name}}:{})};
}
