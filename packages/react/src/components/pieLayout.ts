export interface PieLayoutOptions {
  innerRadius: number;
  outerRadius: number;
  startAngle?: number;
  clockwise?: boolean;
  padAngle?: number;
  rose?: boolean | "radius" | "area";
}

/** Angular and radial geometry only; no renderer or third-party chart dependency. */
export function layoutPieValues(values: readonly number[], options: PieLayoutOptions) {
  const safe = values.map(value=>Number.isFinite(value)?Math.max(0,value):0);
  const total = safe.reduce((sum,value)=>sum+value,0);
  const maximum = Math.max(1,...safe);
  const inner = Math.max(0,options.innerRadius);
  const outer = Math.max(inner,options.outerRadius);
  const direction = options.clockwise===false?-1:1;
  let angle = (options.startAngle??-90)*Math.PI/180;
  return safe.map(value=>{
    const fraction = total>0?value/total:0;
    const sweep = (options.rose==="area" && total>0 ? 1/safe.length : fraction)*Math.PI*2;
    const gap = Math.min(sweep*.45,Math.max(0,options.padAngle??0)*Math.PI/180);
    const start = angle+direction*gap/2;
    const end = angle+direction*(sweep-gap/2);
    angle+=direction*sweep;
    const ratio = options.rose==="area"?Math.sqrt(value/maximum):.2+.8*value/maximum;
    const radius = options.rose?inner+(outer-inner)*ratio:outer;
    return {start,end,middle:(start+end)/2,sweep,fraction,inner,radius,value};
  });
}
