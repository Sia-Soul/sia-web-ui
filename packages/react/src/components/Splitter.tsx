import { Children, cloneElement, isValidElement, useMemo, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from "react";
import { Icon } from "./Icon";

export interface SplitterPanelProps extends HTMLAttributes<HTMLDivElement> {
  defaultSize?: number;
  min?: number;
  max?: number;
  collapsible?: boolean;
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
  min: _min,
  max: _max,
  collapsible: _collapsible,
  resizable: _resizable,
  className = "",
  ...props
}: SplitterPanelProps) {
  return <div className={`sia-splitter__panel ${className}`.trim()} {...props} />;
}

function normalizeSizes(panels: readonly ReactElement<SplitterPanelProps>[]) {
  const specified = panels.map((panel) => panel.props.defaultSize);
  const totalSpecified = specified.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const unspecified = specified.filter((value) => value === undefined).length;
  const remaining = Math.max(0, 100 - totalSpecified);
  return specified.map((value) => value ?? (unspecified ? remaining / unspecified : 0));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
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

  function collapsePanel(index: number, side: "before" | "after") {
    setSizes((current) => {
      const next = [...current];
      const target = side === "before" ? index : index + 1;
      const sibling = side === "before" ? index + 1 : index;
      const min = panels[target]?.props.min ?? 0;
      const released = current[target] - min;
      next[target] = min;
      next[sibling] = current[sibling] + released;
      onResize?.(next);
      onResizeEnd?.(next);
      return next;
    });
  }

  return <div ref={rootRef} className={`sia-splitter sia-splitter--${orientation} ${className}`.trim()} {...props}>
    {panels.flatMap((panel, index) => {
      const panelNode = cloneElement(panel, {
        style: {
          ...panel.props.style,
          flexBasis: `${sizes[index] ?? 0}%`,
        } as CSSProperties,
      });
      if (index === panels.length - 1) return [panelNode];
      const beforeCollapsible = panels[index]?.props.collapsible;
      const afterCollapsible = panels[index + 1]?.props.collapsible;
      return [panelNode, <div
        className="sia-splitter__handle"
        role="separator"
        aria-orientation={orientation}
        aria-valuenow={Math.round(sizes[index] ?? 0)}
        tabIndex={0}
        key={`handle-${index}`}
        onMouseDown={(event) => startResize(index, event)}
        onKeyDown={(event) => handleKey(index, event)}
      >
        {beforeCollapsible ? <button type="button" className="sia-splitter__collapse sia-splitter__collapse--before" aria-label="收起前一个面板" onMouseDown={(event) => event.stopPropagation()} onClick={() => collapsePanel(index, "before")}><Icon name={orientation === "horizontal" ? "chevron-left" : "chevron-up"} size={11} /></button> : null}
        <span />
        {afterCollapsible ? <button type="button" className="sia-splitter__collapse sia-splitter__collapse--after" aria-label="收起后一个面板" onMouseDown={(event) => event.stopPropagation()} onClick={() => collapsePanel(index, "after")}><Icon name={orientation === "horizontal" ? "chevron-right" : "chevron-down"} size={11} /></button> : null}
      </div>];
    })}
  </div>;
}

export const Splitter = Object.assign(SplitterRoot, { Panel: SplitterPanel });
