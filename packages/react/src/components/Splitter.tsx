import { Children, cloneElement, isValidElement, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";
import { Icon } from "./Icon";

export interface SplitterPanelProps extends HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  defaultCollapsed?: boolean;
  min?: number;
  max?: number;
  collapsible?: boolean;
  collapsedSize?: number;
  collapsedContent?: ReactNode;
  collapsedAriaLabel?: string;
  resizable?: boolean;
  children?: ReactNode;
}

export interface SplitterProps extends Omit<HTMLAttributes<HTMLDivElement>, "onResize"> {
  orientation?: "horizontal" | "vertical";
  onResize?: (sizes: readonly number[]) => void;
  onResizeEnd?: (sizes: readonly number[]) => void;
}

function SplitterPanel({
    defaultSize: _defaultSize,
    defaultCollapsed: _defaultCollapsed,
  min: _min,
  max: _max,
  collapsible: _collapsible,
  collapsedSize: _collapsedSize,
  collapsedContent: _collapsedContent,
  collapsedAriaLabel: _collapsedAriaLabel,
  resizable: _resizable,
  className = "",
  ...props
}: SplitterPanelProps) {
  return <div className={`sia-splitter__panel ${className}`.trim()} {...props} />;
}

function normalizeExpandedSizes(panels: readonly ReactElement<SplitterPanelProps>[]) {
  const specified = panels.map((panel) => panel.props.defaultSize);
  const totalSpecified = specified.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const unspecified = specified.filter((value) => value === undefined).length;
  const remaining = Math.max(0, 100 - totalSpecified);
  return specified.map((value) => value ?? (unspecified ? remaining / unspecified : 0));
}

