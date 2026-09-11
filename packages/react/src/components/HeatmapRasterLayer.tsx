import {useEffect,useState} from 'react';
import {rasterizeHeatmap} from './heatmapRaster';
import type {RasterHeatPoint,HeatRasterOptions} from './heatmapRaster';
export function HeatmapRaster({width,height,points,options}:{width:number;height:number;points:readonly RasterHeatPoint[];options:HeatRasterOptions}){
 const [url,setUrl]=useState<string>();
 const optionsKey=JSON.stringify(options);
 useEffect(()=>{
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)return;
  const frame=context.createImageData(width,height);
  frame.data.set(rasterizeHeatmap(width,height,points,JSON.parse(optionsKey)));
  context.putImageData(frame,0,0);setUrl(canvas.toDataURL('image/png'));
 },[width,height,points,optionsKey]);
 return url?<image data-heat-point-count={points.length} href={url} x={0} y={0} width={width} height={height} pointerEvents="none"/>:null;
}
