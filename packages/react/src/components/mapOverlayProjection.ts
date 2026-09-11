export type MapOverlayCoordinate = readonly [number,number];

/** Subtract the host pane offset once; the host remains responsible for its geographic projection. */
export function projectMapOverlay(
 coordinate:MapOverlayCoordinate,
 project:(coordinate:MapOverlayCoordinate)=>MapOverlayCoordinate,
 offset:MapOverlayCoordinate=[0,0],
):MapOverlayCoordinate {
 if(!coordinate.every(Number.isFinite)||!offset.every(Number.isFinite))throw new RangeError('地图叠加坐标和偏移必须为有限数值');
 const pixel=project(coordinate);
 if(!pixel.every(Number.isFinite))throw new RangeError('底图投影必须返回有限像素坐标');
 return [pixel[0]-offset[0],pixel[1]-offset[1]];
}
