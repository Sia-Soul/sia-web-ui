export interface RasterHeatPoint {x:number;y:number;value:number;}
export interface HeatGradientStop {offset:number;color:readonly [number,number,number];}
export interface HeatRasterOptions {
 radius?:number;
 blur?:number;
 minAlpha?:number;
 valueScale?:number;
 opacity?:number;
 gradient?:readonly HeatGradientStop[];
}
const defaultGradient:readonly HeatGradientStop[]=[{offset:.2,color:[0,0,255]},{offset:.4,color:[0,255,255]},{offset:.6,color:[0,255,0]},{offset:.8,color:[255,255,0]},{offset:1,color:[255,0,0]}];
/** Accumulate a scalar field first, then colorize; overlapping colors never mix directly. */
export function rasterizeHeatmap(width:number,height:number,points:readonly RasterHeatPoint[],options:HeatRasterOptions={}){
 const w=Math.max(0,Math.floor(width)),h=Math.max(0,Math.floor(height));
 const field=new Float32Array(w*h),pixels=new Uint8ClampedArray(w*h*4);
 const radius=Math.max(0,options.radius??20),blur=Math.max(.01,options.blur??30),extent=Math.ceil(radius+blur);
 // Integrate a Gaussian over a disk, instead of giving every disk pixel full opacity.
 const sigma=blur/2,step=Math.max(1,radius/5),samples:{x:number;y:number}[]=[];
 if(radius>0)for(let y=-radius+step/2;y<radius;y+=step)for(let x=-radius+step/2;x<radius;x+=step)if(x*x+y*y<=radius*radius)samples.push({x,y});
 const kernel=Array.from({length:extent*2+1},(_,i)=>{
  const distance=i/2;
  if(!samples.length)return Math.exp(-2*distance*distance/(blur*blur));
  return Math.min(1,samples.reduce((sum,p)=>sum+Math.exp(-((distance-p.x)**2+p.y*p.y)/(2*sigma*sigma)),0)*step*step/(2*Math.PI*sigma*sigma));
 });
 const minAlpha=Math.max(0,Math.min(1,options.minAlpha??.05));
 const opacity=Math.max(0,Math.min(1,options.opacity??1)),scale=Math.max(0,options.valueScale??1);
 const stops=[...(options.gradient?.length?options.gradient:defaultGradient)].sort((a,b)=>a.offset-b.offset);
 for(const point of points){
  if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.value))continue;
  const alpha=Math.max(minAlpha,Math.min(1,point.value*scale));
  for(let y=Math.max(0,Math.floor(point.y-extent));y<Math.min(h,Math.ceil(point.y+extent));y++)for(let x=Math.max(0,Math.floor(point.x-extent));x<Math.min(w,Math.ceil(point.x+extent));x++){
   const distance=Math.hypot(x+.5-point.x,y+.5-point.y);
   if(distance>extent)continue;
   const weight=alpha*kernel[Math.min(kernel.length-1,Math.round(distance*2))]!;
   const index=y*w+x;field[index]=1-(1-field[index]!)*(1-weight);
  }
 }
 for(let i=0;i<field.length;i++){
  const strength=field[i]!;if(strength<=0)continue;
  let right=stops.findIndex(stop=>stop.offset>=strength);if(right<0)right=stops.length-1;
  const b=stops[right]!,a=stops[Math.max(0,right-1)]!;
  const t=Math.max(0,Math.min(1,(strength-a.offset)/(b.offset-a.offset||1)));
  for(let c=0;c<3;c++)pixels[i*4+c]=a.color[c]!+(b.color[c]!-a.color[c]!)*t;
  pixels[i*4+3]=Math.round(strength*opacity*255);
 }
 return pixels;
}
