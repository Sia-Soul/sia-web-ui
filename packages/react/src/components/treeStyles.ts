export interface TreeItemStyle {
 color?:string;
 borderColor?:string;
 borderWidth?:number;
 brushType?:'fill'|'stroke'|'both';
 label?:{show?:boolean;position?:'inside'|'right'|'left'|'top'|'bottom';formatter?:string;color?:string;fontSize?:number;fontWeight?:string|number};
}
/** Merge emphasis over normal without dropping inherited label fields. */
export function resolveTreeItemStyle(series:TreeItemStyle|undefined,node:TreeItemStyle|undefined,seriesEmphasis:TreeItemStyle|undefined,nodeEmphasis:TreeItemStyle|undefined,active:boolean):TreeItemStyle {
 const layers=active?[series,node,seriesEmphasis,nodeEmphasis]:[series,node];
 return layers.reduce<TreeItemStyle>((result,layer)=>({...result,...layer,label:{...result.label,...layer?.label}}),{});
}
