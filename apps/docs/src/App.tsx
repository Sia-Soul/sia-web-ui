import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Icon, ThemeSwitch, applySiaTheme } from "@sia-ui/react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { SiaMark } from "./Icons";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { navGroups, navItems } from "./navigation";
import { ButtonPage } from "./pages/ButtonPage";
import { CardPage } from "./pages/CardPage";
import { DividerPage } from "./pages/DividerPage";
import { FlexPage, GridPage, SpacePage, SplitterPage } from "./pages/LayoutComponentsPages";
import { CheckboxPage, ColorPickerPage, DatePickerPage, FormPage, RadioPage, SliderPage, TimePickerPage, TreeSelectPage, UploadPage } from "./pages/DataEntryComponentsPages";
import { CascaderPage } from "./pages/CascaderPage";
import { DropdownPage, MenuPage, PaginationPage, SegmentedPage, StepsPage } from "./pages/NavigationComponentsPages";
import { BadgePage, CalendarPage, CarouselPage, CollapsePage, ImagePage, PopoverPage, RatePage, TimelinePage, TooltipPage, TreePage } from "./pages/DataDisplayMorePages";
import { AlertPage, NotificationPage, PopconfirmPage, ProgressPage, SpinPage, TourPage, WatermarkPage } from "./pages/FeedbackMorePages";
import { DrawerPage } from "./pages/DrawerPage";
import { IconPage } from "./pages/IconPage";
import { InputNumberPage } from "./pages/InputNumberPage";
import { InputPage } from "./pages/InputPage";
import { MessagePage } from "./pages/MessagePage";
import { ModalPage } from "./pages/ModalPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SelectPage } from "./pages/SelectPage";
import { SwitchPage } from "./pages/SwitchPage";
import { TabsPage } from "./pages/TabsPage";
import { TagPage } from "./pages/TagPage";
import { TablePage } from "./pages/TablePage";
import { TokensPage } from "./pages/TokensPage";

function ScrollToTop({ scrollRef }: { scrollRef: React.RefObject<HTMLElement> }) {
  const { pathname } = useLocation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname, scrollRef]);

  return null;
}

