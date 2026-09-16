/** 特殊地理区域的独立位置和缩放配置。 */
export type MapSpecialArea = {
  /** 距左侧的位置或间距。 */
  left:number;
  /** 距顶部的位置或间距。 */
  top:number;
  /** 宽度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  width:number;
  /** 高度；数值按像素处理，字符串可使用 CSS 尺寸。 */
  height:number};
type Point=readonly [number,number];
/** A detached region retains its own aspect ratio and is anchored at the target's top left. */
export function createSpecialAreaProjection(points:readonly Point[],area:MapSpecialArea,project:(point:Point)=>Point,longitudeRatio=.75){
 if(!points.length||![area.left,area.top,area.width,area.height,longitudeRatio].every(Number.isFinite)||area.width<=0||area.height<=0||longitudeRatio<=0)throw new RangeError('特殊地图区域的位置与尺寸必须有效');
 const normalize=(point:Point):Point=>[point[0]<-168.5&&point[1]>63.8?point[0]+360:point[0],-point[1]];
 const normalized=points.map(normalize);
 const minX=Math.min(...normalized.map(p=>p[0])),minY=Math.min(...normalized.map(p=>p[1]));
 const dx=Math.max(1e-9,Math.max(...normalized.map(p=>p[0]))-minX),dy=Math.max(1e-9,Math.max(...normalized.map(p=>p[1]))-minY);
 const origin=project([area.left,area.top]),end=project([area.left+area.width,area.top+area.height]);
 const scale=Math.min(Math.abs(end[0]-origin[0])/(dx*longitudeRatio),Math.abs(end[1]-origin[1])/dy);
 return (point:Point):Point=>{const p=normalize(point);return [origin[0]+(p[0]-minX)*scale*longitudeRatio,origin[1]+(p[1]-minY)*scale];};
}
