import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes } from "react";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Icon } from "./Icon";
import { Input } from "./Input";
import { Modal } from "./Modal";
import { Select } from "./Select";
import { Tree } from "./FloatingDisplay";
import type { TreeNode } from "./FloatingDisplay";
import { useControllableState, useControlSize } from "./shared";
import type { ControlSize } from "./shared";
import { createBrowserChooseBoxSource } from "./chooseBoxSource";
import type { ChooseBoxEntry, ChooseBoxSource } from "./chooseBoxSource";

/** 文件与文件夹选择框；value 始终为条目数组，单选最多一个条目。 */
export interface ChooseBoxProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue" | "title" | "onError"> {
  /** 目录源；默认创建独立的浏览器授权源，桌面使用 createTauriChooseBoxSource。请保持对象引用稳定。 */
  source?: ChooseBoxSource;
  /** 选择目标；file 仅确认文件，directory 仅确认文件夹，默认 file。文件夹在两种模式下都可浏览。 */
  kind?: "file" | "directory";
  /** 是否多选，默认 false；多选可跨目录保留草稿，确认时一次提交。 */
  multiple?: boolean;
  /** 受控选中条目；通过 onChange 回填，空数组表示未选择。 */
  value?: readonly ChooseBoxEntry[];
  /** 非受控初始条目，默认空数组，仅初始化时使用。 */
  defaultValue?: readonly ChooseBoxEntry[];
  /** 确认或清空时触发，参数为去重后的选中条目；浏览目录、取消和关闭不会触发。 */
  onChange?: (entries: ChooseBoxEntry[]) => void;
  /** 是否禁用选择与清空，默认 false；打开期间变为禁用时关闭窗口并丢弃草稿。 */
  disabled?: boolean;
  /** 未选择时的提示，默认按 kind 显示“请选择文件”或“请选择文件夹”。 */
  placeholder?: string;
  /** 是否显示清空按钮，默认 true；清空提交空数组。 */
  allowClear?: boolean;
  /** 文件扩展名过滤，例如 .png,.jpg；默认空字符串表示全部文件。不支持 MIME，目录模式忽略此属性。 */
  accept?: string;
  /** 弹窗标题，默认根据 kind 与 multiple 生成。 */
  title?: string;
  /** 控件尺寸，默认继承 Form；small/medium/large 高度为 22/30/38px。 */
  size?: ControlSize;
  /** 读取目录或授权失败时触发，同时在窗口展示错误；用户取消授权不触发。 */
  onError?: (error: Error) => void;
}

