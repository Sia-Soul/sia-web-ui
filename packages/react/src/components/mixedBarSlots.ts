export interface MixedBarSpacing {
  /** Fraction of each category band reserved between category groups. */
  categoryGap: number;
  /** Gap between series, as a fraction of the automatic bar width. */
  seriesGap: number;
  /** Use two-decimal layout measurements and integer rectangle bounds. */
  pixelAlign?: boolean;
}

/** Resolve actual visible stack groups on every render, including legend and magic-type changes. */
export function mixedBarSlots(band:number, explicitWidths:readonly (number|undefined)[], spacing:MixedBarSpacing) {
  const count=explicitWidths.length;
  if(!count)return [];
  const round=(value:number)=>spacing.pixelAlign?Number(value.toFixed(2)):value;
  const occupied=round(band*(1-Math.min(.95,Math.max(0,spacing.categoryGap))));
  const fixed=explicitWidths.reduce<number>((sum,width)=>sum+(width??0),0);
  const flexible=explicitWidths.filter(width=>width===undefined).length;
  const ratio=Math.max(0,spacing.seriesGap);
  const unit=flexible?round((occupied-fixed)/(flexible+(count-1)*ratio)):0;
  const gap=flexible?unit*ratio:count>1?round((occupied-fixed)/(count-1)):0;
  if(unit<0||gap<0){
    const width=round(band/count);
    return explicitWidths.map((_,index)=>({offset:index*width,width}));
  }
  // A sole explicit-width bar is centered independently of category spacing.
  let offset=(band-(!flexible&&count===1?fixed:occupied))/2;
  return explicitWidths.map(width=>{
    const slot={offset,width:Math.max(0,width??unit)};
    offset+=slot.width+gap;
    return slot;
  });
}
