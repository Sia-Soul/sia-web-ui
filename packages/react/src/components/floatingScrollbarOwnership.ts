/** 浮动滑块脱离滚动容器渲染，记录其逻辑归属以供浮层判断内部交互。 */
const targets = new Map<HTMLElement, { target: HTMLElement; dragging: boolean }>();

/** 注册浮动轨道与滚动容器的关系；返回卸载时清理关系的函数。 */
export function registerFloatingScrollbar(track: HTMLElement, target: HTMLElement) {
  targets.set(track, { target, dragging: false });
  return () => { targets.delete(track); };
}

/** 记录轨道的拖动状态，指针捕获期间即使移出浮层也保持交互归属。 */
export function setFloatingScrollbarDragging(track: HTMLElement, dragging: boolean) {
  const entry = targets.get(track);
  if (entry) entry.dragging = dragging;
}

/** 将滑块或轨道上的事件目标映射到滚动容器；其他目标保持原值。 */
export function resolveFloatingScrollbarTarget(target: EventTarget | null): EventTarget | null {
  const track = target instanceof Element ? target.closest<HTMLElement>('.sia-floating-scrollbar') : null;
  return (track && targets.get(track)?.target) || target;
}

/** 检查指定浮层内的滚动容器是否正在通过浮动轨道悬停或拖动。 */
export function hasFloatingScrollbarInteraction(container: HTMLElement | null): boolean {
  if (!container) return false;
  return [...targets].some(([track, entry]) => container.contains(entry.target)
    && (entry.dragging || track.matches(':hover')));
}
