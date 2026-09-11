import type {HeatmapPoint} from '@sia-ui/react';
/** Three distinct source regions, with unrounded floating point coordinates/weights. */
export function createReferenceHeatData(seed:number):HeatmapPoint[]{
 let state=seed>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const points:HeatmapPoint[]=[];
 for(let i=0;i<20;i++)points.push({x:400+random()*300,y:5+random()*10,value:random()});
 for(let i=0;i<100;i++)points.push({x:100+random()*600,y:150+random()*50,value:random()});
 for(let i=0;i<200;i++)points.push({x:random()*1000,y:random()*800,value:random()*.5});
 return points;
}
export const customHeatGradient=[{offset:.4,color:[0,128,0] as const},{offset:.5,color:[255,255,0] as const},{offset:.8,color:[255,165,0] as const},{offset:1,color:[255,0,0] as const}];
