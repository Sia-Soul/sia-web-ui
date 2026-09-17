import type { UploadHttpRequest, UploadRequestOptions, UploadRequestHandle } from "./uploadTypes";

/** 使用 XHR 获取真实上传进度；签名字段原样发送，兼容不同厂商的表单和二进制直传。 */
export function sendUploadRequest(config: UploadHttpRequest, options: UploadRequestOptions): UploadRequestHandle {
  const xhr = new XMLHttpRequest();
  const abort = () => xhr.abort();
  const cleanup = () => options.signal.removeEventListener("abort", abort);
  xhr.open(config.method ?? "POST", config.action, true);
  xhr.withCredentials = config.withCredentials ?? false;
  xhr.timeout = config.timeout ?? 0;
  for (const [name, value] of Object.entries(config.headers ?? {})) xhr.setRequestHeader(name, value);
  xhr.upload.onprogress = event => { if (event.lengthComputable) options.onProgress(event.loaded / event.total * 100); };
  xhr.onload = () => {
    cleanup();
    if (xhr.status < 200 || xhr.status >= 300) { options.onError(new Error(`上传失败：HTTP ${xhr.status}`)); return; }
    let response: unknown = xhr.responseText;
    try { response = JSON.parse(xhr.responseText); } catch { /* OSS 可返回空响应或 XML，此时保留原文。 */ }
    options.onSuccess(response, config.url);
  };
  xhr.onerror = () => { cleanup(); options.onError(new Error("上传网络错误，请检查连接与跨域配置")); };
  xhr.ontimeout = () => { cleanup(); options.onError(new Error("上传超时")); };
  xhr.onabort = cleanup;
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) { cleanup(); return { abort }; }
  try {
    if (config.body === "file") xhr.send(options.file);
    else {
      const body = new FormData();
      for (const [name, value] of Object.entries(config.data ?? {})) body.append(name, value);
      body.append(config.name ?? "file", options.file, options.filename);
      xhr.send(body);
    }
  } catch (error) { cleanup(); throw error; }
  return { abort };
}
