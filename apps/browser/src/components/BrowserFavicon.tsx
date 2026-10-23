import { useEffect, useState } from "react";
import { Icon } from "@sia.soul/sia-react-ui";

interface BrowserFaviconProps {
  url: string;
  /** 当前文档的原生 PNG 数据地址；空字符串使用品牌图标，未设置时尝试根目录图标。 */
  faviconUrl?: string;
  loading?: boolean;
  size?: number;
}

function resolveFaviconUrl(url: string) {
  if (!url) return "";
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return "";
    return new URL("/favicon.ico", parsedUrl.origin).href;
  } catch {
    return "";
  }
}

interface BrowserBrandGlyphProps {
  /** 显示高度，单位 px，默认 15；方形图标宽高相同，签名字标宽度按比例增加。 */
  size?: number;
  /** 是否使用透明横向 S1-E 签名；默认 false，标签等小尺寸位置使用透明方形画布。 */
  wordmark?: boolean;
}

/** 显示 S1-E 品牌资源；标题栏与内部页可选横向签名，缺少站点图标的标签保持方形占位。 */
export function BrowserBrandGlyph({ size = 15, wordmark = false }: BrowserBrandGlyphProps) {
  const width = wordmark ? Math.round(size * 1.6) : size;
  return (
    <img
      className={`browser-brand-glyph${wordmark ? " browser-brand-glyph--wordmark" : ""}`}
      src={wordmark ? "/brand/sia-wordmark.png" : "/brand/sia-browser-small.png"}
      // 按实际显示尺寸与屏幕像素密度选图，避免高 DPI 标题栏放大低分辨率资源。
      srcSet={wordmark ? "/brand/sia-wordmark.png 512w" : "/brand/sia-browser-small.png 64w, /brand/sia-browser.png 256w"}
      sizes={`${width}px`}
      width={width}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}

export default function BrowserFavicon({ url, faviconUrl: nativeFavicon, loading = false, size = 15 }: BrowserFaviconProps) {
  // 只接受内核转出的 PNG，不把远程网页提交的任意地址作为外壳资源加载。
  const faviconUrl = nativeFavicon === undefined ? resolveFaviconUrl(url)
    : nativeFavicon.startsWith("data:image/png;base64,") ? nativeFavicon : "";
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => {
    setFailedUrl("");
    // 同域跳转或重新加载完成后允许再次尝试旧版根目录回退图标。
  }, [faviconUrl, url, loading]);

  if (loading) return <Icon name="loader" size={size} spin />;
  if (!faviconUrl || failedUrl === faviconUrl) return <BrowserBrandGlyph size={size} />;

  return (
    <img
      className="browser-page-favicon"
      src={faviconUrl}
      width={size}
      height={size}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(faviconUrl)}
    />
  );
}
