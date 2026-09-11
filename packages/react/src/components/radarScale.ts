/** Normalize within each indicator's own domain, including decimal and negative axes. */
export function radarRatio(value:number|undefined,minimum:number,maximum:number){
 if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||maximum<=minimum)return 0;
 const actual=value===undefined?minimum:value;
 if(!Number.isFinite(actual))return 0;
 return Math.max(0,Math.min(1,(actual-minimum)/(maximum-minimum)));
}

/** Raw bounds before tick rounding. Preserve legacy polar's single-series cross-axis rule. */
export function radarDataBounds(series:readonly (readonly number[])[],indicatorIndex:number,options:{levels?:number;boundaryGap?:readonly [number,number];scale?:boolean}={}){
 const levels=Math.max(1,options.levels??5),gap=options.boundaryGap??[0,0];
 const values=(series.length===1?series[0]!:series.map(data=>data[indicatorIndex]!)).filter(Number.isFinite);
 if(!values.length)return {min:0,max:1};
 let min=series.length===1?Math.min(0,...values):Math.min(...values),max=Math.max(...values);
 const span=Math.abs(max-min);min-=Math.abs(span*gap[0]);max+=Math.abs(span*gap[1]);
 if(min===max){if(max===0)max=1;else if(max>0)min=max/levels;else max/=levels;}
 if(!options.scale){if(min>=0&&max>=0)min=0;else if(min<=0&&max<=0)max=0;}
 return {min,max};
}

/** Explicit-division nice ticks. Does not implement legacy automatic split-count selection. */
export function radarNiceTicks(minimum:number,maximum:number,divisions=5){
 if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||maximum<=minimum)throw new RangeError('Radar tick domain must be finite and increasing');
 if(!Number.isInteger(divisions)||divisions<1||divisions>100)throw new RangeError('Radar divisions must be an integer within [1, 100]');
 const span=maximum-minimum;
 if(!Number.isFinite(span)||span/divisions===0)throw new RangeError('Radar tick span exceeds supported numeric precision');
 let min:number,max:number,step:number;
 if(Number.isInteger(minimum)&&Number.isInteger(maximum)&&span<divisions){
  min=Math.round(minimum-(divisions-span)/2);max=min+divisions;step=1;
 }else{
  const rawStep=span/divisions,exponent=Math.floor(Math.log10(rawStep)),unit=10**exponent;
  const normalized=rawStep/unit;
  step=([1,2,2.5,5,10].find(value=>value>=normalized-1e-12)??10)*unit;
  max=Math.ceil(maximum/step-1e-12)*step;min=max-step*divisions;
  // Alignment can require the next preferred step even when the raw span fits.
  while(min>minimum+Math.abs(step)*1e-10){
   const scale=10**Math.floor(Math.log10(step)),ratio=step/scale;
   step=([1,2,2.5,5,10].find(value=>value>ratio+1e-12)??10)*scale;
   max=Math.ceil(maximum/step-1e-12)*step;min=max-step*divisions;
  }
  const imbalance=(minimum-min)-(max-maximum);
  if(imbalance>1.1*step){const shift=Math.round(imbalance/step/2)*step;min+=shift;max+=shift;}
 }
 if(minimum>=0&&min<0){max-=min;min=0;}
 else if(maximum<=0&&max>0){min-=max;max=0;}
 const clean=(value:number)=>Number(value.toPrecision(14));
 return {min:clean(min),max:clean(max),step:clean(step),ticks:Array.from({length:divisions+1},(_,index)=>clean(min+index*step))};
}
