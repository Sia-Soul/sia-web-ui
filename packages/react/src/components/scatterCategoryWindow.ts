/** Category windows are based on the axis, never on the count of visible series. */
export function scatterCategoryWindow(categories:readonly number[],zoom:readonly [number,number]){
 if(!categories.length)return [];
 const low=Math.max(0,Math.min(100,Math.min(...zoom))),high=Math.max(0,Math.min(100,Math.max(...zoom)));
 const start=Math.min(categories.length-1,Math.floor(low/100*categories.length));
 const end=Math.max(start+1,Math.ceil(high/100*categories.length));
 return categories.slice(start,end);
}
