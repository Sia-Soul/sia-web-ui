import { useId, useRef } from "react";
import type { ChangeEvent, DragEvent, HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

const LIST_IGNORE = Symbol("SIA_UPLOAD_LIST_IGNORE");

export type UploadFileStatus = "ready" | "uploading" | "done" | "error";

export interface UploadFile {
  uid: string;
  name: string;
  size?: number;
  type?: string;
  status?: UploadFileStatus;
  percent?: number;
  url?: string;
  response?: unknown;
  error?: unknown;
  originFileObj?: File;
}

export interface UploadRequestOptions {
  file: File;
  filename: string;
  onProgress: (percent: number) => void;
  onSuccess: (response?: unknown) => void;
  onError: (error: unknown) => void;
}

export interface UploadChangeInfo {
  file: UploadFile;
  fileList: readonly UploadFile[];
}

export interface UploadProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
  disabled?: boolean;
  maxCount?: number;
  fileList?: readonly UploadFile[];
  defaultFileList?: readonly UploadFile[];
  listType?: "text" | "picture" | "picture-card";
  showUploadList?: boolean;
  beforeUpload?: (file: File, fileList: readonly File[]) => boolean | File | typeof LIST_IGNORE | Promise<boolean | File | typeof LIST_IGNORE>;
  customRequest?: (options: UploadRequestOptions) => void | { abort?: () => void };
  onChange?: (info: UploadChangeInfo) => void;
  onRemove?: (file: UploadFile) => boolean | Promise<boolean>;
  children?: ReactNode;
}

export interface UploadDraggerProps extends UploadProps {
  hint?: ReactNode;
}

function UploadRoot({
  accept,
  multiple = false,
  directory = false,
  disabled = false,
  maxCount,
  fileList,
  defaultFileList = [],
  listType = "text",
  showUploadList = true,
  beforeUpload,
  customRequest,
  onChange,
  onRemove,
  children,
  className = "",
  onDragOver,
  onDrop,
  ...props
}: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<readonly UploadFile[]>(fileList ?? defaultFileList);
  const id = useId();
  const [files, setFiles] = useControllableState<readonly UploadFile[]>({ value: fileList, defaultValue: defaultFileList });
  filesRef.current = files;

  function emit(file: UploadFile, nextList: readonly UploadFile[]) {
    filesRef.current = nextList;
    setFiles(nextList);
    onChange?.({ file, fileList: nextList });
  }

  async function processFile(file: File, allFiles: readonly File[]) {
    const beforeResult = await beforeUpload?.(file, allFiles);
    if (beforeResult === LIST_IGNORE) return;
    if (beforeResult === false) {
      const pending: UploadFile = { uid: `${Date.now()}-${file.name}`, name: file.name, size: file.size, type: file.type, status: "ready", originFileObj: file };
      emit(pending, maxCount === 1 ? [pending] : [...filesRef.current, pending].slice(-(maxCount ?? Number.POSITIVE_INFINITY)));
      return;
    }
    const uploadFile = beforeResult instanceof File ? beforeResult : file;
    const item: UploadFile = { uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: uploadFile.name, size: uploadFile.size, type: uploadFile.type, status: "uploading", percent: 0, originFileObj: uploadFile };
    const nextList = maxCount === 1 ? [item] : [...filesRef.current, item].slice(-(maxCount ?? Number.POSITIVE_INFINITY));
    emit(item, nextList);
    const request: UploadRequestOptions = {
      file: uploadFile,
      filename: uploadFile.name,
      onProgress: (percent) => {
        const progressing = { ...item, status: "uploading" as const, percent };
        const progressList = filesRef.current.map((entry) => entry.uid === item.uid ? progressing : entry);
        emit(progressing, progressList);
      },
      onSuccess: (response) => {
        const done = { ...item, status: "done" as const, percent: 100, response };
        const completed = filesRef.current.map((entry) => entry.uid === item.uid ? done : entry);
        emit(done, completed);
      },
      onError: (error) => {
        const failed = { ...item, status: "error" as const, error };
        const completed = filesRef.current.map((entry) => entry.uid === item.uid ? failed : entry);
        emit(failed, completed);
      },
    };
    if (customRequest) customRequest(request);
    else window.setTimeout(() => request.onSuccess({ local: true }), 180);
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.currentTarget.files ?? [])];
    selected.forEach((file) => void processFile(file, selected));
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    onDrop?.(event);
    if (event.defaultPrevented || disabled) return;
    event.preventDefault();
    const selected = [...event.dataTransfer.files];
    selected.forEach((file) => void processFile(file, selected));
  }

  async function remove(file: UploadFile) {
    if (await onRemove?.(file) === false) return;
    const next = files.filter((item) => item.uid !== file.uid);
    emit({ ...file, status: "ready" }, next);
  }

  return <div
    className={`sia-upload sia-upload--${listType} ${className}`.trim()}
    onDragOver={(event) => {
      onDragOver?.(event);
      if (!event.defaultPrevented && !disabled) event.preventDefault();
    }}
    onDrop={handleDrop}
    {...props}
  >
    <input
      ref={inputRef}
      id={id}
      className="sia-upload__input"
      type="file"
      accept={accept}
      multiple={multiple}
      disabled={disabled}
      {...(directory ? { webkitdirectory: "", directory: "" } as Record<string, string> : {})}
      onChange={handleFiles}
    />
    <div className="sia-upload__trigger" onClick={() => !disabled && inputRef.current?.click()}>
      {children ?? <Button icon={<Icon name="upload" size={16} />} disabled={disabled}>选择文件</Button>}
    </div>
    {showUploadList && files.length ? <div className="sia-upload__list">
      {files.map((file) => <div className={`sia-upload__item sia-upload__item--${file.status ?? "ready"}`} key={file.uid}>
        <Icon name={file.status === "done" ? "circle-check" : "file"} size={16} />
        <span className="sia-upload__name" title={file.name}>{file.name}</span>
        {file.status === "uploading" ? <span className="sia-upload__progress"><span style={{ width: `${file.percent ?? 0}%` }} /></span> : null}
        <button type="button" aria-label={`移除 ${file.name}`} onClick={() => void remove(file)}><Icon name="close" size={14} /></button>
      </div>)}
    </div> : null}
  </div>;
}

function UploadDragger({ hint = "支持单个或批量上传", children, className = "", ...props }: UploadDraggerProps) {
  return <UploadRoot {...props} className={`sia-upload-dragger ${className}`.trim()}>
    {children ?? <div className="sia-upload-dragger__content"><Icon name="upload" size={28} /><strong>点击或拖拽文件到此区域上传</strong><span>{hint}</span></div>}
  </UploadRoot>;
}

export const Upload = Object.assign(UploadRoot, { Dragger: UploadDragger, LIST_IGNORE });
