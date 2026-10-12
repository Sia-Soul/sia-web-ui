import { withTitleTooltip } from "./titleTooltip";
import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { extendedIconPaths } from "./IconCatalog";
import { filledIconBounds, outlineIconBounds } from "./iconBounds";
import { normalizeIconPaths } from "./iconGeometry";

const coreIconPaths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  // 数字区间用波浪线表达范围，避免箭头暗示跳转方向。
  tilde: <path d="M3 14c3-8 6-4 9-2s6 4 9-2" />,
  minus: <path d="M4 12h16" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  check: <path d="m4 12.5 5.2 5L20 6.5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.2v.1" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.2c-.9.5-1.3 1.1-1.3 2.1M12 16.8v.1" /></>,
  warning: <><path d="M10.3 4.1 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 4.1a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17v.1" /></>,
  "circle-check": <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.7 2.7L16.5 9" /></>,
  "circle-close": <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  "circle-plus": <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  "circle-minus": <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
  "chevron-left": <path d="m15.5 5-7 7 7 7" />,
  "chevron-right": <path d="m8.5 5 7 7-7 7" />,
  "chevron-up": <path d="m5 15.5 7-7 7 7" />,
  "chevron-down": <path d="m5 8.5 7 7 7-7" />,
  "double-left": <><path d="m12 5-7 7 7 7" /><path d="m19 5-7 7 7 7" /></>,
  "double-right": <><path d="m5 5 7 7-7 7" /><path d="m12 5 7 7-7 7" /></>,
  "arrow-left": <><path d="m10 5-7 7 7 7" /><path d="M3 12h18" /></>,
  "arrow-right": <><path d="m14 5 7 7-7 7" /><path d="M3 12h18" /></>,
  "arrow-up": <><path d="m5 10 7-7 7 7" /><path d="M12 3v18" /></>,
  "arrow-down": <><path d="m5 14 7 7 7-7" /><path d="M12 3v18" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  "more-horizontal": <path d="M5 12h.1M12 12h.1M19 12h.1" />,
  "more-vertical": <path d="M12 5v.1M12 12v.1M12 19v.1" />,
  home: <><path d="m3.5 11 8.5-7 8.5 7" /><path d="M5.5 9.5V20h13V9.5M9.5 20v-6h5v6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.8 20c.6-3.8 2.7-5.8 6.2-5.8s5.6 2 6.2 5.8" /><path d="M15 5.2a3.5 3.5 0 0 1 0 6.6M16.2 14.5c2.9.5 4.4 2.3 4.9 5.5" /></>,
  // 保留齿轮原始路径；与其余图标一起通过统一几何规则调整主体大小。
  settings: <><circle cx="12" cy="12" r="2.8" /><path d="M10.4 6.24 10.4 4 13.6 4 13.6 6.24 14.944 6.792 16.528 5.208 18.792 7.472 17.208 9.056 17.76 10.4 20 10.4 20 13.6 17.76 13.6 17.208 14.944 18.792 16.528 16.528 18.792 14.944 17.208 13.6 17.76 13.6 20 10.4 20 10.4 17.76 9.056 17.208 7.472 18.792 5.208 16.528 6.792 14.944 6.24 13.6 4 13.6 4 10.4 6.24 10.4 6.792 9.056 5.208 7.472 7.472 5.208 9.056 6.792Z" /></>,
  edit: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4M4 20h16" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
  scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.7 8.3 11.3 6.2M8.7 15.7 20 9.5" /></>,
  undo: <><path d="m8 7-5 5 5 5" /><path d="M3 12h10a7 7 0 0 1 7 7" /></>,
  redo: <><path d="m16 7 5 5-5 5" /><path d="M21 12H11a7 7 0 0 0-7 7" /></>,
  "zoom-in": <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2M10.8 7.8v6M7.8 10.8h6" /></>,
  "zoom-out": <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2M7.8 10.8h6" /></>,
  // 图片变换工具使用独立图标，便于在预览及其他编辑界面复用。
  "flip-horizontal": <><path d="M12 3v18M3 6h5v12H3zM16 6h5v12h-5z" /></>,
  "flip-vertical": <><path d="M3 12h18M6 3h12v5H6zM6 16h12v5H6z" /></>,
  "rotate-left": <><path d="M4 9a8 8 0 1 1 0 6M4 3v6h6" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  "rotate-right": <><path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></>,
  refresh: <><path d="M20 4v4.686h-4.686" /><path d="M20 8.686 17.657 6.343A8 8 0 1 0 20 12" /></>,
  loader: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  phone: <path d="M8.2 3.5 5.4 4.8c-1 .5-1.5 1.7-1.1 2.8 2.2 5.9 6.2 9.9 12.1 12.1 1.1.4 2.3-.1 2.8-1.1l1.3-2.8-4.2-2-1.4 2.1c-2.8-1.2-5.6-4-6.8-6.8l2.1-1.4-2-4.2Z" />,
  link: <><path d="m9.5 14.5 5-5" /><path d="M7.5 16.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.5 7.5 18 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" /></>,
  "external-link": <><path d="M14 4h6v6M20 4 11 13" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a14.5 14.5 0 0 1-2.2 3M6.4 6.4C3.9 8.2 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  unlock: <><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
  heart: <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-7.4a5.5 5.5 0 0 0 0-7.8Z" />,
  file: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h4" /></>,
  folder: <path d="M3 6h7l2 2h9v11H3V6Z" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="9" r="2" /><path d="m4 17 4.5-4.5 3.5 3 2.5-2.5 5.5 5" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" />,
  "sort-ascending": <><path d="M7 19V5M3.5 8.5 7 5l3.5 3.5" /><path d="M13 7h8M13 12h6M13 17h4" /></>,
  "sort-descending": <><path d="M7 5v14M3.5 15.5 7 19l3.5-3.5" /><path d="M13 7h4M13 12h6M13 17h8" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></>,
  pause: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9v6M14.5 9v6" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17h4.5A2.5 2.5 0 0 1 20 22V5.5Z" /></>,
  component: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  token: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
  code: <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />,
  github: <path d="M9 19c-4 1.2-4-2-5-2.5M14 22v-3.1c0-.9.3-1.5.8-1.9 2.7-.3 5.5-1.3 5.5-6A4.7 4.7 0 0 0 19 7.7 4.4 4.4 0 0 0 18.9 4S17.8 3.7 15 5.3a11.7 11.7 0 0 0-6 0C6.2 3.7 5.1 4 5.1 4A4.4 4.4 0 0 0 5 7.7 4.7 4.7 0 0 0 3.7 11c0 4.7 2.8 5.7 5.5 6 .5.4.8 1 .8 1.9V22" />,
} satisfies Record<string, ReactNode>;

