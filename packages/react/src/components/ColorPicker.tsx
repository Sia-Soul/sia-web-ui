import { withTitleTooltip } from "./titleTooltip";
import { useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Icon } from "./Icon";
import { PopupPortal } from "./PopupPortal";
import { useControllableState } from "./shared";

/** 颜色选择的模式类型。 */
export type ColorPickerMode = "solid" | "gradient";

/** 预设颜色分组定义。 */
export interface ColorPickerPreset {
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: ReactNode;
  /** 可选颜色或颜色序列。 */
  colors: readonly string[];
}

/** 颜色选择的属性配置。 */
export interface ColorPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 当前值；作为受控属性时，需要在变更回调中同步更新。 */
  value?: string;
  /**
   * 非受控模式的初始值，仅在初始化时使用。
   * @defaultValue "#1677FF"
   */
  defaultValue?: string;
  /** 展示或交互模式；可选值见类型定义。 */
  mode?: ColorPickerMode;
  /**
   * 初始化时使用的模式。
   * @defaultValue "solid"
   */
  defaultMode?: ColorPickerMode;
  /**
   允许切换的模式集合。
   * @defaultValue DEFAULT_MODES
   */
  modes?: readonly ColorPickerMode[];
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   是否允许清空当前选择或输入值。
   * @defaultValue false
   */
  allowClear?: boolean;
  /**
   * 是否显示文字内容。
   * @defaultValue false
   */
  showText?: boolean | ((color: string) => ReactNode);
  /**
   * 是否显示透明度调节控件。
   * @defaultValue false
   */
  showAlpha?: boolean;
  /** 预设候选值或快捷选项集合。 */
  presets?: readonly ColorPickerPreset[];
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (color: string) => void;
  /** 拖动完成回调 */
  onChangeComplete?: (color: string) => void;
  /** 模式切换后调用。 */
  onModeChange?: (mode: ColorPickerMode) => void;
  /** 清空当前值时调用。 */
  onClear?: () => void;
}

type RgbaColor = { r: number; g: number; b: number; a: number };
type HsvColor = { h: number; s: number; v: number };
type GradientStop = { id: number; color: string; position: number };
type ParsedGradient = { angle: number; stops: Array<Omit<GradientStop, "id">> };

const DEFAULT_MODES: readonly ColorPickerMode[] = ["solid", "gradient"];
let gradientStopSeed = 0;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(color: string, fallback = "#1677FF") {
  const value = color.trim();
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return value.toUpperCase();
  if (/^#[0-9a-f]{3,4}$/i.test(value)) {
    return `#${value.slice(1).split("").map((item) => `${item}${item}`).join("")}`.toUpperCase();
  }
  return fallback;
}

function parseHex(color: string): RgbaColor | null {
  const normalized = normalizeHex(color, "");
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
    a: normalized.length === 9 ? Math.round(parseInt(normalized.slice(7, 9), 16) / 255 * 100) : 100,
  };
}