export default function App() {
  const location = useLocation();
  const [dark, setDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const contentScrollRef = useRef<HTMLElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(
    navGroups.map((group) => [group.title, group.defaultOpen === true || group.items.some((item) => item.path === location.pathname)]),
  ));

  const appClass = useMemo(() => `docs-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`, [collapsed, mobileOpen]);
  const currentItem = navItems.find((item) => item.path === location.pathname);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    applySiaTheme(next ? "dark" : "light");
  }

  function toggleGroup(title: string) {
    setOpenGroups((groups) => ({ ...groups, [title]: !groups[title] }));
  }

  return (
    <div className={appClass}>
      <ScrollToTop scrollRef={contentScrollRef} />
      <header className="topbar">
        <NavLink className="brand" to="/introduction"><SiaMark /><strong>Sia Web UI</strong></NavLink>
        <button className="icon-button desktop-only" aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} onClick={() => setCollapsed((value) => !value)}><Icon name="menu" /></button>
        <button className="icon-button mobile-only" aria-label="打开侧边栏" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
        <label className="search"><Icon name="search" /><input placeholder="搜索组件、文档、设计令牌..." aria-label="搜索文档" /><kbd>⌘ K</kbd></label>
        <nav className="topnav" aria-label="顶部导航">
          <NavLink to="/introduction"><Icon name="book" />文档</NavLink>
          <NavLink to="/components/button"><Icon name="component" />组件</NavLink>
          <NavLink to="/design/tokens"><Icon name="token" />设计令牌</NavLink>
        </nav>
        <ThemeSwitch checked={dark} onCheckedChange={toggleTheme} lightLabel="切换到暗色" darkLabel="切换到亮色" />
        <a className="icon-button github" href="https://github.com" aria-label="GitHub"><Icon name="github" /></a>
        <Button variant="primary" className="create-button">创建项目</Button>
      </header>

      <aside className="sidebar">
        <div className="mobile-sidebar-head"><strong>组件导航</strong><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="关闭侧边栏">×</button></div>
        <OverlayScrollArea as="nav" className="sidebar-scroll-area" viewportClassName="sidebar-nav" aria-label="组件目录">
          {navGroups.map((group) => {
            const isOpen = openGroups[group.title] ?? false;
            return <div className="nav-group" key={group.title}>
              <button className="nav-title" type="button" aria-expanded={isOpen} onClick={() => toggleGroup(group.title)}>
                <span>{group.title}</span><Icon name={isOpen ? "chevron-down" : "chevron-right"} size={14} />
              </button>
              {isOpen ? <div className="nav-items">
                {group.items.map((item) => <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                  {({ isActive }) => <><span className="nav-dot">{isActive ? "▣" : "◇"}</span><span>{item.label}</span></>}
                </NavLink>)}
              </div> : null}
            </div>;
          })}
        </OverlayScrollArea>
        <button className="collapse-action" onClick={() => setCollapsed((value) => !value)}><Icon name="arrow-left" /><span>收起侧边栏</span></button>
      </aside>
      <button className="sidebar-backdrop" aria-label="关闭侧边栏" onClick={() => setMobileOpen(false)} />

      <OverlayScrollArea ref={contentScrollRef} as="main" className="content-shell" viewportClassName="content">
        <div className="doc-column">
          <Routes>
            <Route path="/" element={<Navigate to="/introduction" replace />} />
            <Route path="/components/button" element={<ButtonPage />} />
            <Route path="/components/card" element={<CardPage />} />
            <Route path="/components/divider" element={<DividerPage />} />
            <Route path="/components/flex" element={<FlexPage />} />
            <Route path="/components/grid" element={<GridPage />} />
            <Route path="/components/space" element={<SpacePage />} />
            <Route path="/components/splitter" element={<SplitterPage />} />
            <Route path="/components/drawer" element={<DrawerPage />} />
            <Route path="/components/dropdown" element={<DropdownPage />} />
            <Route path="/components/menu" element={<MenuPage />} />
            <Route path="/components/pagination" element={<PaginationPage />} />
            <Route path="/components/steps" element={<StepsPage />} />
            <Route path="/components/icon" element={<IconPage />} />
            <Route path="/components/input" element={<InputPage />} />
            <Route path="/components/input-number" element={<InputNumberPage />} />
            <Route path="/components/cascader" element={<CascaderPage />} />
            <Route path="/components/checkbox" element={<CheckboxPage />} />
            <Route path="/components/radio" element={<RadioPage />} />
            <Route path="/components/rate" element={<RatePage />} />
            <Route path="/components/slider" element={<SliderPage />} />
            <Route path="/components/color-picker" element={<ColorPickerPage />} />
            <Route path="/components/date-picker" element={<DatePickerPage />} />
            <Route path="/components/time-picker" element={<TimePickerPage />} />
            <Route path="/components/tree-select" element={<TreeSelectPage />} />
            <Route path="/components/upload" element={<UploadPage />} />
            <Route path="/components/form" element={<FormPage />} />
            <Route path="/components/message" element={<MessagePage />} />
            <Route path="/components/modal" element={<ModalPage />} />
            <Route path="/components/select" element={<SelectPage />} />
            <Route path="/components/segmented" element={<SegmentedPage />} />
            <Route path="/components/switch" element={<SwitchPage />} />
            <Route path="/components/tabs" element={<TabsPage />} />
            <Route path="/components/tag" element={<TagPage />} />
            <Route path="/components/table" element={<TablePage />} />
            <Route path="/components/badge" element={<BadgePage />} />
            <Route path="/components/calendar" element={<CalendarPage />} />
            <Route path="/components/carousel" element={<CarouselPage />} />
            <Route path="/components/collapse" element={<CollapsePage />} />
            <Route path="/components/image" element={<ImagePage />} />
            <Route path="/components/popover" element={<PopoverPage />} />
            <Route path="/components/timeline" element={<TimelinePage />} />
            <Route path="/components/tooltip" element={<TooltipPage />} />
            <Route path="/components/tour" element={<TourPage />} />
            <Route path="/components/tree" element={<TreePage />} />
            <Route path="/components/alert" element={<AlertPage />} />
            <Route path="/components/notification" element={<NotificationPage />} />
            <Route path="/components/popconfirm" element={<PopconfirmPage />} />
            <Route path="/components/progress" element={<ProgressPage />} />
            <Route path="/components/spin" element={<SpinPage />} />
            <Route path="/components/watermark" element={<WatermarkPage />} />
            <Route path="/design/tokens" element={<TokensPage />} />
            <Route path="*" element={<PlaceholderPage item={currentItem} />} />
          </Routes>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
