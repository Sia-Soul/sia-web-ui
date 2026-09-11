export function barStatistics(data:readonly (number|{value:number;hidden?:boolean})[]):{average:number;min:number;max:number}|undefined {
 const values=data.filter(d=>typeof d==='number'||!d.hidden).map(d=>typeof d==='number'?d:d.value).filter(Number.isFinite);
 if(!values.length)return;
 return {average:values.reduce((sum,v)=>sum+v,0)/values.length,min:Math.min(...values),max:Math.max(...values)};
}