function rgbaToHex({ r, g, b, a }: RgbaColor, includeAlpha: boolean) {
  const channel = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
  const alpha = Math.round(clamp(a, 0, 100) / 100 * 255).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}${includeAlpha && a < 100 ? alpha : ""}`.toUpperCase();
}

function rgbToHsv({ r, g, b }: RgbaColor): HsvColor {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: hue < 0 ? hue + 360 : hue, s: max === 0 ? 0 : delta / max * 100, v: max * 100 };
}

function hsvToRgba(h: number, s: number, v: number, a: number): RgbaColor {
  const saturation = clamp(s, 0, 100) / 100;
  const brightness = clamp(v, 0, 100) / 100;
  const chroma = brightness * saturation;
  const sector = ((h % 360) + 360) % 360 / 60;
  const intermediate = chroma * (1 - Math.abs(sector % 2 - 1));
  const [red, green, blue] = sector < 1 ? [chroma, intermediate, 0]
    : sector < 2 ? [intermediate, chroma, 0]
      : sector < 3 ? [0, chroma, intermediate]
        : sector < 4 ? [0, intermediate, chroma]
          : sector < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];
  const match = brightness - chroma;
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255, a };
}

function parseGradient(value: string): ParsedGradient | null {
  const match = value.trim().match(/^linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,([\s\S]+)\)$/i);
  if (!match) return null;
  const stops = Array.from(match[2].matchAll(/(#[0-9a-f]{3,8})\s+(-?\d+(?:\.\d+)?)%/gi))
    .map((item) => ({ color: normalizeHex(item[1]), position: clamp(Number(item[2]), 0, 100) }));
  return stops.length >= 2 ? { angle: ((Number(match[1]) % 360) + 360) % 360, stops } : null;
}

function formatGradient(angle: number, stops: readonly GradientStop[]) {
  const sorted = [...stops].sort((left, right) => left.position - right.position);
  return `linear-gradient(${Math.round(angle)}deg, ${sorted.map((stop) => `${stop.color} ${Math.round(stop.position)}%`).join(", ")})`;
}

function createStop(color: string, position: number): GradientStop {
  return { id: ++gradientStopSeed, color: normalizeHex(color), position };
}

function createDefaultStops(color: string): GradientStop[] {
  return [createStop(color, 0), createStop("#FFFFFF", 100)];
}

/** 颜色选择组件。 */
export function ColorPicker({
  size: sizeProp,
  value,
  defaultValue = "#1677FF",
  mode,
  defaultMode = "solid",
  modes = DEFAULT_MODES,
  disabled = false,
  allowClear = false,
  showText = false,
  showAlpha = false,
  presets,
  className = "",
  onChange,
  onChangeComplete,
  onModeChange,
  onClear,
  ...props
}: ColorPickerProps) {
  const size = useControlSize(sizeProp);
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const lastEmittedValue = useRef<string>();
  const initialGradient = parseGradient(value ?? defaultValue);
  const initialSolid = initialGradient?.stops[0]?.color ?? normalizeHex(value || defaultValue);
  const [open, setOpen] = useState(false);
  const [color, setColor] = useControllableState({
    value,
    defaultValue: initialGradient ? formatGradient(initialGradient.angle, initialGradient.stops.map((stop, index) => ({ id: index, ...stop }))) : normalizeHex(defaultValue),
    onChange,
  });
  const [currentMode, setCurrentMode] = useControllableState<ColorPickerMode>({
    value: mode,
    defaultValue: initialGradient ? "gradient" : defaultMode,
    onChange: onModeChange,
  });
  const [solidColor, setSolidColor] = useState(initialSolid);
  const [gradientAngle, setGradientAngle] = useState(initialGradient?.angle ?? 90);
  const [gradientStops, setGradientStops] = useState<GradientStop[]>(() => initialGradient
    ? initialGradient.stops.map((stop) => createStop(stop.color, stop.position))
    : createDefaultStops(initialSolid));
  const [activeStopId, setActiveStopId] = useState(() => gradientStops[0]?.id ?? 0);
  const activeStop = gradientStops.find((stop) => stop.id === activeStopId) ?? gradientStops[0];
  const editingColor = currentMode === "gradient" ? activeStop?.color ?? solidColor : solidColor;
  const rgba = parseHex(editingColor) ?? parseHex("#1677FF")!;
  const hsv = rgbToHsv(rgba);
  const [hexDraft, setHexDraft] = useState(editingColor);
  const gradientValue = formatGradient(gradientAngle, gradientStops);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    setHexDraft(editingColor);
  }, [editingColor]);

  useEffect(() => {
    if (value === undefined || value === lastEmittedValue.current) return;
    const parsed = parseGradient(value);
    if (parsed) {
      const nextStops = parsed.stops.map((stop) => createStop(stop.color, stop.position));
      setGradientStops(nextStops);
      setGradientAngle(parsed.angle);
      setActiveStopId(nextStops[0]?.id ?? 0);
      if (mode === undefined && modes.includes("gradient")) setCurrentMode("gradient");
    } else if (value) {
      setSolidColor(normalizeHex(value));
      if (mode === undefined && modes.includes("solid")) setCurrentMode("solid");
    }
  }, [mode, modes, setCurrentMode, value]);

  function emit(next: string, complete = false) {
    lastEmittedValue.current = next;
    setColor(next);
    if (complete) onChangeComplete?.(next);
  }

  function emitGradient(nextStops: GradientStop[], nextAngle = gradientAngle, complete = false) {
    setGradientStops(nextStops);
    const next = formatGradient(nextAngle, nextStops);
    emit(next, complete);
  }

  function updateEditingColor(next: string, complete = false) {
    const normalized = normalizeHex(next);
    if (currentMode === "gradient" && activeStop) {
      emitGradient(gradientStops.map((stop) => stop.id === activeStop.id ? { ...stop, color: normalized } : stop), gradientAngle, complete);
    } else {
      setSolidColor(normalized);
      emit(normalized, complete);
    }
  }

  function updateSaturation(event: ReactPointerEvent<HTMLDivElement>, complete = false) {
    const rect = event.currentTarget.getBoundingClientRect();
    const saturation = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100);
    const brightness = clamp(100 - (event.clientY - rect.top) / rect.height * 100, 0, 100);
    updateEditingColor(rgbaToHex(hsvToRgba(hsv.h, saturation, brightness, rgba.a), showAlpha), complete);
  }

  function switchMode(nextMode: ColorPickerMode) {
    if (!modes.includes(nextMode) || nextMode === currentMode) return;
    setCurrentMode(nextMode);
    emit(nextMode === "gradient" ? gradientValue : solidColor, true);
  }

  function addGradientStop(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = clamp((event.clientX - rect.left) / rect.width * 100, 0, 100);
    const nextStop = createStop(editingColor, position);
    const nextStops = [...gradientStops, nextStop].sort((left, right) => left.position - right.position);
    setActiveStopId(nextStop.id);
    emitGradient(nextStops, gradientAngle, true);
  }

  function selectNoColor() {
    lastEmittedValue.current = "";
    setColor("");
    onChangeComplete?.("");
    onClear?.();
  }

  const triggerBackground = color || "transparent";
  const triggerText = color || "无色";
  const opaqueColor = rgbaToHex({ ...rgba, a: 100 }, false);

  return <div ref={rootRef} className={`sia-color-picker sia-color-picker--${size}${disabled ? " is-disabled" : ""} ${className}`.trim()} {...withTitleTooltip(props)}>
    <button
      type="button"
      className="sia-color-picker__trigger"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
    >
      <span className={`sia-color-picker__swatch${color ? "" : " is-empty"}`} style={color ? { background: triggerBackground } : undefined} />
      {showText ? <span className="sia-color-picker__trigger-text">{typeof showText === "function" ? showText(color) : triggerText}</span> : null}
      <Icon name="chevron-down" size={14} />
    </button>
    <PopupPortal ref={popupRef} anchorRef={rootRef} open={open} className="sia-color-picker__popup" role="dialog" aria-label="颜色选择器">
      <div className="sia-color-picker__mode-row">
        {modes.length > 1 ? <div className="sia-color-picker__modes" role="tablist" aria-label="颜色模式">
          {modes.map((item) => <button type="button" role="tab" aria-selected={currentMode === item} className={currentMode === item ? "is-active" : ""} key={item} onClick={() => switchMode(item)}>
            {item === "solid" ? "单色" : "渐变色"}
          </button>)}
        </div> : <strong>{currentMode === "solid" ? "单色" : "渐变色"}</strong>}
        {allowClear ? <button type="button" className={`sia-color-picker__none${color ? "" : " is-active"}`} aria-label="选择无色" {...withTitleTooltip({ title: "无色" })} onClick={selectNoColor}><span /></button> : null}
      </div>

      {currentMode === "gradient" ? <div className="sia-color-picker__gradient-editor">
        <div className="sia-color-picker__gradient-preview" style={{ background: gradientValue }} onPointerDown={addGradientStop}>
          {gradientStops.map((stop) => <button
            type="button"
            className={stop.id === activeStop?.id ? "is-active" : ""}
            aria-label={`选择 ${Math.round(stop.position)}% 色标`}
            style={{ left: `${stop.position}%`, background: stop.color }}
            key={stop.id}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setActiveStopId(stop.id)}
          />)}
        </div>
        <div className="sia-color-picker__gradient-controls">
          <label>方向 <input type="number" min={0} max={360} value={Math.round(gradientAngle)} onChange={(event) => {
            const nextAngle = clamp(Number(event.currentTarget.value), 0, 360);
            setGradientAngle(nextAngle);
            emit(formatGradient(nextAngle, gradientStops));
          }} onBlur={() => onChangeComplete?.(formatGradient(gradientAngle, gradientStops))} /><span>°</span></label>
          <label>位置 <input type="range" min={0} max={100} value={activeStop?.position ?? 0} onChange={(event) => {
            if (!activeStop) return;
            emitGradient(gradientStops.map((stop) => stop.id === activeStop.id ? { ...stop, position: Number(event.currentTarget.value) } : stop));
          }} onPointerUp={() => onChangeComplete?.(formatGradient(gradientAngle, gradientStops))} /><span>{Math.round(activeStop?.position ?? 0)}%</span></label>
          <button type="button" disabled={gradientStops.length <= 2} onClick={() => {
            if (!activeStop || gradientStops.length <= 2) return;
            const index = gradientStops.findIndex((stop) => stop.id === activeStop.id);
            const nextStops = gradientStops.filter((stop) => stop.id !== activeStop.id);
            setActiveStopId(nextStops[Math.max(0, index - 1)]?.id ?? nextStops[0]?.id ?? 0);
            emitGradient(nextStops, gradientAngle, true);
          }}><Icon name="minus" size={14} /> 删除色标</button>
        </div>
      </div> : null}

      <div
        className="sia-color-picker__saturation"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateSaturation(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturation(event);
        }}
        onPointerUp={(event) => {
          updateSaturation(event, true);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <span style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }} />
      </div>

      <label className="sia-color-picker__hue">
        <span className="sia-color-picker__field-label">色相</span>
        <input type="range" min={0} max={360} value={Math.round(hsv.h)} onChange={(event) => {
          updateEditingColor(rgbaToHex(hsvToRgba(Number(event.currentTarget.value), hsv.s, hsv.v, rgba.a), showAlpha));
        }} onPointerUp={() => onChangeComplete?.(currentMode === "gradient" ? gradientValue : solidColor)} />
      </label>

      {showAlpha ? <label className="sia-color-picker__alpha" style={{ "--sia-alpha-color": opaqueColor } as CSSProperties}>
        <span className="sia-color-picker__field-label">透明度</span>
        <input type="range" min={0} max={100} value={rgba.a} onChange={(event) => {
          updateEditingColor(rgbaToHex({ ...rgba, a: Number(event.currentTarget.value) }, true));
        }} onPointerUp={() => onChangeComplete?.(currentMode === "gradient" ? gradientValue : solidColor)} />
        <span>{rgba.a}%</span>
      </label> : null}

      <div className="sia-color-picker__value-row">
        <span>HEX</span>
        <input aria-label="HEX" value={hexDraft} onChange={(event) => {
          const next = event.currentTarget.value;
          setHexDraft(next);
          if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(next)) updateEditingColor(next);
        }} onBlur={() => {
          const normalized = normalizeHex(hexDraft, editingColor);
          setHexDraft(normalized);
          updateEditingColor(normalized, true);
        }} />
        <span className={`sia-color-picker__value-swatch${color ? "" : " is-empty"}`} style={color ? { background: editingColor } : undefined} />
      </div>

      {presets?.map((preset, index) => <div className="sia-color-picker__preset" key={index}>
        {preset.label ? <strong>{preset.label}</strong> : null}
        <div>{preset.colors.map((presetColor) => <button type="button" aria-label={`选择颜色 ${presetColor}`} style={{ background: presetColor }} key={presetColor} onClick={() => updateEditingColor(presetColor, true)} />)}</div>
      </div>)}
    </PopupPortal>
  </div>;
}
