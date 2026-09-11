export interface ChartViewportTransform {x:number;y:number;scale:number}
export interface ChartScaleLimit {min?:number;max?:number}
/** Zoom around a plot-space cursor so the data point beneath it stays fixed. */
export function zoomChartViewport(view:ChartViewportTransform,factor:number,point:readonly [number,number],limit:ChartScaleLimit|null={min:.05,max:20}):ChartViewportTransform {
 if(!Number.isFinite(factor)||factor<=0||!point.every(Number.isFinite))return view;
 const min=limit?.min??0,max=limit?.max??Infinity;
 if(!Number.isFinite(min)||min<0||Number.isNaN(max)||max<=0||min>max)return view;
 const scale=Math.max(min,Math.min(max,view.scale*factor)),ratio=scale/view.scale;
 const next={scale,x:point[0]-(point[0]-view.x)*ratio,y:point[1]-(point[1]-view.y)*ratio};
 return scale>0&&Object.values(next).every(Number.isFinite)?next:view;
}
