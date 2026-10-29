export interface BrowserSmallGroup {
  id: string;
  name: string;
  /** 跨大分组移动后保留原数据空间的父级 ID；省略时使用当前所属大分组。 */
  profileGroupId?: string;
}

export interface BrowserGroup {
  id: string;
  name: string;
  color: string;
  smallGroups: readonly BrowserSmallGroup[];
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  /** 内核读取的 PNG 数据地址；空字符串表示当前网页没有可用图标，未设置时兼容旧版图标回退。 */
  faviconUrl?: string;
  /** 图标对应的完整文档地址，导航到其他页面时不显示旧页面图标。 */
  faviconPageUrl?: string;
  loading: boolean;
  hasWebview: boolean;
  sleeping: boolean;
  inactiveSince?: number;
  audible: boolean;
  muted: boolean;
  pinned?: boolean;
  groupId: string;
  smallGroupId?: string;
  /** 分组整体移动时保留的 WebView2 数据空间父级 ID；省略时使用 groupId。 */
  profileGroupId?: string;
}

export const ROOT_GROUP_ID = "group-root";
export const DEFAULT_GROUP_ID = "group-other";

export const BROWSER_GROUPS: readonly BrowserGroup[] = [
  {
    id: "group-local",
    name: "本地",
    color: "#5548f6",
    smallGroups: [
      { id: "local-admin", name: "管理后台" },
      { id: "local-brand", name: "品牌方端" },
      { id: "local-partner", name: "合作方端" },
      { id: "local-prototype", name: "原型" },
    ],
  },
  {
    id: "group-dev",
    name: "DEV环境",
    color: "#a244f2",
    smallGroups: [
      { id: "dev-admin", name: "管理后台" },
      { id: "dev-brand", name: "品牌方端" },
      { id: "dev-partner", name: "合作方端" },
    ],
  },
  {
    id: "group-pre",
    name: "PRE环境",
    color: "#f05a13",
    smallGroups: [],
  },
  {
    id: "group-company",
    name: "公司",
    color: "#119d91",
    smallGroups: [],
  },
  {
    id: DEFAULT_GROUP_ID,
    name: "其他",
    color: "#2867df",
    smallGroups: [],
  },
];
