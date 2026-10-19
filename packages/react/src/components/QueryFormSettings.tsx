import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { useQueryFieldSort } from "./useQueryFieldSort";
import { saveSettingsPatch } from "./settingsPersistence";
import { mergeQueryFields, reconcileQueryFields } from "./queryFormSettingsUtils";
import type { QueryFormSettingsConfig, QueryFormSettingsSnapshot } from "./queryFormSettingsTypes";

/** 管理查询布局的云端加载、草稿和保存；通过请求序号隔离业务切换后的迟到响应。未指定默认收起值且云端无记录时保留 undefined，让查询区继续按实际行数判断。 */
export function useQueryFormSettings(
  config: QueryFormSettingsConfig | undefined,
  fields: readonly {
    /** 对应查询字段的稳定标识。 */
    key: string;
    /** 设置列表显示的名称。 */
    label: ReactNode;
    /** 强制可见且禁止取消勾选，不限制排序；默认 false。 */
    hideDisabled?: boolean;
  }[],
  defaultCollapsed: boolean | undefined,
  applyCollapsed: (collapsed: boolean | undefined) => void,
  disabled: boolean,
) {
  const [snapshot, setSnapshot] = useState<QueryFormSettingsSnapshot>();
  const [draft, setDraft] = useState<QueryFormSettingsSnapshot>({ fields: [], defaultCollapsed: defaultCollapsed ?? false });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const token = useRef(0);
  const saveLock = useRef(false);
  const latest = useRef({ config, fields, defaultCollapsed, applyCollapsed });
  latest.current = { config, fields, defaultCollapsed, applyCollapsed };
  const moduleName = config?.scope.moduleName;
  const businessKey = config?.scope.businessKey;
  const adapter = config?.adapter;

  /** 打开时重新读取云端值；失败只反馈错误，保留已经应用的布局供继续查询。 */
  async function load(edit: boolean) {
    const current = latest.current;
    if (!current.config) return;
    const request = ++token.current;
    setLoading(true);
    setError("");
    setLoadFailed(false);
    try {
      const stored = (await current.config.adapter.load(current.config.scope))?.queryForm;
      if (request !== token.current) return;
      const next = stored ?? { fields: [], defaultCollapsed: current.defaultCollapsed ?? false };
      setSnapshot(next);
      setDraft({ ...next, fields: reconcileQueryFields(latest.current.fields.map(field => field.key), next.fields, latest.current.fields.filter(field => field.hideDisabled).map(field => field.key)) });
      // 打开设置不重置用户临时展开状态；初次加载和成功保存才应用云端默认值。
      if (!edit) latest.current.applyCollapsed(stored?.defaultCollapsed ?? latest.current.defaultCollapsed);
    } catch (reason) {
      if (request !== token.current) return;
      setLoadFailed(true);
      setError(reason instanceof Error ? reason.message : "读取查询设置失败");
      current.config.onError?.(reason, "load");
    } finally {
      if (request === token.current) setLoading(false);
    }
  }

  useEffect(() => {
    setSnapshot(undefined);
    setOpen(false);
    setError("");
    setLoadFailed(false);
    setLoading(false);
    setSaving(false);
    saveLock.current = false;
    latest.current.applyCollapsed(latest.current.defaultCollapsed);
    if (adapter) void load(false);
    return () => { token.current++; };
  }, [adapter, moduleName, businessKey]);

  /** 保存成功后才应用布局；失败留在面板内，可重试且不会误报保存成功。 */
  async function save() {
    const current = latest.current;
    if (!current.config || loading || loadFailed || disabled || saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    setError("");
    const request = token.current;
    const active = reconcileQueryFields(current.fields.map(field => field.key), draft.fields, current.fields.filter(field => field.hideDisabled).map(field => field.key));
    const next = { ...draft, fields: mergeQueryFields(snapshot?.fields ?? [], active) };
    try {
      await saveSettingsPatch(current.config.adapter, current.config.scope, { queryForm: next });
      if (request !== token.current) return false;
      setSnapshot(next);
      current.applyCollapsed(next.defaultCollapsed);
      setOpen(false);
      return true;
    } catch (reason) {
      if (request !== token.current) return false;
      setError(reason instanceof Error ? reason.message : "保存查询设置失败");
      current.config.onError?.(reason, "save");
      return false;
    } finally {
      if (request === token.current) { saveLock.current = false; setSaving(false); }
    }
  }

  const hideDisabledKeys = new Set(fields.filter(field => field.hideDisabled).map(field => field.key));
  const visibleDraft = reconcileQueryFields(fields.map(field => field.key), draft.fields, [...hideDisabledKeys]);
  const labels = new Map(fields.map(field => [field.key, field.label]));
  const locked = loading || saving || loadFailed || disabled;
  const move = (from: number, to: number) => {
    if (locked || from === to || to < 0 || to >= visibleDraft.length) return;
    const next = [...visibleDraft];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setDraft(current => ({ ...current, fields: next.map((item, order) => ({ ...item, order })) }));
  };
  // 拖动期间仅移动预览，松手才写入面板草稿，点击保存后才持久化。
  const sort = useQueryFieldSort(visibleDraft.map(item => item.key), open && !locked, keys => {
    const items = new Map(visibleDraft.map(item => [item.key, item]));
    setDraft(current => ({ ...current, fields: keys.map((key, order) => ({ ...items.get(key)!, order })) }));
  });
  // 图标入口单独返回，便于放入紧凑按钮组；错误提示和弹框不占用按钮组位置。
  const control = config ? <Button type="button" className="sia-query-settings__trigger" title="查询设置" aria-label="查询设置" disabled={disabled || saving} loading={loading && !open}
    icon={<Icon name="more-vertical" />} onClick={() => { setOpen(true); void load(true); }} /> : null;
  const panel = config ? <>
    {!open && error ? <span className="sia-query-form__error" role="alert">查询设置读取失败，请打开设置重试</span> : null}
    <Modal title="查询设置" open={open} width={520} okText="保存" confirmLoading={saving}
      okButtonProps={{ disabled: locked }} onOk={save} onOpenChange={next => { if (!saveLock.current) setOpen(next); }}>
      <div className="sia-query-settings">
        {loading ? <p role="status">正在读取查询设置…</p> : null}
        {error ? <div role="alert" className="sia-query-form__error">{error}{loadFailed ? <Button type="button" variant="link" onClick={() => void load(true)}>重试</Button> : null}</div> : null}
        <Checkbox checked={draft.defaultCollapsed} disabled={locked} onChange={checked => setDraft(current => ({ ...current, defaultCollapsed: checked }))}>默认收起查询条件</Checkbox>
        <p className="sia-query-settings__hint">勾选需要显示的条件，拖动或使用上下按钮调整顺序。</p>
        <div ref={sort.listRef} className={`sia-query-settings__list${sort.preview ? " is-sorting" : ""}`}>
          {visibleDraft.map((item, index) => <div key={item.key} data-query-field-key={item.key}
            className={`sia-query-settings__item${sort.preview?.key === item.key ? " is-dragging" : ""}${locked ? " is-disabled" : ""}`}
            style={sort.preview ? { transform: `translateY(${sort.preview.offsets[item.key] ?? 0}px)` } : undefined}
            onPointerDown={event => sort.start(event, item.key)}>
            <Icon name="menu" size={15} />
            <Checkbox aria-label={`显示 ${item.key}`} checked={item.visible} disabled={locked || hideDisabledKeys.has(item.key)} onChange={checked => setDraft(current => ({ ...current, fields: visibleDraft.map(field => field.key === item.key ? { ...field, visible: checked } : field) }))} />
            <span className="sia-query-settings__name">{labels.get(item.key) ?? item.key}</span>
            <div className="sia-query-settings__order">
              <Button type="button" size="small" variant="text" aria-label={`上移 ${item.key}`} disabled={locked || index === 0} icon={<Icon name="chevron-up" />} onClick={() => move(index, index - 1)} />
              <Button type="button" size="small" variant="text" aria-label={`下移 ${item.key}`} disabled={locked || index === visibleDraft.length - 1} icon={<Icon name="chevron-down" />} onClick={() => move(index, index + 1)} />
            </div>
          </div>)}
        </div>
        <Button type="button" disabled={locked} onClick={() => setDraft({ fields: reconcileQueryFields(fields.map(field => field.key)), defaultCollapsed: defaultCollapsed ?? false })}>恢复默认</Button>
      </div>
    </Modal>
  </> : null;
  return { snapshot, control, panel };
}
