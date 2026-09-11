import { useState } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./FloatingDisplay";
import { useControllableState } from "./shared";

export type SliderValue = number | readonly [number, number];

export interface SliderMark {
  label: ReactNode;
  style?: CSSProperties;
}

export interface SliderProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: SliderValue;
  defaultValue?: SliderValue;
  min?: number;
  max?: number;
  step?: number;
  range?: boolean;
  disabled?: boolean;
  reverse?: boolean;
  vertical?: boolean;
  marks?: Readonly<Record<number, ReactNode | SliderMark>>;
  tooltip?: { open?: boolean; formatter?: (value: number) => ReactNode };
  onChange?: (value: SliderValue) => void;
  onChangeComplete?: (value: SliderValue) => void;
}

function percent(value: number, min: number, max: number) {
  return (value - min) / (max - min) * 100;
}

export function Slider({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  range = false,
  disabled = false,
  reverse = false,
  vertical = false,
  marks,
  tooltip,
  className = "",
  onChange,
  onChangeComplete,
  ...props
}: SliderProps) {
  const fallback: SliderValue = defaultValue ?? (range ? [min, max] : min);
  const [currentValue, setValue] = useControllableState<SliderValue>({ value, defaultValue: fallback, onChange });
  const [activeThumb, setActiveThumb] = useState<number | null>(null);
  const values = Array.isArray(currentValue) ? [...currentValue] : [currentValue as number];
  const start = range ? percent(Math.min(values[0], values[1]), min, max) : 0;
  const end = percent(range ? Math.max(values[0], values[1]) : values[0], min, max);
  const style = {
    "--sia-slider-start": `${start}%`,
    "--sia-slider-end": `${end}%`,
  } as CSSProperties;

  function update(index: number, next: number) {
    if (!range) {
      setValue(next);
      return;
    }
    const pair: [number, number] = [values[0], values[1]];
    pair[index] = next;
    pair.sort((a, b) => a - b);
    setValue(pair);
  }

  function finish() {
    onChangeComplete?.(currentValue);
    setActiveThumb(null);
  }

  return <div
    className={`sia-slider${range ? " sia-slider--range" : ""}${vertical ? " sia-slider--vertical" : ""}${reverse ? " sia-slider--reverse" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}
    style={style}
    {...props}
  >
    <div className="sia-slider__rail"><span className="sia-slider__track" /></div>
    {values.map((item, index) => <div className="sia-slider__thumb-wrap" key={index}>
      <input
        className="sia-slider__input"
        type="range"
        aria-label={range ? `${props['aria-label'] ?? '滑块'} ${index + 1}` : props['aria-label'] ?? '滑块'}
        min={min}
        max={max}
        step={step}
        value={item}
        disabled={disabled}
        onFocus={() => setActiveThumb(index)}
        onBlur={() => setActiveThumb(null)}
        onPointerDown={() => setActiveThumb(index)}
        onChange={(event) => update(index, Number(event.currentTarget.value))}
        onMouseUp={finish}
        onTouchEnd={finish}
      />
      {tooltip?.open || activeThumb === index ? <span
        className="sia-slider__tooltip-anchor"
        style={{ "--sia-slider-value": `${percent(item, min, max)}%` } as CSSProperties}
      >
        <Tooltip
          title={tooltip?.formatter ? tooltip.formatter(item) : item}
          placement={vertical ? "right" : "top"}
          trigger={[]}
          open
          overlayClassName="sia-slider__tooltip"
        >
          <span className="sia-slider__tooltip-target" />
        </Tooltip>
      </span> : null}
    </div>)}
    {marks ? <div className="sia-slider__marks">
      {Object.entries(marks).map(([rawValue, mark]) => {
        const numericValue = Number(rawValue);
        const normalized = typeof mark === "object" && mark !== null && "label" in mark ? mark as SliderMark : { label: mark as ReactNode };
        return <button
          type="button"
          className="sia-slider__mark"
          style={{ "--sia-slider-value": `${percent(numericValue, min, max)}%`, ...normalized.style } as CSSProperties}
          key={rawValue}
          disabled={disabled}
          onClick={() => setValue(range ? [values[0], numericValue].sort((a, b) => a - b) as [number, number] : numericValue)}
        ><span />{normalized.label}</button>;
      })}
    </div> : null}
  </div>;
}
