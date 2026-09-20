import type { HTMLAttributes, ReactNode } from "react";

/** ready 为待上传，uploading 为进行中，done 为成功，error 为校验或网络失败。 */
export type UploadFileStatus = "ready" | "uploading" | "done" | "error";
/** 文件记录；受控更新时应保持 uid 不变。 */
export interface UploadFile {
  /** 列表中唯一的文件标识。 */
  uid: string;
  /** 显示文件名，不含目录。 */
  name: string;
  /** 文件大小，单位字节。 */
  size?: number;
  /** MIME 类型，例如 image/png。 */
  type?: string;
  /** 当前状态，缺省按 ready 展示。 */
  status?: UploadFileStatus;
  /** 上传百分比，范围 0–100。 */
  percent?: number;
  /** 远程访问地址，用于预览及下载；图片通过 MIME、文件名或 URL 后缀识别，无类型及后缀时可用仅包含图片的 accept 声明启用缩略图和内置预览。默认下载会 fetch 为 Blob，跨域地址需要服务端允许 CORS。 */
  url?: string;
  /** 缩略图地址，优先于本地缩略图；预览优先使用 url。 */
  thumbUrl?: string;
  /** 包含所选根目录的相对路径，例如 photos/trip/a.png；普通文件为文件名。 */
  relativePath?: string;
  /** 服务端成功响应；内置请求优先解析 JSON，否则保留文本。 */
  response?: unknown;
  /** 最近一次校验或上传错误。 */
  error?: unknown;
  /** 原始 File，用于本地预览与重试；beforeUpload 转换只影响当次请求。 */
  originFileObj?: File;
}
/** 自定义上传参数，可用于 SDK、分片、断点续传或业务请求。 */
export interface UploadRequestOptions {
  /** 已经 beforeUpload 转换的实际上传文件。 */
  file: File;
  /** 文件名，不是 multipart 字段名。 */
  filename: string;
  /** 本次上传的列表记录快照，uid 可关联业务任务。 */
  uploadFile: UploadFile;
  /** 相对路径；普通文件为文件名。 */
  relativePath: string;
  /** 取消、移除或卸载时中止；获取签名及分片请求也应监听此信号。 */
  signal: AbortSignal;
  /** 更新百分比 0–100；任务结束或取消后的回调会被忽略。 */
  onProgress: (percent: number) => void;
  /** 上传完成时调用一次，保存 response；url 可指定访问地址。 */
  onSuccess: (response?: unknown, url?: string) => void;
  /** 失败时调用一次，保存错误并通知 onChange。 */
  onError: (error: unknown) => void;
}
/** 上传取消句柄，与 signal 一起用于中止底层任务。 */
export interface UploadRequestHandle {
  /** 取消、移除或卸载时调用；应终止 SDK 或分片上传。 */
  abort?: () => void;
}
/** 通用 HTTP 上传配置，支持业务接口、OSS 签名表单和预签名 PUT。 */
export interface UploadHttpRequest {
  /** 上传地址；签名应由业务服务端生成。 */
  action: string;
  /** 请求方法，预签名二进制直传通常使用 PUT。 @defaultValue "POST" */
  method?: "POST" | "PUT" | "PATCH";
  /** form-data 为 multipart 表单，file 为 File 二进制。 @defaultValue "form-data" */
  body?: "form-data" | "file";
  /** multipart 文件字段名。 @defaultValue "file" */
  name?: string;
  /** multipart 额外字段，在文件之前添加，例如 key、policy、签名和令牌。 */
  data?: Readonly<Record<string, string | Blob>>;
  /** 自定义请求头，需与签名一致；multipart 不要手动设置 Content-Type。 */
  headers?: Readonly<Record<string, string>>;
  /** 是否携带跨域 Cookie。 @defaultValue false */
  withCredentials?: boolean;
  /** 超时毫秒数，0 为不设超时。 @defaultValue 0 */
  timeout?: number;
  /** 成功后写入文件记录的访问地址。 */
  url?: string;
}
/** 文件列表变化的上下文。 */
export interface UploadChangeInfo {
  /** 本次变化的文件；移除时仍提供被移除的记录。 */
  file: UploadFile;
  /** 最新完整列表，受控模式需回填给 fileList。 */
  fileList: readonly UploadFile[];
  /** 触发原因：添加、开始、进度、成功、失败、移除或取消。 */
  event: "add" | "start" | "progress" | "success" | "error" | "remove" | "cancel";
}
/** 类型或数量限制拒绝的文件。 */
export interface UploadRejectInfo {
  /** 未加入列表的原始文件。 */
  file: File;
  /** accept 为类型不匹配，max-count 为达到数量上限。 */
  reason: "accept" | "max-count";
}
/** 自定义列表项可调用的操作，仍遵循禁用、取消和 onRemove 规则。 */
export interface UploadItemActions {
  /** 开始或重试当前文件；已上传成功或正在上传时不重复启动。 */
  upload: () => Promise<void>;
  /** 取消当前任务并回到 ready，保留文件。 */
  abort: () => void;
  /** 请求移除，等待 onRemove 允许后取消并删除。 */
  remove: () => Promise<void>;
  /** 触发自定义 onPreview；默认图片使用框架预览，其他文件在新标签页交给浏览器查看。 */
  preview: () => void;
  /** 获取文件 Blob 并按文件名触发浏览器下载，不打开新标签页；优先 downloadRequest，其次 url，最后 originFileObj。失败时 Promise 拒绝，自定义列表需自行处理。 */
  download: () => Promise<void>;
}
/** Upload 的命令式句柄，适用于手动上传及业务工具栏。 */
export interface UploadRef {
  /** 开始 ready/error 文件；省略 uid 开始所有待上传项。Promise 在这些任务成功、失败或取消后完成，结果通过 onChange 通知。 */
  upload: (uid?: string) => Promise<void>;
  /** 取消指定文件，省略 uid 取消全部；保留记录为 ready，可再次 upload。 */
  abort: (uid?: string) => void;
  /** 请求移除指定文件；onRemove 拒绝时保留记录。 */
  remove: (uid: string) => Promise<void>;
}
/** 文件上传属性；未配置 request/customRequest 时仅选择文件，不模拟上传成功。 */
export interface UploadProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 扩展名或 MIME 类型，逗号分隔；点击、拖拽和粘贴均校验。 */
  accept?: string;
  /** 每批是否允许多个文件；false 仅取首个，directory 模式不受此限制。 @defaultValue false */
  multiple?: boolean;
  /** 选择或拖入文件夹，文件路径保存在 relativePath；不会上传空目录。 @defaultValue false */
  directory?: boolean;
  /** 是否包括子文件夹中的文件；false 仅处理根目录直接包含的文件。 @defaultValue true */
  recursive?: boolean;
  /** 聚焦本区域后允许粘贴文件或截图，不监听整个页面也不处理普通文本。 @defaultValue false */
  pastable?: boolean;
  /** 禁止添加、移除和启动上传；已在进行的请求不会自动取消。 @defaultValue false */
  disabled?: boolean;
  /** 添加后自动上传；false 为手动模式，调用 ref.upload 或自定义列表操作启动。 @defaultValue true */
  autoUpload?: boolean;
  /** 最大文件数量，包含等待及失败项；超出部分拒绝，不替换已有文件。默认不限。 */
  maxCount?: number;
  /** 受控列表，onChange 中回填；外部移除记录会取消关联请求。 */
  fileList?: readonly UploadFile[];
  /** 非受控初始列表，后续修改不重置列表。 @defaultValue [] */
  defaultFileList?: readonly UploadFile[];
  /** 文件列表样式：text 为文字列表，picture 为带缩略图的图片列表，picture-card 为照片墙。 @defaultValue "text" */
  listType?: "text" | "picture" | "picture-card";
  /** 照片墙卡片尺寸，仅 listType="picture-card" 生效；数字设置正方形，对象分别设置宽高，单位 px。默认 112×112，各边最小 48，无效数值使用默认值；宽或高小于 88px 时隐藏文件名。 */
  cardSize?: number | {
    /** 卡片宽度，默认 112px，最小 48px。 */
    width?: number;
    /** 卡片高度，默认 112px，最小 48px。 */
    height?: number;
  };
  /** 是否显示列表；隐藏时仍执行数量限制和变更通知。 @defaultValue true */
  showUploadList?: boolean;
  /** 启动前校验，可异步；false 保留 ready，Upload.LIST_IGNORE 移除，File 转换本次上传内容；拒绝或抛错进入 error。手动上传时在调用 upload 后执行。 */
  beforeUpload?: (file: File, fileList: readonly File[]) => boolean | File | symbol | Promise<boolean | File | symbol>;
  /** HTTP 配置或逐文件异步签名函数，拒绝时进入 error；接收记录和取消信号。customRequest 优先。 */
  request?: UploadHttpRequest | ((file: UploadFile, signal: AbortSignal) => UploadHttpRequest | Promise<UploadHttpRequest>);
  /** 自定义上传，负责调用状态回调，可异步返回取消句柄；函数异常或 Promise 拒绝按失败处理。优先于 request。 */
  customRequest?: (options: UploadRequestOptions) => void | UploadRequestHandle | Promise<void | UploadRequestHandle>;
  /** 添加、开始、进度、完成、失败、取消和移除时调用；取消任务的迟到回调被忽略。 */
  onChange?: (info: UploadChangeInfo) => void;
  /** 移除前调用；false 或 Promise 拒绝阻止移除，否则取消任务并删除。 */
  onRemove?: (file: UploadFile) => boolean | void | Promise<boolean | void>;
  /** 文件类型不匹配或数量超限时调用，该文件不进入列表。 */
  onReject?: (info: UploadRejectInfo) => void;
  /** 拖拽目录读取失败时调用，本次批次不上传。 */
  onReadError?: (error: unknown) => void;
  /** 点击预览时调用，提供后完全接管预览；默认图片使用框架预览，其他文件在新标签页交给浏览器查看，不支持的格式由浏览器处理。 */
  onPreview?: (file: UploadFile) => void;
  /** 点击下载时获取实际文件内容，返回 Blob 或 Promise<Blob>，可用于鉴权请求、OSS 签名或代理接口；组件仍负责按 file.name 触发浏览器下载。未提供时 fetch(file.url)，无 url 时使用 originFileObj；跨域请求需允许 CORS。抛错或拒绝时默认列表显示失败消息，不回退到打开新标签页。 */
  downloadRequest?: (file: UploadFile) => Blob | Promise<Blob>;
  /** 完全自定义列表项；接收默认节点、记录、最新列表及操作句柄，应自行提供可访问的按钮。 */
  itemRender?: (node: ReactNode, file: UploadFile, fileList: readonly UploadFile[], actions: UploadItemActions) => ReactNode;
  /** 上传按钮内容，不应嵌套其他交互控件；外层负责点击和键盘操作。 */
  children?: ReactNode;
  /** 点击或键盘激活上传入口时同步调用；返回 false 阻止打开系统文件选择器，可用于打开业务上传弹框。默认打开系统选择器。禁用或已达数量上限时不调用，不影响拖拽与粘贴。 */
  onChoose?: () => boolean | void;
}
/** 拖拽区域继承全部 Upload 能力，ref 同样支持手动控制。 */
export interface UploadDraggerProps extends UploadProps {
  /** 辅助说明文字。 @defaultValue "支持单个或批量上传" */
  hint?: ReactNode;
}
