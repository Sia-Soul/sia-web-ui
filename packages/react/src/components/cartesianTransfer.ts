export interface CartesianTransferSeries {
 name:string;
 data:readonly (number|null)[];
}
export interface CartesianTransferAddress {series:number;index:number}
export interface CartesianIsland {name:string;value:number;seriesName:string}

/** Decimal-safe addition for finite chart values (including exponent notation). */
function addValues(a:number,b:number):number {
 const parts=(value:number)=>{
  const [mantissa,exponent='0']=String(value).split('e');
  const fraction=mantissa!.split('.')[1]?.length??0;
  return {integer:BigInt(mantissa!.replace('.','')),scale:fraction-Number(exponent)};
 };
 const left=parts(a),right=parts(b),scale=Math.max(left.scale,right.scale);
 const integer=left.integer*10n**BigInt(scale-left.scale)+right.integer*10n**BigInt(scale-right.scale);
 const value=Number(`${integer}e${-scale}`);
 if(!Number.isFinite(value))throw new RangeError('合并值超出有限数值范围');
 return value;
}

/** Move a scalar, keeping the source category slot empty rather than splicing it. */
export function transferCartesianValue<T extends CartesianTransferSeries>(
 series:readonly T[],source:CartesianTransferAddress,target:CartesianTransferAddress|null,categories:readonly string[],
):{series:(Omit<T,'data'>&{data:(number|null)[]})[];island?:CartesianIsland}{
 const get=(address:CartesianTransferAddress)=>{
  if(!Number.isInteger(address.series)||!Number.isInteger(address.index)||address.series<0||address.index<0||address.series>=series.length||address.index>=series[address.series]!.data.length)throw new RangeError('数据位置不存在');
  return series[address.series]!.data[address.index]!;
 };
 const value=get(source);
 if(value===null||!Number.isFinite(value))throw new RangeError('空数据不能拖出');
 const destination=target?get(target):null;
 if(destination!==null&&!Number.isFinite(destination))throw new RangeError('目标数据不是有限数字');
 const next=series.map(item=>({...item,data:[...item.data]}));
 if(target?.series===source.series&&target.index===source.index)return {series:next};
 // Calculate before changing either cell so overflow cannot partially mutate a result.
 const merged=target?(destination===null?value:addValues(destination,value)):undefined;
 next[source.series]!.data[source.index]=null;
 if(target){
  next[target.series]!.data[target.index]=merged!;
  return {series:next};
 }
 return {series:next,island:{name:categories[source.index]?.trim()??String(source.index),value,seriesName:series[source.series]!.name}};
}
