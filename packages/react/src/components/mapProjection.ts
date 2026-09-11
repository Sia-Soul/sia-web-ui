export function fitMapBounds(bounds:{minX:number;maxX:number;minY:number;maxY:number},plot:{x:number;y:number;width:number;height:number},longitudeRatio:number){
 if(!Number.isFinite(longitudeRatio)||longitudeRatio<=0)throw new RangeError('地图经纬缩放比例必须为正数');
 const dx=Math.max(1e-9,bounds.maxX-bounds.minX),dy=Math.max(1e-9,bounds.maxY-bounds.minY);
 const scale=Math.min(plot.width/(dx*longitudeRatio),plot.height/dy);
 const width=dx*scale*longitudeRatio,height=dy*scale;
 return {x:plot.x+(plot.width-width)/2,y:plot.y+(plot.height-height)/2,width,height};
}
