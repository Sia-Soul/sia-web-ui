import {layoutBarValues} from './barLayout.ts';
import type {BarLayoutSeries} from './barLayout.ts';

/** Layout-only overrides preserve series identities and their original stack configuration. */
export function barMagicLayout(series:readonly BarLayoutSeries[],categoryCount:number,mode:string,stacked=false){
 if(mode==='stack'||mode==='堆积')return layoutBarValues(series,categoryCount,true);
 if(mode==='tiled'||mode==='平铺')return layoutBarValues(series.map(s=>({...s,stack:undefined,overlayGroup:undefined})),categoryCount,false);
 return layoutBarValues(series,categoryCount,stacked);
}