function normalizeSizes(panels: readonly ReactElement<SplitterPanelProps>[]) {
  const next = normalizeExpandedSizes(panels);
  panels.forEach((panel, index) => {
    if (!panel.props.defaultCollapsed) return;
    const targetSize = collapsedSize(panel);
    const released = next[index] - targetSize;
    const sibling = index < panels.length - 1 ? index + 1 : index - 1;
    next[index] = targetSize;
    if (sibling >= 0) next[sibling] += released;
  });
  return next;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function collapsedSize(panel?: ReactElement<SplitterPanelProps>) {
  return panel?.props.collapsedSize ?? 0;
}

function SplitterRoot({
  orientation = "horizontal",
  onResize,
  onResizeEnd,
  className = "",
  children,
  ...props
}: SplitterProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panels = useMemo(() => Children.toArray(children).filter(isValidElement) as ReactElement<SplitterPanelProps>[], [children]);
  const [sizes, setSizes] = useState(() => normalizeSizes(panels));
  const expandedSizesRef = useRef(normalizeExpandedSizes(panels));

  function resizePair(index: number, deltaPercent: number, complete = false) {
    setSizes((current) => {
      const next = [...current];
      const first = panels[index]?.props;
      const second = panels[index + 1]?.props;
      const pairTotal = current[index] + current[index + 1];
      const firstSize = clamp(current[index] + deltaPercent, first?.min, Math.min(first?.max ?? 100, pairTotal - (second?.min ?? 0)));
      const secondSize = pairTotal - firstSize;
      next[index] = firstSize;
      next[index + 1] = secondSize;
      if (firstSize > (first?.min ?? 0)) expandedSizesRef.current[index] = firstSize;
      if (secondSize > (second?.min ?? 0)) expandedSizesRef.current[index + 1] = secondSize;
      onResize?.(next);
      if (complete) onResizeEnd?.(next);
      return next;
    });
  }

  function startResize(index: number, event: MouseEvent<HTMLDivElement>) {
    if (panels[index]?.props.resizable === false || panels[index + 1]?.props.resizable === false) return;
    event.preventDefault();
    const root = rootRef.current;
    if (!root) return;
    const start = orientation === "horizontal" ? event.clientX : event.clientY;
    const dimension = orientation === "horizontal" ? root.clientWidth : root.clientHeight;
    let latestDelta = 0;
    const move = (moveEvent: globalThis.MouseEvent) => {
      const coordinate = orientation === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
      const nextDelta = (coordinate - start) / dimension * 100;
      resizePair(index, nextDelta - latestDelta);
      latestDelta = nextDelta;
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      resizePair(index, 0, true);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.cursor = orientation === "horizontal" ? "ew-resize" : "ns-resize";
    document.body.style.userSelect = "none";
  }

  function handleKey(index: number, event: KeyboardEvent<HTMLDivElement>) {
    const horizontal = orientation === "horizontal";
    const decrease = horizontal ? event.key === "ArrowLeft" : event.key === "ArrowUp";
    const increase = horizontal ? event.key === "ArrowRight" : event.key === "ArrowDown";
    if (!decrease && !increase) return;
    event.preventDefault();
    resizePair(index, decrease ? -2 : 2, true);
  }

  function togglePanel(index: number, side: "before" | "after") {
    const next = [...sizes];
    const target = side === "before" ? index : index + 1;
    const sibling = side === "before" ? index + 1 : index;
    const collapsedTargetSize = collapsedSize(panels[target]);
    const expandedMin = panels[target]?.props.min ?? collapsedTargetSize;
    const collapsed = sizes[target] <= collapsedTargetSize + 0.01;
    if (collapsed) {
      const pairTotal = sizes[target] + sizes[sibling];
      const remembered = expandedSizesRef.current[target] ?? 0;
      const configured = panels[target]?.props.defaultSize ?? 0;
      const preferred = remembered > expandedMin ? remembered : configured > expandedMin ? configured : Math.max(expandedMin, 20);
      const siblingMin = panels[sibling]?.props.min ?? 0;
      const restored = clamp(preferred, expandedMin, Math.max(expandedMin, pairTotal - siblingMin));
      next[target] = restored;
      next[sibling] = pairTotal - restored;
    } else {
      expandedSizesRef.current[target] = sizes[target];
      const released = sizes[target] - collapsedTargetSize;
      next[target] = collapsedTargetSize;
      next[sibling] = sizes[sibling] + released;
    }
    setSizes(next);
    onResize?.(next);
    onResizeEnd?.(next);
  }

  return <div ref={rootRef} className={`sia-splitter sia-splitter--${orientation} ${className}`.trim()} {...props}>
    {panels.flatMap((panel, index) => {
      const panelCollapsed = Boolean(panel.props.collapsible)
        && (sizes[index] ?? 0) <= collapsedSize(panel) + 0.01;
      const collapsedContent = panel.props.collapsedContent;
      const expandFromCollapsedContent = () => {
        if (index === 0) togglePanel(0, "before");
        else togglePanel(index - 1, "after");
      };
      const panelNode = cloneElement(panel, {
        style: {
          ...panel.props.style,
          flexBasis: `${sizes[index] ?? 0}%`,
        } as CSSProperties,
        children: <>
          <div className={`sia-splitter__panel-content${panelCollapsed ? " is-collapsed" : ""}`} aria-hidden={panelCollapsed}>
            {panel.props.children}
          </div>
          {collapsedContent !== undefined ? (
            <button
              type="button"
              className={`sia-splitter__collapsed-content${panelCollapsed ? " is-visible" : ""}`}
              aria-label={panel.props.collapsedAriaLabel ?? "展开面板"}
              aria-hidden={!panelCollapsed}
              tabIndex={panelCollapsed ? 0 : -1}
              onClick={expandFromCollapsedContent}
            >
              {collapsedContent}
            </button>
          ) : null}
        </>,
      });
      if (index === panels.length - 1) return [panelNode];
      const beforeCollapsible = panels[index]?.props.collapsible;
      const afterCollapsible = panels[index + 1]?.props.collapsible;
      const beforeCollapsed = (sizes[index] ?? 0) <= collapsedSize(panels[index]) + 0.01;
      const afterCollapsed = (sizes[index + 1] ?? 0) <= collapsedSize(panels[index + 1]) + 0.01;
      const beforeUsesRail = beforeCollapsed && panels[index]?.props.collapsedContent !== undefined;
      const afterUsesRail = afterCollapsed && panels[index + 1]?.props.collapsedContent !== undefined;
      return [panelNode, <div
        className={`sia-splitter__handle${beforeCollapsed && !beforeUsesRail ? " sia-splitter__handle--before-collapsed" : ""}${afterCollapsed && !afterUsesRail ? " sia-splitter__handle--after-collapsed" : ""}`}
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(sizes[index] ?? 0)}
        tabIndex={0}
        key={`handle-${index}`}
        onMouseDown={(event) => startResize(index, event)}
        onKeyDown={(event) => handleKey(index, event)}
      >
        {beforeCollapsible && !beforeUsesRail ? <button type="button" className="sia-splitter__collapse sia-splitter__collapse--before" aria-label={beforeCollapsed ? "展开前一个面板" : "收起前一个面板"} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); togglePanel(index, "before"); }}><Icon name={orientation === "horizontal" ? (beforeCollapsed ? "chevron-right" : "chevron-left") : (beforeCollapsed ? "chevron-down" : "chevron-up")} size={11} /></button> : null}
        <span />
        {afterCollapsible && !afterUsesRail ? <button type="button" className="sia-splitter__collapse sia-splitter__collapse--after" aria-label={afterCollapsed ? "展开后一个面板" : "收起后一个面板"} onPointerDown={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); togglePanel(index, "after"); }}><Icon name={orientation === "horizontal" ? (afterCollapsed ? "chevron-left" : "chevron-right") : (afterCollapsed ? "chevron-up" : "chevron-down")} size={11} /></button> : null}
      </div>];
    })}
  </div>;
}

export const Splitter = Object.assign(SplitterRoot, { Panel: SplitterPanel });
