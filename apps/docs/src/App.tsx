import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FloatingScrollbarProvider, Icon, ThemeSwitch, applySiaTheme } from "@sia-ui/react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { SiaMark } from "./Icons";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { PageContextMenu } from "./PageContextMenu";
import { navGroups, navIconForPath, navItems } from "./navigation";
import { ButtonPage } from "./pages/ButtonPage";
import { FloatButtonPage } from "./pages/FloatButtonPage";
import { TypographyPage } from "./pages/TypographyPage";
import { BreadcrumbPage } from "./pages/BreadcrumbPage";
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
import { TextAreaPage } from "./pages/TextAreaPage";
import { EditorPage } from "./pages/EditorPage";
import { SelectDateRangePage } from "./pages/DateRangeComponentsPages";
import { FloatingScrollbarPage } from "./pages/FloatingScrollbarPage";
import { MarkdownEditorPage } from "./pages/MarkdownEditorPage";
import { MarkdownPage } from "./pages/MarkdownPage";
import { MessagePage } from "./pages/MessagePage";
import { ModalPage } from "./pages/ModalPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SelectPage } from "./pages/SelectPage";
import { SwitchPage } from "./pages/SwitchPage";
import { TabsPage } from "./pages/TabsPage";
import { TagPage } from "./pages/TagPage";
import { TablePage } from "./pages/TablePage";
import { ToolPanelPage } from "./pages/ToolPanelPage";
import { TreemapPage } from "./pages/TreemapPage";
import { ChartsPage, ChartCategoryPage } from "./pages/ChartsPage";
import { TokensPage } from "./pages/TokensPage";
import { WindowFramePage } from "./pages/WindowFramePage";
import { RichTextEditorPage } from "./pages/RichTextEditorPage";

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
  const [floatingScrollbarEnabled, setFloatingScrollbarEnabled] = useState(true);
  const contentScrollRef = useRef<HTMLElement>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(
    navGroups.map((group) => [group.title, group.defaultOpen === true || group.items.some((item) => item.path === location.pathname || item.children?.some(child=>child.path===location.pathname))]),
  ));
  const [chartsOpen,setChartsOpen]=useState(location.pathname.startsWith("/components/chart"));
  useEffect(()=>{
    if(location.pathname.startsWith("/components/chart")){
      setChartsOpen(true);
      setOpenGroups(current=>({...current,"数据展示":true}));
    }
  },[location.pathname]);

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
      <FloatingScrollbarProvider disabled={location.pathname === "/components/floating-scrollbar" && !floatingScrollbarEnabled} />
      <PageContextMenu />
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
                {group.items.map((item) => item.children ? <div key={item.path} className="nav-subgroup">
                  <Button variant="text" className={`nav-chart-parent${location.pathname.startsWith(item.path)?" is-current":""}`} aria-label={item.label} aria-expanded={!collapsed && chartsOpen} aria-controls="chart-category-navigation" onClick={()=>{if(collapsed){setCollapsed(false);setChartsOpen(true);}else setChartsOpen(value=>!value);}}><span className="nav-item-icon"><Icon name={navIconForPath(item.path)} size={16} /></span><span>{item.label}</span><Icon name={chartsOpen?"chevron-down":"chevron-right"} size={14}/></Button>
                  {chartsOpen?<div id="chart-category-navigation" className="nav-children">{item.children.map(child=><NavLink end key={child.path} to={child.path} onClick={()=>setMobileOpen(false)}><span className="nav-item-icon"><Icon name={navIconForPath(child.path)} size={14} /></span><span>{child.label}</span></NavLink>)}</div>:null}
                </div> : <NavLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                  <span className="nav-item-icon"><Icon name={navIconForPath(item.path)} size={16} /></span><span>{item.label}</span>
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
            <Route path="/components/float-button" element={<FloatButtonPage />} />
            <Route path="/components/typography" element={<TypographyPage />} />
            <Route path="/components/breadcrumb" element={<BreadcrumbPage />} />
            <Route path="/components/card" element={<CardPage />} />
            <Route path="/components/divider" element={<DividerPage />} />
            <Route path="/components/flex" element={<FlexPage />} />
            <Route path="/components/grid" element={<GridPage />} />
            <Route path="/components/space" element={<SpacePage />} />
            <Route path="/components/splitter" element={<SplitterPage />} />
            <Route path="/components/tool-panel" element={<ToolPanelPage />} />
            <Route path="/components/floating-scrollbar" element={<FloatingScrollbarPage enabled={floatingScrollbarEnabled} onEnabledChange={setFloatingScrollbarEnabled} />} />
            <Route path="/components/window-frame" element={<WindowFramePage />} />
            <Route path="/components/drawer" element={<DrawerPage />} />
            <Route path="/components/dropdown" element={<DropdownPage />} />
            <Route path="/components/menu" element={<MenuPage />} />
            <Route path="/components/pagination" element={<PaginationPage />} />
            <Route path="/components/steps" element={<StepsPage />} />
            <Route path="/components/icon" element={<IconPage />} />
            <Route path="/components/input" element={<InputPage />} />
            <Route path="/components/textarea" element={<TextAreaPage />} />
            <Route path="/components/editor" element={<EditorPage />} />
            <Route path="/components/rich-text-editor" element={<RichTextEditorPage />} />
            <Route path="/components/markdown-editor" element={<MarkdownEditorPage />} />
            <Route path="/components/input-number" element={<InputNumberPage />} />
            <Route path="/components/cascader" element={<CascaderPage />} />
            <Route path="/components/checkbox" element={<CheckboxPage />} />
            <Route path="/components/radio" element={<RadioPage />} />
            <Route path="/components/rate" element={<RatePage />} />
            <Route path="/components/slider" element={<SliderPage />} />
            <Route path="/components/color-picker" element={<ColorPickerPage />} />
            <Route path="/components/date-picker" element={<DatePickerPage />} />
            <Route path="/components/select-date-range" element={<SelectDateRangePage />} />
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
            <Route path="/components/markdown" element={<MarkdownPage />} />
            <Route path="/components/popover" element={<PopoverPage />} />
            <Route path="/components/timeline" element={<TimelinePage />} />
            <Route path="/components/tooltip" element={<TooltipPage />} />
            <Route path="/components/tour" element={<TourPage />} />
            <Route path="/components/tree" element={<TreePage />} />
            <Route path="/components/treemap" element={<TreemapPage />} />
            <Route path="/components/chart" element={<ChartsPage />} />
            <Route path="/components/chart/:category" element={<ChartCategoryPage />} />
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
