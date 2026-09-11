/** Original point-effect timing: each mounted effect samples once, in milliseconds. */
export function mapPointPulseDuration(period:number,random:()=>number=Math.random):number {
 return 100*(period+10*random());
}
