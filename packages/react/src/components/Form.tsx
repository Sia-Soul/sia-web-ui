import { withTitleTooltip } from "./titleTooltip";
import { Children, cloneElement, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ChangeEventHandler, FormHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { ControlSizeContext, PlaceholderModeContext, useControlSize, usePlaceholderMode } from "./shared";
import type { ControlSize, InputPlaceholderMode } from "./shared";
import { Tooltip } from "./FloatingDisplay";
import { Icon } from "./Icon";

/** 开关的视觉样式。 */
export type SwitchVariant = "standard" | "segmented";

/** 开关的属性配置。 */
export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** small / medium / large 标准开关高度为 16 / 22 / 28px，分段开关为 22 / 30 / 38px，文字字号为 12 / 13 / 16px；默认继承 Form，无上下文时为 medium（13px）。 */
  size?: ControlSize;
  /** 开关右侧的可见标签 */
  label?: ReactNode;
  /**
   组件的视觉样式。
   * @defaultValue "standard"
   */
  variant?: SwitchVariant;
  /** 选中状态的文字、图标或自定义内容 */
  checkedContent?: ReactNode;
  /** 未选中状态的文字、图标或自定义内容 */
  uncheckedContent?: ReactNode;
  /** 状态变化时返回最新布尔值 */
  onCheckedChange?: (checked: boolean) => void;
}

/** 开关组件。 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    variant = "standard",
    size: sizeProp,
    checkedContent,
    uncheckedContent,
    onChange,
    onCheckedChange,
    className = "",
    ...props
  },
  ref,
) {
  const size = useControlSize(sizeProp);
  const hasContent = checkedContent !== undefined || uncheckedContent !== undefined;
  const checkedVisual = checkedContent ?? (variant === "segmented" ? "开" : null);
  const uncheckedVisual = uncheckedContent ?? (variant === "segmented" ? "关" : null);
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onCheckedChange?.(event.currentTarget.checked);
    onChange?.(event);
  };

  return (
    <label className={`sia-switch-wrap sia-switch-wrap--${size} ${className}`.trim()}>
      <input ref={ref} type="checkbox" role="switch" className="sia-switch-input" onChange={handleChange} {...withTitleTooltip(props)} />
      <span
        className={`sia-switch sia-switch--${variant}${variant === "standard" && hasContent ? " sia-switch--with-content" : ""}`}
        aria-hidden="true"
      >
        <span className="sia-switch__thumb" />
        {variant === "segmented" ? <>
          <span className="sia-switch__segment sia-switch__segment--unchecked">{uncheckedVisual}</span>
          <span className="sia-switch__segment sia-switch__segment--checked">{checkedVisual}</span>
        </> : hasContent ? <span className="sia-switch__content">
          <span className="sia-switch__content-item sia-switch__content-item--unchecked">{uncheckedVisual}</span>
          <span className="sia-switch__content-item sia-switch__content-item--checked">{checkedVisual}</span>
        </span> : null}
      </span>
      {label ? <span className="sia-switch__label">{label}</span> : null}
    </label>
  );
});

/** 表单字段路径；字符串表示顶层字段，数组表示嵌套字段。 */
export type NamePath = string | number | readonly (string | number)[];
/** 表单字段名到当前值的映射。 */
export type FormValues = Record<string, unknown>;

/** 字段校验规则，支持必填、长度、正则和异步自定义校验。 */
export interface FormRule {
  /** 是否为必填字段。 */
  required?: boolean;
  /** 是否将仅含空白字符的文本判为无效。 */
  whitespace?: boolean;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: "string" | "number" | "boolean" | "array" | "email" | "url";
  /** 允许的最小值。 */
  min?: number;
  /** 允许的最大值。 */
  max?: number;
  /** 要求的精确长度。 */
  len?: number;
  /** 用于校验字段值的正则表达式。 */
  pattern?: RegExp;
  /** 提示或错误消息文本。 */
  message?: ReactNode;
  /** 校验前转换字段值的函数。 */
  transform?: (value: unknown) => unknown;
  /** 自定义校验函数；可返回 Promise，失败时抛出错误。 */
  validator?: (rule: FormRule, value: unknown, values: FormValues) => void | Promise<void>;
}

/** 校验失败的字段路径及其错误文本。 */
export interface FormErrorField {
  /** 名称或字段标识。 */
  name: readonly (string | number)[];
  /** 字段的校验错误信息列表。 */
  errors: readonly ReactNode[];
}

