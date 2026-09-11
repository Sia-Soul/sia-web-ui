import {useEffect,useState} from 'react';
import type {SiaChartProps} from './Chart';
import {changeCartesianMagic} from './cartesianMagicState';
import type {CartesianMagicState} from './cartesianMagicState';
export function useBarMagicState(toolbox:SiaChartProps['toolbox'],shape:CartesianMagicState['shape']='bar'){
 const initial:CartesianMagicState={shape,layout:'original'};
 const options=toolbox===true?{}:typeof toolbox==='object'?toolbox:undefined;
 const [state,setState]=useState(()=>changeCartesianMagic(initial,options?.activeMagicType??shape));
 useEffect(()=>{if(options?.activeMagicType)setState(s=>changeCartesianMagic(s,options.activeMagicType!));},[options?.activeMagicType]);
 const resolved=options?{...options,activeMagicType:state.shape,activeMagicTypes:options.activeMagicTypes??(state.layout==='original'?[state.shape]:[state.shape,state.layout]),onMagicTypeChange:(action:string)=>{setState(s=>changeCartesianMagic(s,action));options.onMagicTypeChange?.(action);},onRestore:()=>{setState(initial);options.onRestore?.();}}:toolbox;
 return [state,resolved] as const;
}
