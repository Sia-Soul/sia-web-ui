import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import { withTitleTooltip } from "./titleTooltip";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { ImagePreview } from "./DataDisplay";
import { acceptsUploadFile, includeUploadPath, readUploadEntries } from "./uploadFiles";
import { sendUploadRequest } from "./uploadRequest";
import { downloadUploadFile } from "./uploadDownload";
import { message } from "./Message";
import type { UploadChangeInfo, UploadFile, UploadProps, UploadDraggerProps, UploadRef, UploadRequestHandle, UploadRequestOptions, UploadItemActions } from "./uploadTypes";
export type { UploadChangeInfo, UploadDraggerProps, UploadFile, UploadFileStatus, UploadProps, UploadRequestOptions, UploadHttpRequest, UploadRequestHandle, UploadRejectInfo, UploadRef, UploadItemActions } from "./uploadTypes";

const LIST_IGNORE = Symbol("SIA_UPLOAD_LIST_IGNORE");

/** 每个预览独立持有对象 URL，在文件替换或卸载时释放，避免照片墙长期占用内存。 */
function useThumbnail(file?: UploadFile) {
  const [local, setLocal] = useState<string>();
  useEffect(() => {
    if (!file?.thumbUrl && file?.originFileObj?.type.startsWith("image/")) {
      const url = URL.createObjectURL(file.originFileObj);
      setLocal(url);
      return () => URL.revokeObjectURL(url);
    }
    setLocal(undefined);
  }, [file?.originFileObj, file?.thumbUrl]);
  return file?.thumbUrl || local || (file?.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(file?.url ?? "") ? file?.url : undefined);
}

