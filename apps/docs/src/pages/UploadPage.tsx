import { useRef, useState } from "react";
import { Button, Checkbox, Space, Upload, message } from "@sia.soul/sia-react-ui";
import type { UploadFile, UploadRef, UploadRequestOptions } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

// 使用本地矢量样图演示预览，页面不依赖外部图床或真实云存储凭据。
const sampleImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" fill="#dbeafe"/><circle cx="180" cy="42" r="22" fill="#fbbf24"/><path d="M0 150 75 48 140 132 180 92 240 155V180H0" fill="#588c7e"/><path d="m40 180 90-90 110 90" fill="#2d5f68"/></svg>')}`;
const initialPictures: UploadFile[] = [
  { uid: "sample-1", name: "山间日落.svg", type: "image/svg+xml", status: "done", url: sampleImage },
  { uid: "sample-2", name: "旅行纪念.svg", type: "image/svg+xml", status: "done", url: sampleImage, thumbUrl: sampleImage },
  { uid: "sample-3", name: "上传示例.png", type: "image/png", status: "uploading", percent: 48 },
  { uid: "sample-4", name: "失败示例.png", type: "image/png", status: "error" },
];

/** 仅用于演示进度和取消，不发送网络请求；实际项目应替换为 request 或自己的 SDK。 */
function demoRequest({ onProgress, onSuccess, signal }: UploadRequestOptions) {
  let percent = 0;
  const stop = () => { window.clearInterval(timer); signal.removeEventListener("abort", stop); };
  const timer = window.setInterval(() => {
    percent += 20;
    onProgress(percent);
    if (percent >= 100) { stop(); onSuccess({ demo: true }); }
  }, 250);
  signal.addEventListener("abort", stop, { once: true });
  return { abort: stop };
}

const ossCode = `// 后端返回逐文件签名，前端不保存云存储长期密钥。
<Upload multiple request={async (file, signal) => {
  const response = await fetch('/api/upload/sign', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, path: file.relativePath, type: file.type }),
  });
  if (!response.ok) throw new Error('获取上传签名失败');
  const signed = await response.json();
  return {
    action: signed.uploadUrl, method: 'PUT', body: 'file',
    headers: signed.headers, url: signed.publicUrl,
  };
}} />

// OSS/COS/S3 表单签名、七牛等使用服务端返回的字段。
<Upload request={async (file, signal) => {
  const response = await fetch('/api/upload/form-sign', { signal });
  if (!response.ok) throw new Error('获取表单签名失败');
  const signed = await response.json();
  return { action: signed.host, method: 'POST', body: 'form-data',
    data: signed.fields, name: 'file', url: signed.publicUrl };
}} />`;
const controlledCode = `const uploadRef = useRef<UploadRef>(null);
const [files, setFiles] = useState<readonly UploadFile[]>([]);
<Upload ref={uploadRef} multiple autoUpload={false}
  fileList={files} onChange={({ fileList }) => setFiles(fileList)}
  customRequest={options => {
    // 可在这里调用分片/断点续传 SDK；传入 signal 并返回 abort。
    return yourUploader(options.file, {
      signal: options.signal,
      onProgress: options.onProgress,
      onSuccess: options.onSuccess,
      onError: options.onError,
    });
  }}
/>
<Button onClick={() => uploadRef.current?.upload()}>开始全部</Button>
<Button onClick={() => uploadRef.current?.abort()}>取消全部</Button>
// upload(uid) 重试单个 ready/error 文件；remove(uid) 遵循 onRemove。
// itemRender 可重绘完整列表项；onPreview 可接管 PDF、视频等预览。`;

