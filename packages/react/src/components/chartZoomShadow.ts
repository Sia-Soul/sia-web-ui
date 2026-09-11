/** Zoom overview polygon in local coordinates, using a ten-unit baseline inset. */
export function chartZoomShadow(values:readonly number[],width:number,height:number):Array<readonly [number,number]>{
 if(!values.length||width<=0||height<=0)return [];
 const data=values.map(value=>Number.isFinite(value)?value:0),min=Math.min(...data),span=Math.max(...data)-min;
 const spacing=width/Math.max(1,data.length-1),step=spacing<1?Math.max(1,Math.floor(data.length*3/width)):1;
 const points:Array<readonly [number,number]>=[];
 for(let i=0;i<data.length;i+=step)points.push([spacing*i,height-1-Math.round((span?(data[i]!-min)/span:0)*Math.max(0,height-10))]);
 points.push([width,height],[0,height]);return points;
}