/** 带目录树、路径导航、网格/列表视图与确认草稿的选择框；默认使用浏览器只读授权源，支持桌面宿主目录源。 */
export function ChooseBox({ source: suppliedSource, kind = "file", multiple = false, value, defaultValue = [], onChange,
  disabled = false, placeholder, allowClear = true, accept = "", title, size: sizeProp, onError, className = "", ...props }: ChooseBoxProps) {
  const browserSource = useMemo(createBrowserChooseBoxSource, []);
  const source = suppliedSource ?? browserSource;
  const size = useControlSize(sizeProp);
  const [selected, setSelected] = useControllableState<readonly ChooseBoxEntry[]>({ value, defaultValue, onChange: entries => onChange?.([...entries]) });
  const [open, setOpen] = useState(false);
  const [roots, setRoots] = useState<readonly ChooseBoxEntry[]>([]);
  const [cache, setCache] = useState<Record<string, readonly ChooseBoxEntry[]>>({});
  const [history, setHistory] = useState<ChooseBoxEntry[]>([]);
  const [position, setPosition] = useState(-1);
  const current = history[position];
  const [draft, setDraft] = useState<ChooseBoxEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const [sort, setSort] = useState("asc");
  const [filter, setFilter] = useState("accepted");
  const [pathText, setPathText] = useState("");
  const session = useRef(0);
  const request = useRef(0);
  const authorizingLock = useRef(false);
  const errorHandler = useRef(onError); errorHandler.current = onError;
  const targetName = kind === "file" ? "文件" : "文件夹";
  const extensions = accept.split(",").map(item => item.trim().toLowerCase()).filter(Boolean);
  const allowed = (entry: ChooseBoxEntry) => entry.kind === kind && (kind === "directory" || !extensions.length || extensions.some(ext => entry.name.toLowerCase().endsWith(ext)));
  const normalized = (entries: readonly ChooseBoxEntry[]) => {
    const result = [...new Map(entries.filter(allowed).map(entry => [entry.id, entry])).values()];
    return multiple ? result : result.slice(0, 1);
  };
  const displayed = normalized(selected);
  const chosen = normalized(draft);
  const report = (reason: unknown) => {
    const failure = reason instanceof Error ? reason : new Error(String(reason));
    setError(failure.message); errorHandler.current?.(failure);
  };
  function close() { session.current++; request.current++; setOpen(false); }

  // 每次打开独立草稿；请求代次防止关闭、切源或快速目录切换后旧结果覆盖新窗口。
  useEffect(() => {
    if (!open) return;
    const token = ++session.current;
    setRoots([]); setCache({}); setHistory([]); setPosition(-1); setQuery(""); setPathText(""); setError(""); setBusy(true);
    Promise.resolve().then(() => source.getRoots()).then(entries => {
      if (session.current !== token) return;
      const directories = entries.filter(entry => entry.kind === "directory");
      setRoots(directories);
      if (directories[0]) { setHistory([directories[0]]); setPosition(0); }
    }).catch(reason => { if (session.current === token) report(reason); }).finally(() => { if (session.current === token) setBusy(false); });
    return () => { session.current++; request.current++; };
  }, [open, source]);
  useEffect(() => { if (disabled && open) close(); }, [disabled, open]);

  async function read(directory: ChooseBoxEntry, token: number) {
    const entries = await source.readDirectory(directory);
    if (session.current === token) setCache(previous => ({ ...previous, [directory.id]: entries }));
    return entries;
  }
  async function refresh(directory: ChooseBoxEntry) {
    const token = session.current, id = ++request.current;
    setBusy(true); setError("");
    try { await read(directory, token); }
    catch (reason) { if (token === session.current && id === request.current) report(reason); }
    finally { if (token === session.current && id === request.current) setBusy(false); }
  }
  useEffect(() => {
    if (!open || !current) return;
    setPathText(current.path); setQuery("");
    void refresh(current);
  }, [open, current, source]);

  function navigate(entry: ChooseBoxEntry) {
    if (entry.kind !== "directory" || current?.id === entry.id) return;
    setHistory(previous => [...previous.slice(0, position + 1), entry]); setPosition(position + 1);
  }
  function toggle(entry: ChooseBoxEntry) {
    if (!allowed(entry)) return;
    setDraft(previous => multiple ? previous.some(item => item.id === entry.id) ? previous.filter(item => item.id !== entry.id) : [...previous, entry] : [entry]);
  }
  async function authorize() {
    if (!source.authorize || authorizingLock.current) return;
    const token = session.current;
    authorizingLock.current = true; setAuthorizing(true); setError("");
    try {
      const entry = await source.authorize();
      if (!entry || token !== session.current) return;
      const entries = await source.getRoots();
      if (token !== session.current) return;
      setRoots(entries.filter(item => item.kind === "directory")); navigate(entry);
    } catch (reason) { if (token === session.current) report(reason); }
    finally { authorizingLock.current = false; setAuthorizing(false); }
  }
  const allEntries = new Map([...roots, ...Object.values(cache).flat()].map(entry => [entry.id, entry]));
  const parent = current ? Object.entries(cache).find(([, entries]) => entries.some(entry => entry.id === current.id))?.[0] : undefined;
  function treeNodes(entries: readonly ChooseBoxEntry[], ancestors = new Set<string>()): TreeNode[] {
    return entries.filter(entry => entry.kind === "directory" && !ancestors.has(entry.id)).map(entry => ({
      key: entry.id, title: entry.name, icon: <Icon name="folder" />, isLeaf: false, loaded: cache[entry.id] !== undefined,
      children: cache[entry.id] ? treeNodes(cache[entry.id], new Set([...ancestors, entry.id])) : undefined,
    }));
  }
  const visible = [...(current ? cache[current.id] ?? [] : [])].filter(entry =>
    entry.name.toLowerCase().includes(query.toLowerCase()) && (entry.kind === "directory" || filter === "all" || !extensions.length || extensions.some(ext => entry.name.toLowerCase().endsWith(ext))))
    .sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || a.name.localeCompare(b.name, "zh-CN", { numeric: true }) * (sort === "asc" ? 1 : -1));
  const selectable = visible.filter(allowed);
  const allChecked = selectable.length > 0 && selectable.every(entry => chosen.some(item => item.id === entry.id));

  // 清空与选择是独立按钮；尾部图标固定尺寸，长路径只在文字区省略。
  const clearable = allowClear && displayed.length > 0 && !disabled;
  return <div {...props} className={`sia-choose-box${clearable ? " sia-choose-box--clearable" : ""} ${className}`.trim()}>
    <Button className="sia-choose-box__trigger" size={size} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
      icon={<Icon name={kind === "directory" ? "folder" : "file"} size={16} />} iconPosition="end"
      onClick={() => { setDraft(normalized(selected)); setOpen(true); }}>
      <span className={`sia-choose-box__value${displayed.length ? "" : " sia-choose-box__placeholder"}`}>{displayed.length ? displayed.map(entry => entry.path).join("；") : placeholder ?? `请选择${targetName}`}</span>
    </Button>
    {clearable && <Button className="sia-choose-box__clear" variant="text" size={size} aria-label="清空选择" icon={<Icon name="close" size={14} />} onClick={() => setSelected([])} />}
    <Modal open={open} title={title ?? `选择${multiple ? "多个" : "单个"}${targetName}`} width={960} centered autoFocus={false}
      className="sia-choose-box__modal" onCancel={close} okButtonProps={{ disabled: busy || authorizing || !chosen.length }}
      onOk={() => { if (disabled || busy || authorizing || !chosen.length) return false; setSelected(chosen); close(); }}
      footerExtra={<span role="status">已选择 {chosen.length} 个{targetName}</span>}>
      <div className="sia-choose-box__toolbar">
        <Button aria-label="后退" title="后退" disabled={position <= 0} icon={<Icon name="arrow-left" />} onClick={() => setPosition(position - 1)} />
        <Button aria-label="前进" title="前进" disabled={position >= history.length - 1} icon={<Icon name="arrow-right" />} onClick={() => setPosition(position + 1)} />
        <Button aria-label="上一级" title="上一级" disabled={!parent} icon={<Icon name="arrow-up" />} onClick={() => { if (parent) navigate(allEntries.get(parent)!); }} />
        <Button aria-label="刷新目录" title="刷新目录" disabled={!current || busy} icon={<Icon name="refresh" />} onClick={() => current && void refresh(current)} />
        <Select aria-label="排序" allowClear={false} value={sort} onChange={value => setSort(String(value))} options={[{ value: "asc", label: "名称升序" }, { value: "desc", label: "名称降序" }]} />
        <Select aria-label="视图" allowClear={false} value={view} onChange={value => setView(String(value))} options={[{ value: "grid", label: "图标视图" }, { value: "list", label: "列表视图" }]} />
        {source.authorize && <Button loading={authorizing} onClick={() => void authorize()} icon={<Icon name="folder-plus" />}>添加授权目录</Button>}
      </div>
      <div className="sia-choose-box__path"><Input aria-label="目录路径" value={pathText} allowClear={false} onChange={event => setPathText(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { const entry = [...allEntries.values()].find(item => item.kind === "directory" && item.path === pathText); if (entry) navigate(entry); else setError("请先在目录树中展开此路径，或添加授权目录。"); } }} />
        <Input aria-label="搜索当前目录" placeholder="搜索当前目录" value={query} onChange={event => setQuery(event.target.value)} />
      </div>
      {error && <div className="sia-choose-box__error" role="alert">{error}</div>}
      <div className="sia-choose-box__body">
        <aside className="sia-choose-box__tree" aria-label="目录树">
          <Tree treeData={treeNodes(roots)} showIcon selectedKeys={current ? [current.id] : []}
            loadData={async node => { const token = session.current; try { await read(allEntries.get(String(node.key))!, token); } catch (reason) { if (token === session.current) report(reason); throw reason; } }}
            onSelect={(_, info) => { const entry = allEntries.get(String(info.node.key)); if (entry) navigate(entry); }} />
        </aside>
        <section className="sia-choose-box__content" aria-label="目录内容" aria-busy={busy}>
          <div className="sia-choose-box__selection-tools">
            {multiple && <Checkbox checked={allChecked} disabled={busy || !selectable.length} onChange={checked => setDraft(previous => checked ? [...new Map([...previous, ...selectable].map(entry => [entry.id, entry])).values()] : previous.filter(entry => !selectable.some(item => item.id === entry.id)))}>全选当前列表</Checkbox>}
            {kind === "directory" && <Button size="small" disabled={!current || busy} onClick={() => current && toggle(current)}>选择当前文件夹</Button>}
          </div>
          {busy ? <p className="sia-choose-box__empty" role="status">正在读取目录…</p> : !roots.length ? <p className="sia-choose-box__empty">{source.authorize ? "请添加授权目录后开始选择" : "暂无可用目录"}</p> : !visible.length ? <p className="sia-choose-box__empty">{query ? "没有匹配项" : "此文件夹为空"}</p> :
            <div className={`sia-choose-box__entries sia-choose-box__entries--${view}`}>
              {visible.map(entry => <div key={entry.id} className={`sia-choose-box__entry${chosen.some(item => item.id === entry.id) ? " is-selected" : ""}`}>
                {multiple && allowed(entry) && <Checkbox aria-label={`选择 ${entry.name}`} checked={chosen.some(item => item.id === entry.id)} onChange={() => toggle(entry)} />}
                <Button variant="text" className="sia-choose-box__item" title={entry.name} aria-label={entry.name} aria-pressed={chosen.some(item => item.id === entry.id)}
                  disabled={entry.kind === "file" && !allowed(entry)} onClick={() => entry.kind === "directory" && kind === "file" ? navigate(entry) : toggle(entry)}
                  onDoubleClick={() => { if (entry.kind === "directory") navigate(entry); }}>
                  <Icon className={entry.kind === "directory" ? "is-directory" : ""} name={entry.kind === "directory" ? "folder" : "file"} size={view === "grid" ? 38 : 20} />
                  <span>{entry.name}</span>
                </Button>
                {entry.kind === "directory" && kind === "directory" && <Button size="small" variant="link" aria-label={`打开 ${entry.name}`} onClick={() => navigate(entry)}>打开</Button>}
              </div>)}
            </div>}
        </section>
      </div>
      <div className="sia-choose-box__bottom">
        <span title={chosen.map(entry => entry.path).join("；")}>{chosen.length ? chosen.map(entry => entry.name).join("；") : "尚未选择"}</span>
        {kind === "file" && extensions.length > 0 && <Select aria-label="文件类型" allowClear={false} value={filter} onChange={value => setFilter(String(value))}
          options={[{ value: "accepted", label: `允许的文件 (${accept})` }, { value: "all", label: "显示全部文件" }]} />}
        {chosen.length > 0 && <Button size="small" onClick={() => setDraft([])}>清空已选</Button>}
      </div>
    </Modal>
  </div>;
}
