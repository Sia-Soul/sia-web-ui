# Upload 上传与业务控制

Upload、Upload.Dragger、Button、图片预览均使用 SiaWebUI 框架实现。演示页为 `/components/upload`。

## 展示与输入

- `listType="text"`：文字卡片列表，默认值。选择文件后显示“已选文件”数量标题，每项使用至少 72px 高的卡片，展示文件图标、文件名和状态；仅选择时显示“已选择”，实际上传成功才显示“上传完成”。窄屏操作按钮另起一行，长文件名省略并可通过提示查看完整名称。
- `listType="picture"`：带缩略图的图片行，显示进度与失败状态。
- `listType="picture-card"`：照片墙，支持本地缩略图及预览；达到 `maxCount` 后隐藏添加入口，移除后恢复。
- `multiple`：允许每批多个文件，默认 false；`directory` 模式始终读取多文件。
- `pastable`：默认 false。开启后在上传区域或其中的按钮获得焦点时粘贴截图、剪贴板文件；不会监听其他页面区域。
- `directory`：开启选择文件夹和拖拽目录。`recursive` 默认为 true；设为 false 时只读所选根目录的直接文件。空目录不生成上传项。
- `relativePath`：保存包含根目录的相对路径，例如 `photos/2026/a.png`；业务可将它转换为对象存储 key。
- `accept` 对点击、拖拽、粘贴均生效；数量上限包含 ready、uploading、done 和 error 项。拒绝文件通过 `onReject` 通知，目录读取失败通过 `onReadError` 通知。

文件夹选择依赖浏览器的 `webkitdirectory`，拖入文件夹依赖目录条目 API。不支持目录条目的浏览器只能处理其 `DataTransfer.files` 提供的文件。剪贴板普通文本不会被当作文件上传。

Upload.Dragger 的默认拖拽内容在文字或图片列表非空且可见时，将最小高度从 170px 收紧到 104px，同时缩小图标、内边距和间距，让已选文件更突出；清空文件或隐藏列表后恢复。长提示可自然撑高区域，自定义 children 由业务控制布局。

## 完全受控与手动上传

```tsx
import { useRef, useState } from "react";
import { Button, Upload } from "@sia.soul/sia-react-ui";
import type { UploadFile, UploadRef } from "@sia.soul/sia-react-ui";

function ManualUpload() {
  const ref = useRef<UploadRef>(null);
  const [files, setFiles] = useState<readonly UploadFile[]>([]);
  return <>
    <Upload ref={ref} multiple autoUpload={false}
      fileList={files}
      onChange={({ fileList, event }) => {
        // 受控列表应回填，包括进度、失败及取消事件。
        setFiles(fileList);
        console.log(event);
      }}
      request={{ action: "/api/files", method: "POST" }}
    />
    <Button onClick={() => void ref.current?.upload()}>开始全部</Button>
    <Button onClick={() => ref.current?.abort()}>取消全部</Button>
  </>;
}
```

- `upload(uid?)`：启动或重试 ready/error 项，省略 uid 操作全部；不会重传 done 项。已在运行的任务复用同一个完成 Promise；Promise 在任务成功、失败或取消后完成，失败结果由 `onChange` 的 error 记录通知。
- `abort(uid?)`：取消并保留为 ready，可重新上传。信号与 SDK 句柄都会中止，迟到回调不会覆盖重试后的状态。
- `remove(uid)`：等待 `onRemove`；返回 false 或 Promise 拒绝则保留文件，否则取消并删除。
- 外部通过 `fileList` 删除项时也会取消。没有 `originFileObj` 的回显记录只参与展示，不能通过 ref 发起上传。
- `showUploadList={false}` 隐藏内置列表；业务可完全自行呈现受控文件列表。
- `itemRender(defaultNode, file, files, actions)` 可重绘列表项；`actions` 提供单项 upload、abort、remove、preview。
- `onPreview(file)` 接管默认图片预览，可展示 PDF、视频或业务弹窗。

## 校验与转换

`beforeUpload(file, files)` 在任务启动前执行。它可以异步返回：

- true：继续。
- false：保留 ready 状态，不发起请求。
- `Upload.LIST_IGNORE`：删除当前待校验项，不上传。
- 新 File：用转换结果发起本次请求，例如压缩或加水印；原始文件保留用于预览和重试。
- 抛异常或拒绝 Promise：进入 error，可通过 upload 重试。

手动模式直到调用 upload 才进行这项校验。任务开始时先登记列表与取消令牌，异步校验期间也允许取消。

## OSS 与 HTTP 上传

`request` 可为静态配置，也可为 `(file, signal) => config | Promise<config>`，适合逐文件获取服务端签名。

```tsx
<Upload request={async (file, signal) => {
  const response = await fetch("/api/upload/sign", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, path: file.relativePath, type: file.type }),
  });
  if (!response.ok) throw new Error("获取签名失败");
  const signed = await response.json();
  return {
    action: signed.uploadUrl,
    method: "PUT", body: "file",
    headers: signed.headers, url: signed.publicUrl,
  };
}} />
```

签名 POST 表单使用 `body: "form-data"`（默认）、`method: "POST"`（默认）、`data: signed.fields` 和 `name: "file"`（默认）。字段会先于文件添加，适用于 OSS/COS/S3 等签名表单和以令牌字段鉴权的服务。不要手动填写 multipart Content-Type，浏览器需要生成 boundary。

`headers`、`withCredentials` 和 `timeout` 支持普通 HTTP 上传；withCredentials 默认 false，timeout 默认 0 毫秒。2xx 视为成功，响应优先解析 JSON，否则保留文本（兼容空响应与 XML）；其他状态、网络错误及超时均进入 error。

签名由业务后端生成，云存储需配置允许业务域名、请求方法及签名要求的请求头。组件不持有长期云密钥，也不内置某个厂商的账号或签名算法。

## 自定义请求、分片及断点续传

`customRequest(options)` 优先于 `request`。业务负责调用 `onProgress(0–100)`、`onSuccess(response, url?)` 或 `onError(error)`；直接返回的 Promise 完成不代表上传成功，仍需调用状态回调。同步异常与 Promise 拒绝自动进入 error。

可同步或异步返回 `{ abort() {} }`，并应把 `options.signal` 传入获取签名或上传请求。若 SDK 初始化期间已取消，后续返回的 abort 句柄也会立即执行。`options.uploadFile.uid` 可关联自己的任务、分片与持久化记录；分片调度、断点存储及续传策略由业务实现。

## 行为调整

旧版没有请求配置时会延时模拟成功；现在仅保留 ready，避免误导用户认为文件已发送。示例页显式提供本地模拟请求，并注明不发送网络请求。`maxCount` 现在拒绝超出的文件，不再裁剪列表并静默替换已有项（包括 maxCount=1）。

<!-- 历史数据回填兼容：对象 URL 只用于浏览器真实文件。 -->
已保存附件的 `originFileObj` 若经 JSON 序列化成为普通对象，缩略图忽略该对象并沿用远程 `url`；真实 Blob/File 仍创建对象 URL，并在替换或卸载时释放。
