import { useEffect, useState } from "react";
import { Icon } from "@sia-ui/react";

interface BrowserFaviconProps {
  url: string;
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

export function BrowserBrandGlyph({ size = 15 }: { size?: number }) {
  return (
    <span
      className="browser-brand-glyph"
      style={{ fontSize: `${size}px` }}
      aria-hidden="true"
    >
      S
    </span>
  );
}

export default function BrowserFavicon({ url, loading = false, size = 15 }: BrowserFaviconProps) {
  const faviconUrl = resolveFaviconUrl(url);
  const [failedUrl, setFailedUrl] = useState("");

  useEffect(() => {
    setFailedUrl("");
  }, [faviconUrl]);

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
