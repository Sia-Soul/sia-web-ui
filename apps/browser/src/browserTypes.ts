export type TabLayoutMode = "horizontal" | "vertical";

export interface BrowserSmallGroup {
  id: string;
  name: string;
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
  loading: boolean;
  hasWebview: boolean;
  sleeping: boolean;
  inactiveSince?: number;
  audible: boolean;
  muted: boolean;
  pinned?: boolean;
  groupId: string;
  smallGroupId?: string;
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
