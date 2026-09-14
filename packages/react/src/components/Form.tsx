import { Children, cloneElement, createContext, forwardRef, isValidElement, useContext, useEffect, useId, useMemo, useRef, useSyncExternalStore } from "react";
import type { ChangeEventHandler, FormHTMLAttributes, InputHTMLAttributes, ReactElement, ReactNode } from "react";
import { Tooltip } from "./FloatingDisplay";
import { Icon } from "./Icon";

export type SwitchVariant = "standard" | "segmented";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: ReactNode;
  variant?: SwitchVariant;
  checkedContent?: ReactNode;
  uncheckedContent?: ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  {
    label,
    variant = "standard",
    checkedContent,
    uncheckedContent,
    onChange,
    onCheckedChange,
    className = "",
    ...props
  },
  ref,
) {
  const hasContent = checkedContent !== undefined || uncheckedContent !== undefined;
  const checkedVisual = checkedContent ?? (variant === "segmented" ? "开" : null);
  const uncheckedVisual = uncheckedContent ?? (variant === "segmented" ? "关" : null);
  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    onCheckedChange?.(event.currentTarget.checked);
    onChange?.(event);
  };

  return (
    <label className={`sia-switch-wrap ${className}`.trim()}>
      <input ref={ref} type="checkbox" role="switch" className="sia-switch-input" onChange={handleChange} {...props} />
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

export type NamePath = string | number | readonly (string | number)[];
export type FormValues = Record<string, unknown>;

export interface FormRule {
  required?: boolean;
  whitespace?: boolean;
  type?: "string" | "number" | "boolean" | "array" | "email" | "url";
  min?: number;
  max?: number;
  len?: number;
  pattern?: RegExp;
  message?: ReactNode;
  transform?: (value: unknown) => unknown;
  validator?: (rule: FormRule, value: unknown, values: FormValues) => void | Promise<void>;
}

export interface FormErrorField {
  name: readonly (string | number)[];
  errors: readonly ReactNode[];
}

export interface FormInstance {
  getFieldValue: (name: NamePath) => unknown;
  getFieldsValue: () => FormValues;
  getFieldError: (name: NamePath) => readonly ReactNode[];
  setFieldValue: (name: NamePath, value: unknown) => void;
  setFieldsValue: (values: FormValues) => void;
  resetFields: (names?: readonly NamePath[]) => void;
  validateFields: (names?: readonly NamePath[]) => Promise<FormValues>;
  submit: () => void;
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

export function useForm(form?: FormInstance): readonly [FormInstance] {
  const ref = useRef<FormInstance>(form ?? new FormStore());
  return [ref.current] as const;
}

export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  form?: FormInstance;
  initialValues?: FormValues;
  layout?: "horizontal" | "vertical" | "inline";
  disabled?: boolean;
  requiredMark?: boolean | "optional";
  onFinish?: (values: FormValues) => void;
  onFinishFailed?: (info: { values: FormValues; errorFields: readonly FormErrorField[] }) => void;
  onValuesChange?: (changedValues: FormValues, values: FormValues) => void;
}

function FormRoot({
  form,
  initialValues,
  layout = "horizontal",
  disabled = false,
  requiredMark = true,
  className = "",
  onFinish,
  onFinishFailed,
  onValuesChange,
  children,
  ...props
}: FormProps) {
  const [internalForm] = useForm(form);
  const instance = internalForm as InternalFormInstance;
  instance.configure(initialValues, { onFinish, onFinishFailed, onValuesChange });
  const context = useMemo(() => instance, [instance]);
  return <FormContext.Provider value={context}>
    <form
      {...props}
      className={`sia-form sia-form--${layout}${disabled ? " is-disabled" : ""} ${className}`.trim()}
      data-required-mark={requiredMark}
      onSubmit={(event) => { event.preventDefault(); instance.submit(); }}
    >
      <fieldset disabled={disabled}>{children}</fieldset>
    </form>
  </FormContext.Provider>;
}

export interface FormItemProps {
  name?: NamePath;
  label?: ReactNode;
  rules?: readonly FormRule[];
  required?: boolean;
  extra?: ReactNode;
  help?: ReactNode;
  validateStatus?: "success" | "warning" | "error" | "validating";
  valuePropName?: string;
  trigger?: string;
  validateTrigger?: string | readonly string[];
  getValueFromEvent?: (...args: unknown[]) => unknown;
  noStyle?: boolean;
  dependencies?: readonly NamePath[];
  shouldUpdate?: boolean | ((previous: FormValues, next: FormValues) => boolean);
  children?: ReactNode | ((form: FormInstance) => ReactNode);
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
    {label ? <div id={labelId} className="sia-form-item__label">{ruleRequired ? <span aria-hidden="true">*</span> : null}{label}</div> : null}
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

export interface FormListField {
  key: number;
  name: number;
}

export interface FormListOperation {
  add: (value?: unknown, index?: number) => void;
  remove: (index: number | readonly number[]) => void;
  move: (from: number, to: number) => void;
}

export interface FormListProps {
  name: NamePath;
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

function FormErrorList({ errors = [] }: { errors?: readonly ReactNode[] }) {
  return errors.length ? <div className="sia-form-error-list">{errors.map((error, index) => <div key={index}>{error}</div>)}</div> : null;
}

export const Form = Object.assign(FormRoot, {
  Item: FormItem,
  List: FormList,
  ErrorList: FormErrorList,
  useForm,
});
