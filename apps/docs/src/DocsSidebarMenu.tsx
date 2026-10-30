import { useEffect, useState } from "react";
import { Icon, Menu } from "@sia.soul/sia-react-ui";
import type { MenuItem } from "@sia.soul/sia-react-ui";
import { useLocation, useNavigate } from "react-router-dom";
import { navGroups, navIconForPath } from "./navigation";
import type { NavItem } from "./navigation";

/** 路由叶子直接使用路径作为键；目录独立命名，避免图表首页与父目录重名。 */
function toMenuItem(item: NavItem): MenuItem {
  return {
    key: item.children ? `branch:${item.path}` : item.path,
    label: item.label,
    icon: <Icon name={navIconForPath(item.path)} size={16} />,
    children: item.children?.map(toMenuItem),
  };
}

const expandedItems: MenuItem[] = navGroups.map(group => ({
  key: `group:${group.title}`, label: group.title, children: group.items.map(toMenuItem),
}));
// 图标模式将分类摊平到根级，子目录继续使用 Menu 自带的弹出菜单。
const collapsedItems: MenuItem[] = navGroups.flatMap((group, index) => [
  ...(index ? [{ key: `divider:${group.title}`, type: "divider" as const }] : []),
  ...group.items.map(toMenuItem),
]);

/** 找出路由的祖先目录，供直接访问、前进和后退时展开当前路径。 */
function routeAncestors(items: readonly MenuItem[], path: string): string[] | undefined {
  for (const item of items) {
    if (item.key === path) return [];
    const ancestors = item.children && routeAncestors(item.children, path);
    if (ancestors) return [item.key, ...ancestors];
  }
  return undefined;
}

/** 示例站导航只负责路由映射；展开、选中动效和键盘操作统一交给框架 Menu。 */
export function DocsSidebarMenu({ collapsed, onNavigate }: {
  /** 是否显示为图标菜单；移动端打开时保持完整名称。 */
  collapsed: boolean;
  /** 路由选中后关闭移动端侧栏。 */
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = useState<string[]>(() => [...new Set([
    ...navGroups.filter(group => group.defaultOpen).map(group => `group:${group.title}`),
    ...routeAncestors(expandedItems, pathname) ?? [],
  ])]);
  const [popupKeys, setPopupKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys(current => [...new Set([...current, ...routeAncestors(expandedItems, pathname) ?? []])]);
    setPopupKeys([]);
  }, [pathname, collapsed]);

  return <nav className="sidebar-navigation" aria-label="组件目录">
    <Menu
      key={collapsed ? "icons" : "expanded"}
      className="docs-sidebar-menu"
      aria-label="组件导航"
      mode="inline"
      inlineIndent={10}
      inlineCollapsed={collapsed}
      items={collapsed ? collapsedItems : expandedItems}
      selectedKeys={[pathname]}
      openKeys={collapsed ? popupKeys : openKeys}
      onOpenChange={collapsed ? setPopupKeys : setOpenKeys}
      autoScrollSelected
      onClick={({ key }) => { navigate(key); onNavigate(); }}
    />
  </nav>;
}
