import type {CSSProperties} from 'react';

/** Per-region overrides are resolved independently for normal and emphasized states. */
export interface MapRegionAppearance {
  /** 地图区域样式。 */
  regionStyle?: CSSProperties;
  /** 地图区域高亮样式。 */
  emphasisRegionStyle?: CSSProperties;
  /** 标签文字样式。 */
  labelStyle?: CSSProperties;
  /** 高亮状态的标签样式。 */
  emphasisLabelStyle?: CSSProperties;
  /** 是否显示数据标签。 */
  showLabels?: boolean;
  /** 高亮时是否显示标签集合。 */
  showEmphasisLabels?: boolean;
}

export function resolveMapRegionAppearance(base: MapRegionAppearance, datum: MapRegionAppearance | undefined, emphasized: boolean): {regionStyle:CSSProperties;labelStyle:CSSProperties;showLabel:boolean} {
  return {
    regionStyle: {...base.regionStyle, ...datum?.regionStyle, ...(emphasized ? {...base.emphasisRegionStyle, ...datum?.emphasisRegionStyle} : {})},
    labelStyle: {...base.labelStyle, ...datum?.labelStyle, ...(emphasized ? {...base.emphasisLabelStyle, ...datum?.emphasisLabelStyle} : {})},
    showLabel: emphasized
      ? datum?.showEmphasisLabels ?? ((datum?.showLabels ?? base.showLabels ?? false) || (base.showEmphasisLabels ?? false))
      : datum?.showLabels ?? base.showLabels ?? false,
  };
}
