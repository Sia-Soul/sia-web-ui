/** MixedValueDomain的配置选项。 */
export interface MixedValueDomainOptions {
  /** 轴端是否保留间隔，或两端间隔的配置。 */
  boundaryGap?: readonly [number,number];
  /** 坐标轴或仪表盘的分段数量。 */
  splitNumber?: number;
  /** Select a readable step near this count without forcing exactly that many sections. */
  targetSplitNumber?: number;
  /** Positive, ascending decimal step mantissas; 10 is always available as a fallback. */
  preferredSteps?: readonly number[];
}

/** Find a compact covering domain among readable decimal steps and 4–6 automatic sections. */
export function mixedValueDomain(values:readonly number[],options:MixedValueDomainOptions={}):[number,number,number] {
  const finite=values.filter(Number.isFinite);
  let low=finite.length?Math.min(...finite):0,high=finite.length?Math.max(...finite):1;
  const span=high-low;
  low-=span*(options.boundaryGap?.[0]??0);
  high+=span*(options.boundaryGap?.[1]??0);
  low=Math.min(0,low);high=Math.max(0,high);
  if(low===high)high=low+1;
  const preferred=options.preferredSteps?.length?[...new Set([...options.preferredSteps.filter(value=>Number.isFinite(value)&&value>0&&value<=10),10])].sort((a,b)=>a-b):[1,2,2.5,5,10];
  const chooseStep=(rough:number)=>{
    const power=10**Math.floor(Math.log10(rough));
    return (preferred.find(value=>value>=rough/power)??10)*power;
  };
  const sections=options.splitNumber?[Math.max(1,Math.round(options.splitNumber))]:options.targetSplitNumber?[Math.max(1,Math.round(options.targetSplitNumber))]:[4,5,6];
  const candidates=sections.map(count=>{
    let step=chooseStep((high-low)/count),min=Math.floor(low/step)*step,max=Math.ceil(high/step)*step;
    if(options.splitNumber){
      while(max-count*step>low){step=chooseStep(step*1.001);max=Math.ceil(high/step)*step;}
      min=max-count*step;
      const imbalance=(low-min)-(max-high);
      if(imbalance>step*1.1){const shift=Math.round(imbalance/step/2)*step;min+=shift;max+=shift;}
      if(low>=0&&min<0){max-=min;min=0;}
      if(high<=0&&max>0){min-=max;max=0;}
    }
    return [min,max,step] as [number,number,number];
  });
  candidates.sort((a,b)=>(a[1]-a[0])-(b[1]-b[0])||a[2]-b[2]);
  return candidates[0]!.map(value=>Number(value.toPrecision(14))) as [number,number,number];
}