/** 表单操作实例，提供读写字段值、校验、重置和提交方法。 */
export interface FormInstance {
  /** 读取指定字段的当前值，支持嵌套字段路径。 */
  getFieldValue: (name: NamePath) => unknown;
  /** 读取表单当前字段值集合。 */
  getFieldsValue: () => FormValues;
  /** 读取指定字段的校验错误信息。 */
  getFieldError: (name: NamePath) => readonly ReactNode[];
  /** 设置单个字段的值；name 可为嵌套字段路径。 */
  setFieldValue: (name: NamePath, value: unknown) => void;
  /** 批量设置表单字段值。 */
  setFieldsValue: (values: FormValues) => void;
  /** 将字段恢复到初始值，并清理相关校验状态。 */
  resetFields: (names?: readonly NamePath[]) => void;
  /** 执行字段校验；成功返回字段值，失败抛出校验错误信息。 */
  validateFields: (names?: readonly NamePath[]) => Promise<FormValues>;
  /** 提交表单并执行校验；校验通过触发 onFinish，失败触发 onFinishFailed。 */
  submit: () => void;
  /** 将指定字段滚动到可见区域。 */
  scrollToField: (name: NamePath) => void;
}

type FieldRegistration = {
  name: readonly (string | number)[];
  rules: readonly FormRule[];
  getElement: () => HTMLElement | null;
};
type FormCallbacks = {
  onFinish?: (values: FormValues) => void;
  onFinishFailed?: (info: { values: FormValues; errorFields: readonly FormErrorField[] }) => void;
  onValuesChange?: (changedValues: FormValues, values: FormValues) => void;
};

function pathArray(name: NamePath): readonly (string | number)[] {
  return Array.isArray(name) ? name : [name as string | number];
}

function pathKey(name: NamePath) {
  return pathArray(name).join(".");
}

function getValue(source: unknown, path: readonly (string | number)[]) {
  let current = source;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

function setValue(source: FormValues, path: readonly (string | number)[], value: unknown): FormValues {
  const root: FormValues = Array.isArray(source) ? [...source] as unknown as FormValues : { ...source };
  let current: Record<string | number, unknown> = root;
  path.forEach((segment, index) => {
    if (index === path.length - 1) {
      current[segment] = value;
      return;
    }
    const existing = current[segment];
    const nextSegment = path[index + 1];
    const clone = Array.isArray(existing) ? [...existing] : existing && typeof existing === "object" ? { ...existing as object } : typeof nextSegment === "number" ? [] : {};
    current[segment] = clone;
    current = clone as Record<string | number, unknown>;
  });
  return root;
}

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

/** 表单快照保留日期及不可序列化值的语义，不能通过 structuredClone 丢掉类原型。 */
function cloneFormValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (value instanceof RegExp) return new RegExp(value.source, value.flags) as T;
  const cloneable = value as { clone?: () => T };
  if (typeof cloneable.clone === "function") return cloneable.clone();
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const next: any = Array.isArray(value) ? [] : {};
  seen.set(value, next);
  Object.keys(value).forEach((key) => { next[key] = cloneFormValue((value as any)[key], seen); });
  return next;
}

class FormStore implements FormInstance {
  private values: FormValues = {};
  private initialValues: FormValues = {};
  private errors = new Map<string, readonly ReactNode[]>();
  private fields = new Map<string, FieldRegistration>();
  private listeners = new Set<() => void>();
  private callbacks: FormCallbacks = {};
  private version = 0;
  private initialized = false;