/** 上传能力演示：图片区分状态，文件入口统一校验，手动模式保留业务控制权。 */
export function UploadPage() {
  const uploadRef = useRef<UploadRef>(null);
  const [recursive, setRecursive] = useState(true);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  const [paths, setPaths] = useState<readonly UploadFile[]>([]);
  return <ComponentDocPage eyebrow="组件 / 数据录入 / Upload" title="Upload 上传" description="照片墙、图片列表、拖拽粘贴、目录上传与完全受控的 OSS 请求。" name="Upload" apiRows={[
    { property: "listType", description: "文件列表、图片行或照片墙；照片墙满额隐藏添加按钮", type: "text | picture | picture-card", defaultValue: "text" },
    { property: "cardSize", description: "照片墙卡片宽高，单位 px；数字为正方形，对象分别设置宽高。每边最小 48px，宽或高小于 88px 时隐藏文件名", type: "number | { width?: number; height?: number }", defaultValue: "112" },
    { property: "multiple / maxCount / accept", description: "批量、总数量和类型限制；拖拽、粘贴同样校验，超限触发 onReject", type: "boolean / number / string", defaultValue: "false / 不限 / 不限" },
    { property: "directory / recursive", description: "目录上传及是否包含子文件夹，路径保存在 relativePath", type: "boolean / boolean", defaultValue: "false / true" },
    { property: "pastable", description: "焦点在上传区域内时接收剪贴板文件和截图", type: "boolean", defaultValue: "false" },
    { property: "fileList / defaultFileList", description: "受控列表需在 onChange 回填；外部删除会中止请求", type: "UploadFile[]", defaultValue: "[]" },
    { property: "autoUpload / ref", description: "手动模式使用 upload(uid?)、abort(uid?)、remove(uid)", type: "boolean / UploadRef", defaultValue: "true" },
    { property: "beforeUpload", description: "启动前可异步校验或转换；false 待上传、LIST_IGNORE 移除、异常失败", type: "(file, files) => boolean | File | symbol | Promise", defaultValue: "-" },
    { property: "request", description: "静态 HTTP 配置或逐文件异步签名；支持 multipart 和二进制直传", type: "UploadHttpRequest | (file, signal) => config | Promise", defaultValue: "仅选择文件" },
    { property: "customRequest", description: "覆盖 HTTP 上传，支持 SDK/分片任务，回调状态并返回取消句柄", type: "(options) => void | UploadRequestHandle | Promise", defaultValue: "-" },
    { property: "onChange / onRemove", description: "列表及事件原因通知；移除可异步阻止", type: "回调", defaultValue: "-" },
    { property: "itemRender / onPreview", description: "完全自定义列表项及预览；操作句柄支持预览、下载、取消和删除。图片默认弹层预览，其他文件交给浏览器查看", type: "回调", defaultValue: "默认列表 / 内置预览" },
    { property: "downloadRequest", description: "自定义获取 Blob，用于鉴权、OSS 签名或代理；默认请求 url，无 url 则使用本地原文件。通过 Blob 触发浏览器下载，不打开新标签页；跨域地址需支持 CORS，失败时提示错误", type: "(file: UploadFile) => Blob | Promise<Blob>", defaultValue: "内置下载" },
    { property: "onReject / onReadError", description: "文件类型、数量拒绝与目录读取失败通知", type: "回调", defaultValue: "-" },
    { property: "onChoose", description: "点击或键盘激活上传入口时调用；返回 false 接管为业务弹框，不打开系统选择器", type: "() => boolean | void", defaultValue: "-" },
  ]}>
    <DemoCard title="接管上传入口" description="复用原生上传卡片，由业务打开上传弹框；示例仅提示，不读取文件。返回 false 可阻止系统文件选择器。" code={'<Upload listType="picture-card" onChoose={() => { setUploadOpen(true); return false; }} />'}>
      <Upload listType="picture-card" onChoose={() => { message.info("业务可在此打开上传弹框"); return false; }} />
    </DemoCard>
    <DemoCard title="照片墙" description="悬停或键盘焦点进入卡片后，预览、下载与移除按钮居中浮动显示；触屏始终显示。下载按文件名保存，最多 6 张，新增文件使用本地模拟进度。" code={'<Upload listType="picture-card" accept="image/*" multiple maxCount={6} customRequest={yourUploader} />'}>
      <Upload aria-label="照片墙" listType="picture-card" accept="image/*" multiple maxCount={6} defaultFileList={initialPictures} customRequest={demoRequest} onReject={({ reason }) => message.warning(reason === "accept" ? "请选择图片" : "最多 6 张图片")} />
    </DemoCard>
    <DemoCard title="卡片尺寸" description="数字设置正方形尺寸，也可分别设置宽高。操作栏相对卡片水平、垂直居中，超出小卡片的部分保持完整显示。" code={'<Upload listType="picture-card" cardSize={56} />\n<Upload listType="picture-card" cardSize={{ width: 160, height: 120 }} />'}>
      <Space direction="vertical">
        <Upload listType="picture-card" cardSize={56} defaultFileList={initialPictures.slice(0, 2)} />
        <Upload listType="picture-card" cardSize={{ width: 160, height: 120 }} defaultFileList={initialPictures.slice(0, 2)} />
      </Space>
    </DemoCard>
    <DemoCard title="图片列表" description="支持缩略图、预览、下载及上传状态；预览大图自动适应窗口，底部工具条提供翻转、旋转、缩放和重置。" code={'<Upload listType="picture" accept="image/*" multiple customRequest={yourUploader} />'}>
      <Upload aria-label="图片列表" listType="picture" multiple accept="image/*" defaultFileList={initialPictures.slice(1)} customRequest={demoRequest} />
    </DemoCard>
    <DemoCard title="拖拽与粘贴上传" description="点击、拖入文件或聚焦区域后粘贴截图。限制图片和 PDF，最多 5 项；演示使用本地模拟请求。" code={'<Upload.Dragger multiple pastable accept="image/*,.pdf" maxCount={5} customRequest={yourUploader} />'}>
      <Upload.Dragger aria-label="拖拽与粘贴上传" multiple pastable accept="image/*,.pdf" maxCount={5} customRequest={demoRequest} onReject={({ file }) => message.warning(`${file.name} 不符合类型或数量限制`)} />
    </DemoCard>
    <DemoCard title="文件夹上传" description="默认包含子文件夹；取消勾选后只读取所选根目录的直接文件。此示例仅选择文件，不发起上传。" code={'<Upload.Dragger directory recursive={includeSubfolders} onChange={({ fileList }) => setFiles(fileList)} />'}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Checkbox checked={recursive} onChange={setRecursive}>包含子文件夹</Checkbox>
        <Upload.Dragger aria-label="文件夹上传" directory recursive={recursive} fileList={paths} onChange={({ fileList }) => setPaths(fileList)} onReadError={() => message.error("文件夹读取失败，请重新选择")} hint="支持选择或拖入文件夹，保留相对路径" />
        {paths.length > 0 && <div style={{ maxHeight: 180, overflow: "auto", width: "100%" }}>{paths.map(file => <div key={file.uid}>{file.relativePath}</div>)}</div>}
      </Space>
    </DemoCard>
    <DemoCard title="完全控制上传" description="选择后先保留在列表，由按钮启动。可单项重试、取消、异步删除和重绘列表；此示例使用模拟请求。" code={controlledCode}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Upload aria-label="手动上传" ref={uploadRef} multiple autoUpload={false} fileList={files} onChange={({ fileList }) => setFiles(fileList)} customRequest={demoRequest}
          itemRender={(node, file, _files, actions) => <div key={file.uid} style={{ borderBottom: "1px solid var(--sia-color-border)", paddingBottom: 8 }}>
            {node}<Space><Button size="small" disabled={file.status === "uploading" || file.status === "done"} onClick={() => void actions.upload()}>{file.status === "error" ? "重试" : "上传"}</Button><Button size="small" disabled={file.status !== "uploading"} onClick={actions.abort}>取消</Button></Space>
          </div>} />
        <Space><Button variant="primary" disabled={!files.some(file => file.status === "ready" || file.status === "error")} onClick={() => void uploadRef.current?.upload()}>开始全部</Button><Button disabled={!files.some(file => file.status === "uploading")} onClick={() => uploadRef.current?.abort()}>取消全部</Button></Space>
      </Space>
    </DemoCard>
    <DemoCard title="OSS 与自定义上传" description="通过后端签名配置接入阿里云 OSS、腾讯云 COS、S3 兼容存储或其他 HTTP 上传服务。示例不配置真实云账号；服务器需允许上传域名跨域访问。" code={ossCode}>
      <p>支持预签名 PUT、签名表单 POST、自定义请求头和文件字段。更复杂的 SDK、分片、断点续传通过 customRequest 接入；通过 signal 与返回的 abort 取消。</p>
      <p>未提供 request 或 customRequest 时仅选择文件，状态保持 ready。凭据与签名由服务端管理，不将长期密钥写入前端。</p>
    </DemoCard>
  </ComponentDocPage>;
}
