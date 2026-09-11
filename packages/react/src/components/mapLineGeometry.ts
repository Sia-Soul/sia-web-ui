type Point=readonly [number,number];
/** Direction-relative quadratic bend; reversing the route reverses its bend. */
export function mapLineControl(source:Point,target:Point,curveness:number):Point{
 return [(source[0]+target[0])/2+(target[1]-source[1])*curveness,(source[1]+target[1])/2-(target[0]-source[0])*curveness];
}
export function mapLineSample(source:Point,control:Point,target:Point,progress:number):Point{
 const t=Math.max(0,Math.min(1,progress)),u=1-t;
 return [u*u*source[0]+2*u*t*control[0]+t*t*target[0],u*u*source[1]+2*u*t*control[1]+t*t*target[1]];
}
export function mapLineDuration(source:Point,target:Point,period:number){
 return Math.max(1,Math.round(Math.sqrt(Math.round(((target[0]-source[0])**2+(target[1]-source[1])**2)*period**2))));
}
