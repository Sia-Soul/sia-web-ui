import { withTitleTooltip } from "./titleTooltip";
import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { extendedIconPaths } from "./IconCatalog";
import { filledIconBounds, outlineIconBounds } from "./iconBounds";
import { normalizeIconPaths } from "./iconGeometry";
import { roundedFileOutline, roundedFileFold, roundedFolderOutline } from "./iconShapes";

// 轮廓转角直接使用静态曲线；内部符号按内容区配平，不以整体包围盒居中替代视觉校正。
const coreIconPaths = {
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2" /></>,
  plus: <path d="M12 4v16M4 12h16" />,
  // 数字区间用波浪线表达范围，避免箭头暗示跳转方向。
  tilde: <path d="M3 14c3-8 6-4 9-2s6 4 9-2" />,
  minus: <path d="M4 12h16" />,
  close: <path d="m5 5 14 14M19 5 5 19" />,
  check: <path d="M4 12.5L8.731 17.049Q9.2 17.5 9.655 17.036L20 6.5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.2v.1" /></>,
  question: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.5 2.2c-.9.5-1.3 1.1-1.3 2.1M12 16.8v.1" /></>,
  warning: <><path d="M10.3 4.1 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 4.1a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17v.1" /></>,
  "circle-check": <><circle cx="12" cy="12" r="9" /><path d="M7.8 12L10.14 14.34Q10.6 14.8 11.06 14.34L16.2 9.2" /></>,
  "circle-close": <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  "circle-plus": <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  "circle-minus": <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
  "chevron-left": <path d="M15.5 5L8.96 11.54Q8.5 12 8.96 12.46L15.5 19" />,
  "chevron-right": <path d="M8.5 5L15.04 11.54Q15.5 12 15.04 12.46L8.5 19" />,
  "chevron-up": <path d="M5 15.5L11.54 8.96Q12 8.5 12.46 8.96L19 15.5" />,
  "chevron-down": <path d="M5 8.5L11.54 15.04Q12 15.5 12.46 15.04L19 8.5" />,
  "double-left": <><path d="M12 5L5.46 11.54Q5 12 5.46 12.46L12 19" /><path d="M19 5L12.46 11.54Q12 12 12.46 12.46L19 19" /></>,
  "double-right": <><path d="M5 5L11.54 11.54Q12 12 11.54 12.46L5 19" /><path d="M12 5L18.54 11.54Q19 12 18.54 12.46L12 19" /></>,
  "arrow-left": <><path d="M10 5L3.46 11.54Q3 12 3.46 12.46L10 19" /><path d="M3 12h18" /></>,
  "arrow-right": <><path d="M14 5L20.54 11.54Q21 12 20.54 12.46L14 19" /><path d="M3 12h18" /></>,
  "arrow-up": <><path d="M5 10L11.54 3.46Q12 3 12.46 3.46L19 10" /><path d="M12 3v18" /></>,
  "arrow-down": <><path d="M5 14L11.54 20.54Q12 21 12.46 20.54L19 14" /><path d="M12 3v18" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  "more-horizontal": <path d="M5 12h.1M12 12h.1M19 12h.1" />,
  "more-vertical": <path d="M12 5v.1M12 12v.1M12 19v.1" />,
  home: <><path d="M3.5 10.5 10.7 4a2 2 0 0 1 2.6 0l7.2 6.5M5 9.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5" /><path d="M9 20v-5.5a1.5 1.5 0 0 1 1.5-1.5h3a1.5 1.5 0 0 1 1.5 1.5V20" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.8 20c.6-3.8 2.7-5.8 6.2-5.8s5.6 2 6.2 5.8" /><path d="M15 5.2a3.5 3.5 0 0 1 0 6.6M16.2 14.5c2.9.5 4.4 2.3 4.9 5.5" /></>,
  // 六齿轮廓为小尺寸保留清晰齿间距，主体大小与描边仍遵循统一几何规则。
  settings: <><circle cx="12" cy="12" r="2.8" /><path d="M9.515 6.612Q9.948 6.362 10.09 5.882L10.452 4.659Q10.611 4.122 11.172 4.122L12.828 4.122Q13.389 4.122 13.548 4.659L13.91 5.882Q14.052 6.362 14.485 6.612L15.424 7.154Q15.857 7.404 16.343 7.287L17.583 6.989Q18.128 6.858 18.409 7.343L19.237 8.778Q19.517 9.264 19.131 9.67L18.253 10.595Q17.909 10.958 17.909 11.458L17.909 12.542Q17.909 13.042 18.253 13.405L19.131 14.33Q19.517 14.736 19.237 15.222L18.409 16.657Q18.128 17.142 17.583 17.011L16.343 16.713Q15.857 16.596 15.424 16.846L14.485 17.388Q14.052 17.638 13.91 18.118L13.548 19.341Q13.389 19.878 12.828 19.878L11.172 19.878Q10.611 19.878 10.452 19.341L10.09 18.118Q9.948 17.638 9.515 17.388L8.576 16.846Q8.143 16.596 7.657 16.713L6.417 17.011Q5.872 17.142 5.591 16.657L4.763 15.222Q4.482 14.736 4.869 14.33L5.747 13.405Q6.091 13.042 6.091 12.542L6.091 11.458Q6.091 10.958 5.747 10.595L4.869 9.67Q4.482 9.264 4.763 8.778L5.591 7.343Q5.872 6.858 6.417 6.989L7.657 7.287Q8.143 7.404 8.576 7.154Z" /></>,
  edit: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4M4 20h16" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l.9 12.1A2 2 0 0 0 8.9 21h6.2a2 2 0 0 0 2-1.9L18 7M10 11v6M14 11v6" /></>,
  scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.7 8.3 11.3 6.2M8.7 15.7 20 9.5" /></>,
  undo: <><path d="M8 7L3.46 11.54Q3 12 3.46 12.46L8 17" /><path d="M3 12h10a7 7 0 0 1 7 7" /></>,
  redo: <><path d="M16 7L20.54 11.54Q21 12 20.54 12.46L16 17" /><path d="M21 12H11a7 7 0 0 0-7 7" /></>,
  "zoom-in": <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2M10.8 7.8v6M7.8 10.8h6" /></>,
  "zoom-out": <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m15.8 15.8 5.2 5.2M7.8 10.8h6" /></>,
  // 图片变换工具使用独立图标，便于在预览及其他编辑界面复用。
  "flip-horizontal": <><path d="M12 3v18" /><rect x="3" y="6" width="5" height="12" rx="1.2" /><rect x="16" y="6" width="5" height="12" rx="1.2" /></>,
  "flip-vertical": <><path d="M3 12h18" /><rect x="6" y="3" width="12" height="5" rx="1.2" /><rect x="6" y="16" width="12" height="5" rx="1.2" /></>,
  "rotate-left": <><path d="M4 9A8 8 0 1 1 4 15M4 3L4 8.35Q4 9 4.65 9L10 9" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  "rotate-right": <><path d="M20 9A8 8 0 1 0 20 15M20 3L20 8.35Q20 9 19.35 9L14 9" /><rect x="9" y="9" width="6" height="6" rx="1" /></>,
  download: <><path d="M12 3L12 15M7 10L11.54 14.54Q12 15 12.46 14.54L17 10M4 20L20 20" /></>,
  upload: <><path d="M12 16L12 4M7 9L11.54 4.46Q12 4 12.46 4.46L17 9M4 20L20 20" /></>,
  refresh: <><path d="M20 4L20 8.036Q20 8.686 19.35 8.686L15.314 8.686" /><path d="M20 8.686 17.657 6.343A8 8 0 1 0 20 12" /></>,
  loader: <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7L12 11.35Q12 12 12.564 12.322L15.5 14" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M4 7L11.48 12.61Q12 13 12.52 12.61L20 7" /></>,
  phone: <path d="M8.2 3.5 5.4 4.8c-1 .5-1.5 1.7-1.1 2.8 2.2 5.9 6.2 9.9 12.1 12.1 1.1.4 2.3-.1 2.8-1.1l1.3-2.8-4.2-2-1.4 2.1c-2.8-1.2-5.6-4-6.8-6.8l2.1-1.4-2-4.2Z" />,
  link: <><path d="m9.5 14.5 5-5" /><path d="M7.5 16.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.5 7.5 18 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" /></>,
  "external-link": <><path d="M14 4L19.35 4Q20 4 20 4.65L20 10M20 4L11 13" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></>,
  "eye-off": <><path d="m3 3 18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a14.5 14.5 0 0 1-2.2 3M6.4 6.4C3.9 8.2 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
  unlock: <><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3" /></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0v3c0 1.7-.7 3-1.8 4.3A1 1 0 0 0 5 18h14a1 1 0 0 0 .8-1.7C18.7 15 18 13.7 18 12V9Z" /><path d="M10 21h4" /></>,
  star: <path d="M11.339 4.346Q12 3 12.661 4.346L14.139 7.354Q14.8 8.7 16.284 8.915L19.516 9.385Q21 9.6 19.927 10.649L17.573 12.951Q16.5 14 16.762 15.477L17.338 18.723Q17.6 20.2 16.278 19.492L13.322 17.908Q12 17.2 10.678 17.908L7.722 19.492Q6.4 20.2 6.662 18.723L7.238 15.477Q7.5 14 6.427 12.951L4.073 10.649Q3 9.6 4.484 9.385L7.716 8.915Q9.2 8.7 9.861 7.354Z" />,
  heart: <path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-7.4a5.5 5.5 0 0 0 0-7.8Z" />,
  // 文件系列共享真实圆角轮廓，描边与填充使用相同的圆弧几何。
  file: <><path d={roundedFileOutline} /><path d={roundedFileFold} /></>,
  folder: <path d={roundedFolderOutline} />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="9" r="2" /><path d="M4 17L8.04 12.96Q8.5 12.5 8.994 12.923L11.506 15.077Q12 15.5 12.46 15.04L14.04 13.46Q14.5 13 14.981 13.437L20 18" /></>,
  filter: <path d="M3.988 6.129Q3 5 4.5 5L19.5 5Q21 5 20.012 6.129L14.948 11.916Q14 13 14 14.44L14 17.927Q14 19 13.04 19.48L10.96 20.52Q10 21 10 19.927L10 14.5Q10 13 9.012 11.871Z" />,
  "sort-ascending": <><path d="M7 19L7 5M3.5 8.5L6.54 5.46Q7 5 7.46 5.46L10.5 8.5" /><path d="M13 7h8M13 12h6M13 17h4" /></>,
  "sort-descending": <><path d="M7 5L7 19M3.5 15.5L6.54 18.54Q7 19 7.46 18.54L10.5 15.5" /><path d="M13 7h4M13 12h6M13 17h8" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.8Q10 8 10.666 8.444L15.334 11.556Q16 12 15.334 12.444L10.666 15.556Q10 16 10 15.2Z" /></>,
  pause: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9v6M14.5 9v6" /></>,
  book: <><path d="M12 6c-2-1.8-4.8-2.4-7.8-1.7A1.5 1.5 0 0 0 3 5.8v12.4a1 1 0 0 0 1.2 1C7.2 18.5 10 19 12 21c2-2 4.8-2.5 7.8-1.8a1 1 0 0 0 1.2-1V5.8a1.5 1.5 0 0 0-1.2-1.5C16.8 3.6 14 4.2 12 6ZM12 6v15" /></>,
  component: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  token: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  moon: <path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />,
  code: <path d="M9 18L3.46 12.46Q3 12 3.46 11.54L9 6M15 6L20.54 11.54Q21 12 20.54 12.46L15 18" />,
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
  "circle-check": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M7.8 12L10.14 14.34Q10.6 14.8 11.06 14.34L16.2 9.2" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-close": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="m8.8 8.8 6.4 6.4M15.2 8.8l-6.4 6.4" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-plus": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 7.5v9M7.5 12h9" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  "circle-minus": <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M7.5 12h9" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  home: <path d="M10.7 3.5a2 2 0 0 1 2.6 0l7.5 6.4a1 1 0 0 1-.7 1.8H19V19a2 2 0 0 1-2 2h-2v-5.5a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 15.5V21H7a2 2 0 0 1-2-2v-7.3H3.9a1 1 0 0 1-.7-1.8l7.5-6.4Z" fill="currentColor" stroke="none" />,
  user: <><circle cx="12" cy="7.5" r="4.5" fill="currentColor" stroke="none" /><path d="M3.5 21c.7-5 3.6-7.5 8.5-7.5s7.8 2.5 8.5 7.5H3.5Z" fill="currentColor" stroke="none" /></>,
  users: <><circle cx="8.5" cy="8" r="3.8" fill="currentColor" stroke="none" /><circle cx="17" cy="8.5" r="3" fill="currentColor" stroke="none" opacity=".7" /><path d="M1.8 21c.6-4.6 2.8-7 6.7-7s6.1 2.4 6.7 7H1.8ZM14.4 15.2c3.9-.2 6.4 1.7 7 5.8h-4.5a9.9 9.9 0 0 0-2.5-5.8Z" fill="currentColor" stroke="none" /></>,
  trash: <path d="M7.76 3.72Q8 3 8.759 3L15.241 3Q16 3 16.24 3.72L16.76 5.28Q17 6 17.759 6L20.52 6Q21 6 21 6.48L21 7.52Q21 8 20.52 8L3.48 8Q3 8 3 7.52L3 6.48Q3 6 3.48 6L6.241 6Q7 6 7.24 5.28ZM5.636 11.494Q5.5 10 7 10L17 10Q18.5 10 18.364 11.494L17.636 19.506Q17.5 21 16 21L8 21Q6.5 21 6.364 19.506Z" fill="currentColor" stroke="none" />,
  bell: <><path d="M18 9a6 6 0 0 0-12 0v3c0 1.7-.7 3-1.8 4.3A1 1 0 0 0 5 18h14a1 1 0 0 0 .8-1.7C18.7 15 18 13.7 18 12V9Z" fill="currentColor" stroke="none" /><path d="M10 21h4" strokeWidth="2" /></>,
  star: <path d="M11.329 3.542Q12 2.2 12.671 3.542L14.329 6.858Q15 8.2 16.483 8.425L20.117 8.975Q21.6 9.2 20.517 10.238L17.883 12.762Q16.8 13.8 17.047 15.28L17.653 18.92Q17.9 20.4 16.572 19.702L13.328 17.998Q12 17.3 10.672 17.998L7.428 19.702Q6.1 20.4 6.347 18.92L6.953 15.28Q7.2 13.8 6.117 12.762L3.483 10.238Q2.4 9.2 3.883 8.975L7.517 8.425Q9 8.2 9.671 6.858Z" fill="currentColor" stroke="none" />,
  heart: <path d="M12 21.3 3.1 13.7A5.8 5.8 0 0 1 11 5.2l1 1 1-1a5.8 5.8 0 0 1 7.9 8.5L12 21.3Z" fill="currentColor" stroke="none" />,
  mail: <><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="currentColor" stroke="none" /><path d="M4.5 7L11.486 12.402Q12 12.8 12.514 12.402L19.5 7" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.8" /></>,
  lock: <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19.5v-7A2.5 2.5 0 0 1 5.5 10H7Zm2.5 0h5V7a2.5 2.5 0 0 0-5 0v3Z" fill="currentColor" stroke="none" />,
  unlock: <path d="M7 10V7a5 5 0 0 1 9.5-2.2l-2.2 1.1A2.5 2.5 0 0 0 9.5 7v3h9A2.5 2.5 0 0 1 21 12.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 19.5v-7A2.5 2.5 0 0 1 5.5 10H7Z" fill="currentColor" stroke="none" />,
  calendar: <><rect x="2.5" y="4.5" width="19" height="17" rx="2.5" fill="currentColor" stroke="none" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.8" /></>,
  clock: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M12 6.5L12 11.35Q12 12 12.563 12.324L16 14.3" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="2" /></>,
  file: <><path d={roundedFileOutline} fill="currentColor" stroke="none" /><path d={roundedFileFold} stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.5" /></>,
  folder: <path d={roundedFolderOutline} fill="currentColor" stroke="none" />,
  image: <><rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="currentColor" stroke="none" /><path d="M4.5 18L8.356 13.875Q8.8 13.4 9.287 13.83L11.713 15.97Q12.2 16.4 12.651 15.931L14.249 14.269Q14.7 13.8 15.189 14.228L19.5 18" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.7" /><circle cx="8" cy="8.5" r="1.7" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  filter: <path d="M2.982 5.134Q2 4 3.5 4L20.5 4Q22 4 21.018 5.134L15.175 11.876Q14.2 13 14.2 14.488L14.2 17.948Q14.2 19.2 13.144 19.872L10.856 21.328Q9.8 22 9.8 20.748L9.8 14.5Q9.8 13 8.818 11.866Z" fill="currentColor" stroke="none" />,
  play: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><path d="M10 8.6Q10 7.8 10.672 8.234L15.828 11.566Q16.5 12 15.828 12.434L10.672 15.766Q10 16.2 10 15.4Z" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  pause: <><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" /><rect x="8.5" y="7.5" width="2.5" height="9" rx="1" fill="var(--sia-icon-contrast, #fff)" stroke="none" /><rect x="13" y="7.5" width="2.5" height="9" rx="1" fill="var(--sia-icon-contrast, #fff)" stroke="none" /></>,
  book: <><path d="M12 6c-2-1.8-4.8-2.4-7.8-1.7A1.5 1.5 0 0 0 3 5.8v12.4a1 1 0 0 0 1.2 1C7.2 18.5 10 19 12 21c2-2 4.8-2.5 7.8-1.8a1 1 0 0 0 1.2-1V5.8a1.5 1.5 0 0 0-1.2-1.5C16.8 3.6 14 4.2 12 6Z" fill="currentColor" stroke="none" /><path d="M12 6v14" stroke="var(--sia-icon-contrast, #fff)" strokeWidth="1.5" /></>,
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
  /**
   * 图标语义色：inherit 继承文字颜色，primary 使用主题蓝色，success/warning/danger 分别表示成功、警告和危险。
   * 仅改变图形颜色，不改变相邻文字、尺寸或交互；颜色跟随主题变量，显式 style.color 优先。
   * @defaultValue "inherit"
   */
  tone?: "inherit" | "primary" | "success" | "warning" | "danger";
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

/** 框架图标；使用圆端描边与静态圆角轮廓，主体等比居中，内部符号按内容区布局，颜色默认继承父元素。 */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, tone = "inherit", size = "1em", strokeWidth = 1.8, rotate = 0, spin = false, pulse = false, label, variant = "outline", className = "", style, ...props },
  ref,
) {
  const resolvedSize = typeof size === "number" ? `${size}px` : size;
  // 语义颜色由框架主题提供；默认继承保持既有按钮及文字中的图标表现。
  const toneColor = tone === "inherit" ? undefined : `var(--sia-color-${tone === "danger" ? "error" : tone === "primary" ? "primary-text" : tone})`;
  const mergedStyle: IconStyle = { "--sia-icon-size": resolvedSize, "--sia-icon-rotate": `${rotate}deg`, color: toneColor, ...style };
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