const iconPaths = { ...coreIconPaths, ...extendedIconPaths };

/** 可用的线框图标名称。 */
export type IconName = keyof typeof iconPaths;
/** 可用线框图标名称集合。 */
export const ICON_NAMES = Object.freeze(Object.keys(iconPaths) as IconName[]);

const filledIconPaths = {
  info: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 10.5v6M12 7.2v.1" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  question: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M9.6 9a2.5 2.5 0 1 1 3.6 2.3c-.8.5-1.2 1.1-1.2 2.1M12 16.8v.1" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  warning: <><path d="M10.3 3.5 1.8 19a2 2 0 0 0 1.8 3h16.8a2 2 0 0 0 1.8-3L13.7 3.5a2 2 0 0 0-3.4 0Z" fill="currentColor" stroke="none" /><path d="M12 9v5M12 18v.1" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-check": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m7.5 12 3 3 6-6" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-close": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-plus": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 7.5v9M7.5 12h9" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-minus": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M7.5 12h9" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  home: <path d="M2.6 10.8 12 2.8l9.4 8a1 1 0 0 1-1.3 1.5l-.6-.5V21h-5.2v-6.2H9.7V21H4.5v-9.2l-.6.5a1 1 0 1 1-1.3-1.5Z" fill="currentColor" stroke="none" />,
  user: <><circle cx="12" cy="7.5" r="4.5" fill="currentColor" stroke="none" /><path d="M3.5 21c.7-5 3.6-7.5 8.5-7.5s7.8 2.5 8.5 7.5H3.5Z" fill="currentColor" stroke="none" /></>,
  users: <><circle cx="8.5" cy="8" r="3.8" fill="currentColor" stroke="none" /><circle cx="17" cy="8.5" r="3" fill="currentColor" stroke="none" opacity=".7" /><path d="M1.8 21c.6-4.6 2.8-7 6.7-7s6.1 2.4 6.7 7H1.8ZM14.4 15.2c3.9-.2 6.4 1.7 7 5.8h-4.5a9.9 9.9 0 0 0-2.5-5.8Z" fill="currentColor" stroke="none" /></>,
  trash: <path d="M8 3h8l1 3h4v2H3V6h4l1-3Zm-2.5 7h13l-1 11h-11l-1-11Z" fill="currentColor" stroke="none" />,
  bell: <path d="M12 2.5a2 2 0 0 1 2 1.6c3 .9 5 3.6 5 6.9v4.3l2 3.2H3l2-3.2V11c0-3.3 2-6 5-6.9a2 2 0 0 1 2-1.6ZM9.2 20h5.6a3 3 0 0 1-5.6 0Z" fill="currentColor" stroke="none" />,
  star: <path d="m12 2.2 3 6 6.6 1-4.8 4.6 1.1 6.6-5.9-3.1-5.9 3.1 1.1-6.6-4.8-4.6 6.6-1 3-6Z" fill="currentColor" stroke="none" />,
  heart: <path d="M12 21.3 3.1 13.7A5.8 5.8 0 0 1 11 5.2l1 1 1-1a5.8 5.8 0 0 1 7.9 8.5L12 21.3Z" fill="currentColor" stroke="none" />,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="currentColor" stroke="none" /><path d="m4.5 7 7.5 5.8L19.5 7" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.8" /></>,
  lock: <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19.5v-7A2.5 2.5 0 0 1 5.5 10H7Zm2.5 0h5V7a2.5 2.5 0 0 0-5 0v3Z" fill="currentColor" stroke="none" />,
  unlock: <path d="M7 10V7a5 5 0 0 1 9.5-2.2l-2.2 1.1A2.5 2.5 0 0 0 9.5 7v3h9A2.5 2.5 0 0 1 21 12.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19.5v-7A2.5 2.5 0 0 1 5.5 10H7Z" fill="currentColor" stroke="none" />,
  calendar: <><rect x="2.5" y="4.5" width="19" height="17" rx="2.5" fill="currentColor" stroke="none" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.8" /></>,
  clock: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 6.5V12l4 2.3" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  file: <path d="M5 2.5h10l4 4V22H5V2.5Zm9 1.8V8h3.7L14 4.3Z" fill="currentColor" stroke="none" />,
  folder: <path d="M2.5 5h7l2.2 2.5h9.8V20H2.5V5Z" fill="currentColor" stroke="none" />,
  image: <><rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="currentColor" stroke="none" /><path d="m4.5 18 4.3-4.6 3.4 3 2.5-2.6 4.8 4.2" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.7" /><circle cx="8" cy="8.5" r="1.7" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  filter: <path d="M2 4h20l-7.8 9v6.2L9.8 22v-9L2 4Z" fill="currentColor" stroke="none" />,
  play: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m10 7.8 6.5 4.2-6.5 4.2V7.8Z" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  pause: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M8.5 7.5h2.5v9H8.5v-9Zm4.5 0h2.5v9H13v-9Z" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  book: <path d="M3 4.5A3.5 3.5 0 0 1 6.5 1H11v19H6.5A3.5 3.5 0 0 0 3 23V4.5ZM21 4.5A3.5 3.5 0 0 0 17.5 1H13v19h4.5A3.5 3.5 0 0 1 21 23V4.5Z" fill="currentColor" stroke="none" />,
  component: <><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" stroke="none" /><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" stroke="none" /><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" stroke="none" /><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" stroke="none" /></>,
  token: <><circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" /><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2 7 7M17 17l2.8 2.8M19.8 4.2 17 7M7 17l-2.8 2.8" stroke="currentColor" strokeWidth="2.2" /></>,
} satisfies Partial<Record<IconName, ReactNode>>;

