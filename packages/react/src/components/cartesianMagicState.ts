export interface CartesianMagicState {shape:'line'|'bar';layout:'original'|'stack'|'tiled'}
export function changeCartesianMagic(state:CartesianMagicState,action:string):CartesianMagicState {
 if(action==='line'||action==='折线'||action==='折线图')return {...state,shape:'line'};
 if(action==='bar'||action==='柱状'||action==='柱状图')return {...state,shape:'bar'};
 if(action==='stack'||action==='堆积')return {...state,layout:'stack'};
 if(action==='tiled'||action==='平铺')return {...state,layout:'tiled'};
 return state;
}
