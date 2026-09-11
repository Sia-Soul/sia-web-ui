import type {CSSProperties} from 'react';

/** Per-region overrides are resolved independently for normal and emphasized states. */
export interface MapRegionAppearance {
  regionStyle?: CSSProperties;
  emphasisRegionStyle?: CSSProperties;
  labelStyle?: CSSProperties;
  emphasisLabelStyle?: CSSProperties;
  showLabels?: boolean;
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