/** 可用的填充图标名称。 */
export type FilledIconName = keyof typeof filledIconPaths;
/** 图标采用线框还是填充样式。 */
export type IconVariant = "outline" | "filled";
/** 可用填充图标名称集合。 */
export const FILLED_ICON_NAMES = Object.freeze(Object.keys(filledIconPaths) as FilledIconName[]);

// 描边、实心以及扩展目录共用同一规则；新增名称缺少边界数据时由类型检查拦截。
const normalizedOutlinePaths = normalizeIconPaths(iconPaths, outlineIconBounds);
const normalizedFilledPaths = normalizeIconPaths(filledIconPaths, filledIconBounds);

/** 图标的属性配置。 */
export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** 名称或字段标识。 */
  name: IconName;
  /**
   * SVG 外框尺寸；数字为 px，字符串支持 em 等 CSS 长度。画布为 24×24，主体最长边为 18 单位（不含描边），保持比例并居中。
   * @defaultValue "1em"
   */
  size?: number | string;
  /**
   * 24 单位画布中的描边粗细；不受内部图形归一化影响，随 size 整体缩放。实心图标内的反白细节保留各自描边。
   * @defaultValue 1.8
   */
  strokeWidth?: number;
  /**
   * 旋转角度。
   * @defaultValue 0
   */
  rotate?: number;
  /**
   * 是否显示持续旋转动画。
   * @defaultValue false
   */
  spin?: boolean;
  /**
   * 是否显示脉冲动画。
   * @defaultValue false
   */
  pulse?: boolean;
  /** 展示给用户的名称，可传入文本或 React 节点。 */
  label?: string;
  /**
   组件的视觉样式。
   * @defaultValue "outline"
   */
  variant?: IconVariant;
}

type IconStyle = CSSProperties & {
  "--sia-icon-size"?: string;
  "--sia-icon-rotate"?: string;
};

/** 图标组件。 */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = "1em", strokeWidth = 1.8, rotate = 0, spin = false, pulse = false, label, variant = "outline", className = "", style, ...props },
  ref,
) {
  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  const mergedStyle: IconStyle = { "--sia-icon-size": resolvedSize, "--sia-icon-rotate": `${rotate}deg`, ...style };
  const animationClass = spin ? " sia-icon--spin" : pulse ? " sia-icon--pulse" : "";
  const filledPath = filledIconPaths[name as FilledIconName];
  const resolvedVariant = variant === "filled" && filledPath ? "filled" : "outline";
  const geometry = resolvedVariant === "filled" ? normalizedFilledPaths[name as FilledIconName] : normalizedOutlinePaths[name];

  return (
    <span
      ref={ref}
      className={`sia-icon${animationClass} ${className}`.trim()}
      data-variant={resolvedVariant}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={mergedStyle}
      {...withTitleTooltip(props)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth / geometry.scale} strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {geometry.node}
      </svg>
    </span>
  );
});
