/** 树图节点及连线的显示样式。 */
export interface TreeItemStyle {
 /** 显示颜色，可使用 CSS 颜色值。 */
 color?:string;
 /** 边框颜色。 */
 borderColor?:string;
 /** 边框线宽。 */
 borderWidth?:number;
 /** 框选工具的选择形状或方式。 */
 brushType?:'fill'|'stroke'|'both';
 /** 展示给用户的名称，可传入文本或 React 节点。 */
 label?:{
  /** 是否显示该功能。 */
  show?:boolean;
  /** 显示位置或定位配置。 */
  position?:'inside'|'right'|'left'|'top'|'bottom';
  /** 将原始值转换为展示文本的函数。 */
  formatter?:string;
  /** 显示颜色，可使用 CSS 颜色值。 */
  color?:string;
  /** 文字大小，单位为像素。 */
  fontSize?:number;
  /** 文字粗细，可使用数字或 CSS 字重名称。 */
  fontWeight?:string|number};
}
/** Merge emphasis over normal without dropping inherited label fields. */
export function resolveTreeItemStyle(series:TreeItemStyle|undefined,node:TreeItemStyle|undefined,seriesEmphasis:TreeItemStyle|undefined,nodeEmphasis:TreeItemStyle|undefined,active:boolean):TreeItemStyle {
 const layers=active?[series,node,seriesEmphasis,nodeEmphasis]:[series,node];
 return layers.reduce<TreeItemStyle>((result,layer)=>({...result,...layer,label:{...result.label,...layer?.label}}),{});
}
