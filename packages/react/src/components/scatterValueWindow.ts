/** A continuous axis zoom selects a value interval, not a percentile of point count. */
export function scatterValueWindow(values:readonly number[],zoom:readonly [number,number]):[number,number]{
 const finite=values.filter(Number.isFinite);
 const min=finite.length?Math.min(...finite):0,max=finite.length?Math.max(...finite):1;
 const span=max-min||1;
 const start=Math.max(0,Math.min(100,Math.min(...zoom)))/100;
 const end=Math.max(0,Math.min(100,Math.max(...zoom)))/100;
 return [min+span*start,min+span*end];
}