/** 列表缩略图及状态；自定义渲染仍可复用默认节点和受限操作。 */
function UploadItem({ file, files, props, actions }: { file: UploadFile; files: readonly UploadFile[]; props: UploadProps; actions: UploadItemActions }) {
  const source = useThumbnail(file);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const downloadingRef = useRef(false);
  const canPreview = !!(source || file.url || file.originFileObj || props.onPreview);
  const canDownload = !!(file.url || file.originFileObj || props.downloadRequest);
  // 默认操作区负责呈现失败与防止重复下载，自定义 itemRender 可自行处理 actions.download 的拒绝。
  async function download() {
    if (downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true);
    try { await actions.download(); }
    catch { message.error("下载失败，请检查文件地址、访问权限或跨域配置"); }
    finally { downloadingRef.current = false; setDownloading(false); }
  }
  useEffect(() => setFailed(false), [source]);
  const node = <div className={`sia-upload__item sia-upload__item--${file.status ?? "ready"}`}>
    {props.listType !== "text" ? <Button variant="text" className="sia-upload__thumbnail" aria-label={`预览缩略图 ${file.name}`} onClick={actions.preview} disabled={!canPreview}>
      {source && !failed ? <img src={source} alt={file.name} onError={() => setFailed(true)} /> : <Icon name={file.type?.startsWith("image/") ? "image" : "file"} size={28} />}
    </Button> : <Icon name={file.status === "done" ? "circle-check" : "file"} size={16} />}
    <span className="sia-upload__name" {...withTitleTooltip({ title: file.relativePath || file.name })}>{file.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a> : file.name}</span>
    <span className="sia-upload__actions">
      <Button variant="text" title="预览" aria-label={`预览 ${file.name}`} disabled={!canPreview} onClick={actions.preview}><Icon name="eye" size={14} /></Button>
      <Button variant="text" title="下载" aria-label={`下载 ${file.name}`} disabled={!canDownload} loading={downloading} onClick={() => void download()}><Icon name="download" size={14} /></Button>
      <Button variant="text" title="移除" className="sia-upload__remove" disabled={props.disabled} aria-label={`移除 ${file.name}`} onClick={() => void actions.remove()}><Icon name="close" size={14} /></Button>
    </span>
    {file.status === "uploading" && <div className="sia-upload__uploading"><span>上传中 {Math.round(file.percent ?? 0)}%</span><span className="sia-upload__progress" role="progressbar" aria-label={`${file.name} 上传进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={file.percent ?? 0}><span style={{ width: `${file.percent ?? 0}%` }} /></span></div>}
    {file.status === "error" && <span className="sia-upload__error">上传失败</span>}
  </div>;
  return <>{props.itemRender ? props.itemRender(node, file, files, actions) : node}</>;
}

/** 请求令牌区分重试前后的回调，完成 Promise 同时供手动批量操作等待。 */
type UploadTask = { controller: AbortController; handle?: UploadRequestHandle; done: Promise<void>; finish: () => void };

/** 上传根实现：选择同步占位，校验和请求独立执行，防止多入口并发绕过数量上限。 */
const UploadRoot = forwardRef<UploadRef, UploadProps>(function UploadRoot({ accept, multiple = false, directory = false, recursive = true, pastable = false,
  disabled = false, autoUpload = true, maxCount, fileList, defaultFileList = [], listType = "text", showUploadList = true,
  beforeUpload, request, customRequest, onChange, onRemove, onReject, onReadError, onPreview, downloadRequest, itemRender, children,
  className = "", onDragOver, onDragLeave, onDrop, onPaste, tabIndex, ...props }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalFiles, setInternalFiles] = useState<readonly UploadFile[]>(defaultFileList);
  const files = fileList ?? internalFiles;
  const filesRef = useRef(files);
  filesRef.current = files;
  const tasks = useRef(new Map<string, UploadTask>());
  const mounted = useRef(true);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<UploadFile>();
  const previewSource = useThumbnail(preview);
  const limit = maxCount === undefined || !Number.isFinite(maxCount) ? Infinity : Math.max(0, Math.floor(maxCount));
  const full = files.length >= limit;
  const current = useRef({ disabled, directory, recursive });
  current.current = { disabled, directory, recursive };

  function cancel(uid: string) {
    const task = tasks.current.get(uid);
    tasks.current.delete(uid);
    task?.controller.abort();
    try { task?.handle?.abort?.(); } catch { /* 单个 SDK 取消失败不能中断其他资源清理。 */ }
    task?.finish();
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; [...tasks.current.keys()].forEach(cancel); };
  }, []);
  useEffect(() => {
    // 外部受控删除也取消任务；不允许迟到回调把记录重新插入列表。
    for (const uid of tasks.current.keys()) if (!files.some(file => file.uid === uid)) cancel(uid);
    if (preview && !files.some(file => file.uid === preview.uid)) setPreview(undefined);
  }, [files, preview]);

  function emit(file: UploadFile, next: readonly UploadFile[], event: UploadChangeInfo["event"]) {
    if (!mounted.current) return;
    filesRef.current = next;
    if (fileList === undefined) setInternalFiles(next);
    onChange?.({ file, fileList: next, event });
  }

  function start(file: UploadFile): Promise<void> {
    if (current.current.disabled || !mounted.current || file.status === "done" || !file.originFileObj) return Promise.resolve();
    const existing = tasks.current.get(file.uid);
    if (existing) return existing.done;
    let finish = () => {};
    const done = new Promise<void>(resolve => { finish = resolve; });
    const task: UploadTask = { controller: new AbortController(), done, finish };
    tasks.current.set(file.uid, task);
    const active = () => mounted.current && tasks.current.get(file.uid) === task && !task.controller.signal.aborted && filesRef.current.some(entry => entry.uid === file.uid);
    const update = (patch: Partial<UploadFile>, event: UploadChangeInfo["event"]) => {
      if (!active()) return;
      const next = { ...filesRef.current.find(entry => entry.uid === file.uid)!, ...patch };
      emit(next, filesRef.current.map(entry => entry.uid === file.uid ? next : entry), event);
    };
    const settle = () => { if (tasks.current.get(file.uid) === task) tasks.current.delete(file.uid); finish(); };
    const options: UploadRequestOptions = {
      file: file.originFileObj, filename: file.name, uploadFile: file, relativePath: file.relativePath || file.name, signal: task.controller.signal,
      onProgress: percent => { if (Number.isFinite(percent)) update({ percent: Math.max(0, Math.min(100, percent)) }, "progress"); },
      onSuccess: (response, url) => { if (!active()) return; update({ status: "done", percent: 100, response, ...(url ? { url } : {}) }, "success"); settle(); },
      onError: error => { if (!active()) return; update({ status: "error", error }, "error"); settle(); },
    };
    // 先注册任务再通知状态，业务方可在 onChange 内同步取消。
    update({ status: "uploading", percent: 0, error: undefined }, "start");
    void (async () => {
      try {
        if (!active()) return;
        const result = await beforeUpload?.(options.file, filesRef.current.flatMap(entry => entry.originFileObj ? [entry.originFileObj] : []));
        if (!active()) return;
        if (result === LIST_IGNORE) { settle(); emit(file, filesRef.current.filter(entry => entry.uid !== file.uid), "remove"); return; }
        if (result === false || (!customRequest && !request)) { update({ status: "ready" }, "cancel"); settle(); return; }
        if (result instanceof File) { options.file = result; options.filename = result.name; }
        if (customRequest) task.handle = (await customRequest(options)) || undefined;
        else {
          const config = typeof request === "function" ? await request({ ...file, originFileObj: options.file, name: options.filename }, task.controller.signal) : request!;
          if (active()) task.handle = sendUploadRequest(config, options);
        }
        // 签名或 SDK 初始化期间取消，异步返回的句柄也必须立即中止。
        if (task.controller.signal.aborted) task.handle?.abort?.();
      } catch (error) { options.onError(error); }
    })();
    return done;
  }

  function abort(uid?: string) {
    const ids = uid ? [uid] : [...tasks.current.keys()];
    for (const id of ids) {
      if (!tasks.current.has(id)) continue;
      cancel(id);
      const file = filesRef.current.find(entry => entry.uid === id);
      if (file) { const next = { ...file, status: "ready" as const, percent: 0 }; emit(next, filesRef.current.map(entry => entry.uid === id ? next : entry), "cancel"); }
    }
  }
  async function remove(uid: string) {
    if (current.current.disabled) return;
    const file = filesRef.current.find(entry => entry.uid === uid);
    if (!file) return;
    try {
      if (await onRemove?.(file) === false || !mounted.current || current.current.disabled) return;
      cancel(uid);
      emit(file, filesRef.current.filter(entry => entry.uid !== uid), "remove");
    } catch { /* onRemove 拒绝与返回 false 相同，保留记录和请求。 */ }
  }
  useImperativeHandle(ref, () => ({
    upload: async uid => { await Promise.all(filesRef.current.filter(file => (!uid || file.uid === uid) && file.status !== "done").map(start)); },
    abort, remove,
  }));

  function ingest(entries: { file: File; path: string }[]) {
    if (current.current.disabled || !mounted.current) return;
    const filtered = directory ? entries.filter(entry => includeUploadPath(entry.path, recursive)) : entries;
    const selected = multiple || directory ? filtered : filtered.slice(0, 1);
    const added: UploadFile[] = [];
    for (const { file, path } of selected) {
      if (!acceptsUploadFile(file, accept)) { onReject?.({ file, reason: "accept" }); continue; }
      if (filesRef.current.length >= limit) { onReject?.({ file, reason: "max-count" }); continue; }
      const item: UploadFile = { uid: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, size: file.size, type: file.type, relativePath: path, originFileObj: file, status: "ready", percent: 0 };
      emit(item, [...filesRef.current, item], "add");
      added.push(item);
    }
    if (autoUpload) added.forEach(file => { void start(file); });
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    onDrop?.(event);
    setDragging(false);
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (disabled) return;
    // DataTransfer 只能在事件期间读取；先同步保存句柄，再异步读取目录。
    const fallback = [...event.dataTransfer.files].map(file => ({ file, path: file.webkitRelativePath || file.name }));
    const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry);
    try {
      if (entries.length) ingest(await readUploadEntries(entries.filter(entry => directory || !entry.isDirectory), recursive));
      else ingest(fallback);
    } catch (error) { if (mounted.current) onReadError?.(error); }
  }
  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    onPaste?.(event);
    if (event.defaultPrevented || disabled || !pastable) return;
    const selected = [...event.clipboardData.files];
    if (!selected.length) return;
    event.preventDefault();
    ingest(selected.map(file => ({ file, path: file.name })));
  }

  const trigger = !(listType === "picture-card" && full) && <div className="sia-upload__trigger">
    <Button className="sia-upload__choose" disabled={disabled || full} onClick={() => inputRef.current?.click()}>
      {children ?? (listType === "picture-card" ? <><Icon name="plus" size={24} /><span>上传图片</span></> : <><Icon name="upload" size={16} />{directory ? "选择文件夹" : "选择文件"}</>)}
    </Button>
  </div>;
  return <div {...withTitleTooltip(props)} className={`sia-upload sia-upload--${listType}${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""} ${className}`.trim()}
    tabIndex={tabIndex ?? (pastable && !disabled ? 0 : undefined)} onPaste={handlePaste}
    onDragOver={event => { onDragOver?.(event); if (!event.defaultPrevented) { event.preventDefault(); if (!disabled) setDragging(true); } }}
    onDragLeave={event => { onDragLeave?.(event); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => void handleDrop(event)}>
    <input ref={inputRef} className="sia-upload__input" type="file" accept={accept} multiple={multiple || directory} disabled={disabled || full}
      {...(directory ? { webkitdirectory: "", directory: "" } : {})}
      onChange={event => { ingest([...(event.currentTarget.files ?? [])].map(file => ({ file, path: file.webkitRelativePath || file.name }))); event.currentTarget.value = ""; }} />
    {listType !== "picture-card" && trigger}
    <div className="sia-upload__list">
      {showUploadList && files.map(file => <UploadItem key={file.uid} file={file} files={files} props={{ listType, disabled, itemRender, onPreview, downloadRequest }} actions={{
        upload: () => start(file), abort: () => abort(file.uid), remove: () => remove(file.uid), download: () => downloadUploadFile(file, downloadRequest),
        preview: () => {
          if (onPreview) onPreview(file);
          else if ((file.type || file.originFileObj?.type)?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)) setPreview(file);
          else if (file.url || file.originFileObj) {
            // 非图片交给浏览器查看；此入口与强制下载完全独立。
            const url = file.url || URL.createObjectURL(file.originFileObj!);
            window.open(url, "_blank", "noopener,noreferrer");
            if (!file.url) window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          } else if (file.thumbUrl) setPreview(file);
        },
      }} />)}
      {listType === "picture-card" && trigger}
    </div>
    <ImagePreview open={!!preview && !!(preview.url || previewSource)} src={preview?.url || previewSource} alt={preview?.name} onOpenChange={open => { if (!open) setPreview(undefined); }} />
  </div>;
});

/** 拖拽入口与普通上传共享列表、请求、取消和校验流程。 */
const UploadDragger = forwardRef<UploadRef, UploadDraggerProps>(function UploadDragger({ hint = "支持单个或批量上传", children, className = "", ...props }, ref) {
  return <UploadRoot {...props} ref={ref} className={`sia-upload-dragger ${className}`.trim()}>
    {children ?? <span className="sia-upload-dragger__content"><Icon name="upload" size={32} /><strong>点击或拖拽{props.directory ? "文件夹" : "文件"}到此区域上传</strong><span>{hint}</span>{props.pastable && <span>聚焦此区域后按 Ctrl / ⌘ + V 粘贴文件或截图</span>}</span>}
  </UploadRoot>;
});

/** 上传组件，支持图片列表、照片墙、目录、粘贴与完全受控请求；未配置请求时仅选择文件。 */
export const Upload = Object.assign(UploadRoot, {
  /** 可点击、键盘操作和拖拽的上传区域，ref 支持手动上传、取消及移除。 */
  Dragger: UploadDragger,
  /** beforeUpload 返回时移除该文件，不进行上传。 */
  LIST_IGNORE,
});
