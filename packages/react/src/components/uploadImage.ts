import type { UploadFile } from "./uploadTypes";

const imageExtension = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico|apng)$/i;

/** 判断文件是否应使用图片缩略图及内置预览；无类型、无后缀的远程地址可由纯图片 accept 声明补充识别。 */
export function isUploadImage(file: UploadFile | undefined, accept?: string): boolean {
  if (!file) return false;
  if (file.thumbUrl) return true;
  const type = (file.type || file.originFileObj?.type || "").toLowerCase();
  // 已知非图片 MIME 不受 accept 影响；通用二进制类型仍允许通过地址或图片声明判断。
  if (type && type !== "application/octet-stream") return type.startsWith("image/");
  if (/^data:image\//i.test(file.url || "")) return true;
  let pathname = "";
  try { pathname = new URL(file.url || "", "https://upload.invalid").pathname; } catch { /* 无效地址交给加载失败回退。 */ }
  if (imageExtension.test(file.name) || imageExtension.test(pathname)) return true;
  const rules = (accept || "").split(",").map(rule => rule.trim().toLowerCase()).filter(Boolean);
  // 仅在调用方明确限制为图片时尝试无后缀 URL；加载失败仍由列表回退到文件图标。
  return Boolean(file.url) && rules.length > 0 && rules.every(rule => rule.startsWith("image/") || imageExtension.test(rule));
}
