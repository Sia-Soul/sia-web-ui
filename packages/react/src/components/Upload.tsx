import { useId, useRef } from "react";
import type { ChangeEvent, DragEvent, HTMLAttributes, ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useControllableState } from "./shared";

const LIST_IGNORE = Symbol("SIA_UPLOAD_LIST_IGNORE");

/** UploadFile的状态类型。 */
export type UploadFileStatus = "ready" | "uploading" | "done" | "error";

/** 上传文件的状态记录，包含唯一标识、文件名、原始文件和服务端响应。 */
export interface UploadFile {
  /** 文件的唯一标识。 */
  uid: string;
  /** 名称或字段标识。 */
  name: string;
  /** 组件尺寸；用于调整控件高度、字号和间距。 */
  size?: number;
  /** 类型标识，用于选择对应的表现形式。 */
  type?: string;
  /** 当前状态，用于选择对应的状态样式。 */
  status?: UploadFileStatus;
  /** 进度百分比。 */
  percent?: number;
  /** 文件或资源的访问地址。 */
  url?: string;
  /** 上传服务返回的响应数据。 */
  response?: unknown;
  /** 错误信息或错误对象。 */
  error?: unknown;
  /** 上传前的原始 File 对象。 */
  originFileObj?: File;
}

/** UploadRequest的配置选项。 */
export interface UploadRequestOptions {
  /** 当前操作涉及的文件。 */
  file: File;
  /** 文件名。 */
  filename: string;
  /** 上传进度更新时调用。 */
  onProgress: (percent: number) => void;
  /** 上传成功时调用，接收响应数据。 */
  onSuccess: (response?: unknown) => void;
  /** 操作发生错误时调用，可用于显示业务错误提示。 */
  onError: (error: unknown) => void;
}

/** 文件上传的变更事件上下文。 */
export interface UploadChangeInfo {
  /** 当前操作涉及的文件。 */
  file: UploadFile;
  /** 受控的文件列表。 */
  fileList: readonly UploadFile[];
}

/** 文件上传的属性配置。 */
export interface UploadProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 允许的文件类型，格式同原生 input 的 accept。 */
  accept?: string;
  /**
   是否允许同时选择多个项目。
   * @defaultValue false
   */
  multiple?: boolean;
  /**
   * 是否允许选择文件夹。
   * @defaultValue false
   */
  directory?: boolean;
  /**
   * 是否禁用交互。
   * @defaultValue false
   */
  disabled?: boolean;
  /** 允许的最大文件数量。 */
  maxCount?: number;
  /** 受控的文件列表。 */
  fileList?: readonly UploadFile[];
  /**
   * 非受控模式下的初始文件列表。
   * @defaultValue []
   */
  defaultFileList?: readonly UploadFile[];
  /**
   * 上传文件列表的展示形式。
   * @defaultValue "text"
   */
  listType?: "text" | "picture" | "picture-card";
  /**
   * 是否显示上传文件列表。
   * @defaultValue true
   */
  showUploadList?: boolean;
  /** 上传前校验或转换文件 */
  beforeUpload?: (file: File, fileList: readonly File[]) => boolean | File | typeof LIST_IGNORE | Promise<boolean | File | typeof LIST_IGNORE>;
  /** 自定义上传实现 */
  customRequest?: (options: UploadRequestOptions) => void | {
  /** 取消当前上传请求。 */
  abort?: () => void };
  /** 值发生变化时调用；参数为新值及类型声明中列出的关联信息。 */
  onChange?: (info: UploadChangeInfo) => void;
  /** 请求移除文件时调用；返回值控制是否允许移除。 */
  onRemove?: (file: UploadFile) => boolean | Promise<boolean>;
  /** 子内容；组件嵌套内容或当前节点的子项。 */
  children?: ReactNode;
}

/** UploadDragger的属性配置。 */
export interface UploadDraggerProps extends UploadProps {
  /**
   * 帮助或校验信息
   * @defaultValue "支持单个或批量上传"
   */
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

/** 文件上传组件。 */
export const Upload = Object.assign(UploadRoot, {
  /** 支持拖入文件上传的区域组件。 */
  Dragger: UploadDragger,
  /** beforeUpload 返回此标记时忽略该文件，不加入上传列表。 */
  LIST_IGNORE });
