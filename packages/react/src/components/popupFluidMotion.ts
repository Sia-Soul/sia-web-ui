/** 下拉面板果冻弹性展开的完整时长，单位毫秒。 */
export const popupEnterDuration = 260;
/** 下拉面板缩小淡出的完整时长，单位毫秒。 */
export const popupExitDuration = 140;
/** 入场与退场收起端的缩放比例，无单位；中途反向据此计算剩余距离。 */
export const popupInitialScale = .88;
/** 收起端向触发器靠近的距离，单位 CSS px；用于轻微滑入与反向衔接。 */
export const popupTravelOffset = 6;

/** 缩放淡入、弹大回收后归位；关闭直接缩小淡出，圆角、边框与阴影沿用组件样式。 */
export function popupFluidFrames(placement: string, open = true): Keyframe[] {
  const side = placement.split("-")[0];
  const axis = side === "left" || side === "right" ? "X" : "Y";
  const sign = side === "left" || side === "top" ? 1 : -1;
  const hidden = { opacity: 0, transform: `translate${axis}(${sign * popupTravelOffset}px) scale(${popupInitialScale})` };
  const visible = { opacity: 1, transform: "none" };
  // 沿用小浮层的果冻形变：先弹大、再回收、最后归位，不包含整体下沉的预备阶段。
  return open ? [
    { ...hidden, offset: 0 },
    { opacity: 1, transform: "scale(1.11, 1.085)", offset: .68 },
    { opacity: 1, transform: "scale(.945, .965)", offset: .86 },
    { ...visible, offset: 1 },
  ] : [{ ...visible, offset: 0 }, { ...hidden, offset: 1 }];
}
