import type { UploadFile, UploadProps } from "./uploadTypes";

/** 始终用本地 Blob 地址触发下载，避免浏览器忽略跨域链接的 download 属性而导航到文件。 */
export async function downloadUploadFile(file: UploadFile, request?: UploadProps["downloadRequest"]): Promise<void> {
  let blob: Blob;
  if (request) blob = await request(file);
  else if (file.url) {
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
    blob = await response.blob();
  } else if (file.originFileObj) blob = file.originFileObj;
  else throw new Error("文件缺少下载地址或原始内容");
  if (!(blob instanceof Blob)) throw new Error("下载请求必须返回 Blob 文件内容");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.hidden = true;
  document.body.append(anchor);
  try { anchor.click(); }
  finally {
    anchor.remove();
    // 浏览器读取对象 URL 是异步的，延迟释放避免刚点击就撤销下载源。
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