  configure(initialValues: FormValues | undefined, callbacks: FormCallbacks) {
    this.callbacks = callbacks;
    if (!this.initialized) {
      this.initialized = true;
      this.initialValues = cloneFormValue(initialValues ?? {});
      this.values = cloneFormValue(initialValues ?? {});
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.version;

  private notify() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  registerField(field: FieldRegistration) {
    const key = pathKey(field.name);
    this.fields.set(key, field);
    return () => {
      this.fields.delete(key);
    };
  }

  getFieldValue = (name: NamePath) => getValue(this.values, pathArray(name));
  getFieldsValue = () => cloneFormValue(this.values);
  getFieldError = (name: NamePath) => this.errors.get(pathKey(name)) ?? [];

  setFieldValue = (name: NamePath, value: unknown) => {
    const path = pathArray(name);
    this.values = setValue(this.values, path, value);
    this.errors.delete(pathKey(path));
    const changed = setValue({}, path, value);
    this.callbacks.onValuesChange?.(changed, this.getFieldsValue());
    this.notify();
  };

  setFieldsValue = (values: FormValues) => {
    Object.entries(values).forEach(([key, value]) => {
      this.values = setValue(this.values, [key], value);
    });
    this.notify();
  };

  resetFields = (names?: readonly NamePath[]) => {
    if (!names) {
      this.values = cloneFormValue(this.initialValues);
      this.errors.clear();
    } else {
      names.forEach((name) => {
        const path = pathArray(name);
        this.values = setValue(this.values, path, getValue(this.initialValues, path));
        this.errors.delete(pathKey(path));
      });
    }
    this.notify();
  };

  async validateField(name: NamePath) {
    const key = pathKey(name);
    const field = this.fields.get(key);
    if (!field) return [];
    const rawValue = this.getFieldValue(field.name);
    const errors: ReactNode[] = [];
    for (const rule of field.rules) {
      const value = rule.transform ? rule.transform(rawValue) : rawValue;
      const message = rule.message ?? "字段校验未通过";
      if (rule.required && (isEmpty(value) || rule.whitespace && typeof value === "string" && !value.trim())) {
        errors.push(rule.message ?? "该字段为必填项");
        continue;
      }
      if (isEmpty(value)) continue;
      const length = typeof value === "number" ? value : typeof value === "string" || Array.isArray(value) ? value.length : undefined;
      if (rule.type === "number" && typeof value !== "number") errors.push(message);
      if (rule.type === "string" && typeof value !== "string") errors.push(message);
      if (rule.type === "boolean" && typeof value !== "boolean") errors.push(message);
      if (rule.type === "array" && !Array.isArray(value)) errors.push(message);
      if (rule.type === "email" && (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) errors.push(message);
      if (rule.type === "url" && (typeof value !== "string" || !/^https?:\/\//i.test(value))) errors.push(message);
      if (rule.min !== undefined && length !== undefined && length < rule.min) errors.push(message);
      if (rule.max !== undefined && length !== undefined && length > rule.max) errors.push(message);
      if (rule.len !== undefined && length !== rule.len) errors.push(message);
      if (rule.pattern && (typeof value !== "string" || !rule.pattern.test(value))) errors.push(message);
      try {
        await rule.validator?.(rule, value, this.getFieldsValue());
      } catch (error) {
        errors.push(error instanceof Error ? error.message : message);
      }
    }
    if (errors.length) this.errors.set(key, errors); else this.errors.delete(key);
    this.notify();
    return errors;
  }

  validateFields = async (names?: readonly NamePath[]) => {
    const fields = names?.map((name) => this.fields.get(pathKey(name))).filter(Boolean) as FieldRegistration[] | undefined;
    const targets = fields ?? [...this.fields.values()];
    const results = await Promise.all(targets.map(async (field) => ({ field, errors: await this.validateField(field.name) })));
    const errorFields = results.filter((item) => item.errors.length).map<FormErrorField>((item) => ({ name: item.field.name, errors: item.errors }));
    const values = this.getFieldsValue();
    if (errorFields.length) throw { values, errorFields };
    return values;
  };

  submit = () => {
    void this.validateFields().then(this.callbacks.onFinish).catch((info: { values: FormValues; errorFields: readonly FormErrorField[] }) => {
      this.callbacks.onFinishFailed?.(info);
      if (info.errorFields[0]) this.scrollToField(info.errorFields[0].name);
    });
  };

  scrollToField = (name: NamePath) => {
    if (typeof document === "undefined") return;
    const field = this.fields.get(pathKey(name));
    const element = field?.getElement();
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const focusTarget = element.matches(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
      ? element
      : element.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
    window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
  };
}

type InternalFormInstance = FormInstance & Pick<FormStore, "configure" | "getSnapshot" | "registerField" | "subscribe" | "validateField">;
const FormContext = createContext<InternalFormInstance | null>(null);

/** 创建或复用表单实例。返回单元素元组，可使用 const [form] = useForm() 获取实例并传给 Form 或 QueryForm。 */
export function useForm(form?: FormInstance): readonly [FormInstance] {
  const ref = useRef<FormInstance>(form ?? new FormStore());
  return [ref.current] as const;
}

/** 表单的属性配置。 */
export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: ControlSize;
  /** 表单实例；可由 Form.useForm() 或 useForm() 创建。 */
  form?: FormInstance;
  /** 表单初始值 */
  initialValues?: FormValues;
  /**
   * 布局方式；horizontal 与 inline 默认按当前表单内最宽标签对齐，vertical 保持标签在控件上方。
   * @defaultValue "horizontal"
   */
  layout?: "horizontal" | "vertical" | "inline";
  /** 占位提示的显示模式；floating 为浮动标签。 */
  placeholderMode?: InputPlaceholderMode;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /**
   * 是否显示必填标识。
   * @defaultValue true
   */
  requiredMark?: boolean | "optional";
  /** 提交并且校验通过时调用，参数为完整的表单字段值。 */
  onFinish?: (values: FormValues) => void;
  /** 表单提交校验失败时调用，参数包含字段值和错误列表。 */
  onFinishFailed?: (info: {
  /** 字段值或选中值的集合。 */
  values: FormValues;
  /** 校验失败的字段及其错误信息。 */
  errorFields: readonly FormErrorField[] }) => void;
  /** 字段通过表单控件交互更新时调用，接收本次变化字段和完整值；用于联动查询条件等业务逻辑。 */
  onValuesChange?: (changedValues: FormValues, values: FormValues) => void;
}

function FormRoot({
  form,
  initialValues,
  layout = "horizontal",
  size: sizeProp,
  placeholderMode,
  disabled = false,
  requiredMark = true,
  className = "",
  onFinish,
  onFinishFailed,
  onValuesChange,
  children,
  ...props
}: FormProps) {
  const size = useControlSize(sizeProp);
  const resolvedPlaceholderMode = usePlaceholderMode(placeholderMode);
  const [internalForm] = useForm(form);
  const instance = internalForm as InternalFormInstance;
  instance.configure(initialValues, { onFinish, onFinishFailed, onValuesChange });
  const context = useMemo(() => instance, [instance]);
  const formRef = useRef<HTMLFormElement>(null);
  // 每个表单独立测量真实标签内容，包含必填标记和自定义节点；动态增删后重新计算最大值。
  useLayoutEffect(() => {
    const root = formRef.current;
    if (!root) return;
    let frame = 0;
    const observed = new Set<HTMLElement>();
    /** 汇总当前表单中可见标签的自然宽度，排除嵌套表单，允许最长标签移除后缩小。 */
    const measure = () => {
      frame = 0;
      const labels = [...root.querySelectorAll<HTMLElement>(".sia-form-item__label-content")]
        .filter(label => label.closest(".sia-form") === root);
      const next = new Set(labels);
      observed.forEach(label => { if (!next.has(label)) { resizeObserver.unobserve(label); observed.delete(label); } });
      let width = 0;
      labels.forEach(label => {
        if (!observed.has(label)) { resizeObserver.observe(label); observed.add(label); }
        if (label.getClientRects().length) width = Math.max(width, label.offsetWidth);
      });
      const value = `${Math.ceil(width)}px`;
      if (root.style.getPropertyValue("--sia-form-auto-label-width") !== value) root.style.setProperty("--sia-form-auto-label-width", value);
    };
    /** 合并内容及布局变化的测量请求，避免一次更新中重复读取布局。 */
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    measure();
    return () => { resizeObserver.disconnect(); mutations.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return <FormContext.Provider value={context}><PlaceholderModeContext.Provider value={resolvedPlaceholderMode}><ControlSizeContext.Provider value={size}>
    <form
      ref={formRef}
      {...withTitleTooltip(props)}
      className={`sia-form sia-form--${layout} sia-form--${size}${disabled ? " is-disabled" : ""} ${className}`.trim()}
      data-required-mark={requiredMark}
      onSubmit={(event) => { event.preventDefault(); instance.submit(); }}
    >
      <fieldset disabled={disabled}>{children}</fieldset>
    </form>
  </ControlSizeContext.Provider></PlaceholderModeContext.Provider></FormContext.Provider>;
}

/** 表单项的字段绑定、标签、校验及内容配置。 */
export interface FormItemProps {
  /** 绑定到表单值的字段名或嵌套路径，例如 ["user", "name"]。 */
  name?: NamePath;
  /** 字段标签，支持文本或 React 节点；横向及行内布局未指定标签列宽时，与同一 Form 内最宽的可见标签对齐，测量包含必填标记。 */
  label?: ReactNode;
  /**
   * 字段的校验规则，按配置执行。
   * @defaultValue []
   */
  rules?: readonly FormRule[];
  /** 是否为必填字段。 */
  required?: boolean;
  /** 主体之外的补充内容或操作区。 */
  extra?: ReactNode;
  /** 字段下方的辅助说明或校验提示。 */
  help?: ReactNode;
  /** 手动指定字段校验状态。 */
  validateStatus?: "success" | "warning" | "error" | "validating";
  /**
   * 向子控件传递值时使用的属性名，如 value 或 checked。
   * @defaultValue "value"
   */
  valuePropName?: string;
  /**
   * 触发显示的交互方式。
   * @defaultValue "onChange"
   */
  trigger?: string;
  /**
   * 触发字段校验的事件名或事件名集合。
   * @defaultValue "onChange"
   */
  validateTrigger?: string | readonly string[];
  /** 从子控件的事件参数中提取需要写入表单的值。 */
  getValueFromEvent?: (...args: unknown[]) => unknown;
  /**
   * 只提供字段绑定与校验，不渲染 Form.Item 的布局容器。
   * @defaultValue false
   */
  noStyle?: boolean;
  /** 依赖的字段路径；依赖变化时更新当前字段。 */
  dependencies?: readonly NamePath[];
  /** 控制表单值变化后是否重新渲染此项，可传比较函数。 */
  shouldUpdate?: boolean | ((previous: FormValues, next: FormValues) => boolean);
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode | ((form: FormInstance) => ReactNode);
  /**
   * 附加到组件根节点的 CSS 类名。
   * @defaultValue ""
   */
  className?: string;
}

function defaultEventValue(valuePropName: string, args: unknown[]) {
  const first = args[0];
  if (first && typeof first === "object" && "target" in first) return (first as { target: Record<string, unknown> }).target[valuePropName];
  return first;
}

function FormItem({
  name,
  label,
  rules = [],
  required,
  extra,
  help,
  validateStatus,
  valuePropName = "value",
  trigger = "onChange",
  validateTrigger = "onChange",
  getValueFromEvent,
  noStyle = false,
  children,
  className = "",
}: FormItemProps) {
  const form = useContext(FormContext);
  const id = useId();
  const itemRef = useRef<HTMLDivElement>(null);
  if (!form) throw new Error("Form.Item 必须在 Form 内使用");
  useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const path = name === undefined ? undefined : pathArray(name);
  const key = path ? pathKey(path) : "";
  const ruleRequired = required ?? rules.some((rule) => rule.required);
  const errors = path ? form.getFieldError(path) : [];
  const status = validateStatus ?? (errors.length ? "error" : undefined);
  const helpContent = help ?? errors[0];
  const labelId = label && !noStyle ? `${id}-label` : undefined;
  const errorId = `${id}-error`;

  useEffect(() => {
    if (!path) return undefined;
    return form.registerField({
      name: path,
      rules,
      getElement: () => itemRef.current ?? (typeof document === "undefined" ? null : document.getElementById(id)),
    });
  }, [form, id, key, rules]);

  let content: ReactNode;
  if (typeof children === "function") {
    content = children(form);
  } else {
    const childArray = Children.toArray(children);
    const child = childArray.length === 1 && isValidElement(childArray[0]) ? childArray[0] as ReactElement<Record<string, unknown>> : null;
    if (child && path) {
      const childProps = child.props;
      const originalTrigger = childProps[trigger] as ((...args: unknown[]) => void) | undefined;
      const validationEvents = Array.isArray(validateTrigger) ? validateTrigger : [validateTrigger];
      content = cloneElement(child, {
        id: childProps.id ?? id,
        [valuePropName]: form.getFieldValue(path) ?? (valuePropName === "checked" ? false : ""),
        [trigger]: (...args: unknown[]) => {
          const next = getValueFromEvent ? getValueFromEvent(...args) : defaultEventValue(valuePropName, args);
          form.setFieldValue(path, next);
          originalTrigger?.(...args);
          if (validationEvents.includes(trigger)) void form.validateField(path);
        },
        "aria-invalid": status === "error" || undefined,
        "aria-errormessage": status === "error" && helpContent ? errorId : undefined,
        "aria-labelledby": [
          childProps["aria-labelledby"],
          labelId,
        ].filter(Boolean).join(" ") || undefined,
        "aria-describedby": [
          childProps["aria-describedby"],
          status === "error" && helpContent ? errorId : null,
        ].filter(Boolean).join(" ") || undefined,
        status: status === "error" || status === "warning" ? status : childProps.status,
      });
    } else {
      content = children;
    }
  }

  if (noStyle) return <>{content}</>;
  const inputWrap = <div className="sia-form-item__input-wrap">{content}</div>;
  const hasError = status === "error" && Boolean(helpContent);
  return <div ref={itemRef} className={`sia-form-item${status ? ` sia-form-item--${status}` : ""} ${className}`.trim()} data-sia-form-field={key || undefined}>
    {label ? <div id={labelId} className="sia-form-item__label"><span className="sia-form-item__label-content">{ruleRequired ? <span className="sia-form-item__required-mark" aria-hidden="true">*</span> : null}{label}</span></div> : null}
    <div className="sia-form-item__control">
      <Tooltip
        title={hasError ? <span id={errorId} className="sia-form-item__error-content">
            <Icon className="sia-form-item__error-icon" name="circle-close" variant="filled" size={16} aria-hidden="true" />
            <span>{helpContent}</span>
          </span> : null}
        placement="bottom-start"
        trigger={[]}
        open={hasError}
        role="alert"
        color="var(--sia-color-error)"
        overlayClassName="sia-form-item__error-popover"
      >
        {inputWrap}
      </Tooltip>
      {status !== "error" && helpContent ? <div className="sia-form-item__help">{helpContent}</div> : null}
      {extra ? <div className="sia-form-item__extra">{extra}</div> : null}
    </div>
  </div>;
}

/** 动态列表中一个字段的渲染标识和索引。 */
export interface FormListField {
  /** 唯一标识；同一集合内应保持唯一且稳定，用于定位、渲染和状态关联。 */
  key: number;
  /** 该字段在表单列表中的索引。 */
  name: number;
}

/** 动态表单列表的新增、删除和移动操作。 */
export interface FormListOperation {
  /** 新增列表项，可指定初始值和插入位置。 */
  add: (value?: unknown, index?: number) => void;
  /** 删除指定索引的列表项。 */
  remove: (index: number | readonly number[]) => void;
  /** 将列表项从源索引移动到目标索引。 */
  move: (from: number, to: number) => void;
}

/** FormList的属性配置。 */
export interface FormListProps {
  /** 名称或字段标识。 */
  name: NamePath;
  /** 列表渲染函数，接收字段描述和 add、remove、move 操作。 */
  children: (fields: readonly FormListField[], operations: FormListOperation) => ReactNode;
}

function FormList({ name, children }: FormListProps) {
  const form = useContext(FormContext);
  if (!form) throw new Error("Form.List 必须在 Form 内使用");
  useSyncExternalStore(form.subscribe, form.getSnapshot, form.getSnapshot);
  const current = form.getFieldValue(name);
  const values = Array.isArray(current) ? current : [];
  const operations: FormListOperation = {
    add(value = undefined, index = values.length) {
      const next = [...values];
      next.splice(index, 0, value);
      form.setFieldValue(name, next);
    },
    remove(index) {
      const removed = new Set(Array.isArray(index) ? index : [index]);
      form.setFieldValue(name, values.filter((_, itemIndex) => !removed.has(itemIndex)));
    },
    move(from, to) {
      const next = [...values];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      form.setFieldValue(name, next);
    },
  };
  return children(values.map((_, index) => ({ key: index, name: index })), operations);
}

function FormErrorList({ errors = [] }: {
  /** 要显示的字段校验错误列表。 */
  errors?: readonly ReactNode[];
}) {
  return errors.length ? <div className="sia-form-error-list">{errors.map((error, index) => <div key={index}>{error}</div>)}</div> : null;
}

/** 表单组件。 */
export const Form = Object.assign(FormRoot, {
  /** 表单字段，负责字段值绑定、校验和标签布局。 */
  Item: FormItem,
  /** 动态表单列表，提供字段索引以及新增、删除、移动操作。 */
  List: FormList,
  /** 显示表单错误文本集合。 */
  ErrorList: FormErrorList,
  /** 创建或复用表单实例，返回单元素元组 [form]。 */
  useForm,
});
