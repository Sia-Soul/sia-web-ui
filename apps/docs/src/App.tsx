import { useEffect, useMemo, useRef, useState } from "react";
import { Button, FloatingScrollbarProvider, Icon, ThemeSwitch, applySiaTheme } from "@sia.soul/sia-react-ui";
import { DocsSearch } from "./DocsSearch";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { SiaMark } from "./Icons";
// 品牌首页独立于文档侧栏布局，组件路由仍使用原有导航。
import { HomePage } from "./pages/HomePage";
import { OverlayScrollArea } from "./OverlayScrollArea";
import { PageContextMenu } from "./PageContextMenu";
import { navItems } from "./navigation";
import { DocsSidebarMenu } from "./DocsSidebarMenu";
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
import { NumberRangePage } from "./pages/NumberRangePage";
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
import { ChooseBoxPage } from "./pages/ChooseBoxPage";
import { SwitchPage } from "./pages/SwitchPage";
import { TabsPage } from "./pages/TabsPage";
import { TagPage } from "./pages/TagPage";
import { TablePage } from "./pages/TablePage";
import { QueryFormPage } from "./pages/QueryFormPage";
import { ToolPanelPage } from "./pages/ToolPanelPage";
import { TreemapPage } from "./pages/TreemapPage";
import { ChartsPage, ChartCategoryPage } from "./pages/ChartsPage";
import { TokensPage } from "./pages/TokensPage";
import { WindowFramePage } from "./pages/WindowFramePage";
import { RichTextEditorPage } from "./pages/RichTextEditorPage";
// 属性索引与补充交互样例共用文档路由。
import { PropertyExamplesPage } from "./pages/PropertyExamplesPage";

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
  // 标题栏等组件也可切换文档主题，页面顶部入口同步显示实际状态。
  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setDark(root.dataset.siaTheme === "dark");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-sia-theme"] });
    return () => observer.disconnect();
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [floatingScrollbarEnabled, setFloatingScrollbarEnabled] = useState(true);
  const contentScrollRef = useRef<HTMLElement>(null);
  const appClass = useMemo(() => `docs-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`, [collapsed, mobileOpen]);
  const currentItem = navItems.find((item) => item.path === location.pathname);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    applySiaTheme(next ? "dark" : "light");
  }

  // 根路径作为公开首页；主题状态与文档页面共享。
  if (location.pathname === "/") return <HomePage dark={dark} onToggleTheme={toggleTheme} />;

  return (
    <div className={appClass}>
      <FloatingScrollbarProvider disabled={location.pathname === "/components/floating-scrollbar" && !floatingScrollbarEnabled} />
      <PageContextMenu />
      <ScrollToTop scrollRef={contentScrollRef} />
      <header className="topbar">
        {/* 品牌返回首页；页面入口统一由侧栏和搜索提供。 */}
        <NavLink className="brand" to="/"><SiaMark /><strong>Sia Web UI</strong></NavLink>
        <button className="icon-button desktop-only" aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} onClick={() => setCollapsed((value) => !value)}><Icon name="menu" /></button>
        <button className="icon-button mobile-only" aria-label="打开侧边栏" onClick={() => setMobileOpen(true)}><Icon name="menu" /></button>
        <DocsSearch />
        <ThemeSwitch checked={dark} onCheckedChange={toggleTheme} lightLabel="切换到暗色" darkLabel="切换到亮色" />
        <a className="icon-button github" href="https://github.com" aria-label="GitHub"><Icon name="github" /></a>
        <Button variant="primary" className="create-button">创建项目</Button>
      </header>

      <aside className="sidebar">
        <div className="mobile-sidebar-head"><strong>组件导航</strong><button className="icon-button" onClick={() => setMobileOpen(false)} aria-label="关闭侧边栏">×</button></div>
        {/* 左侧目录复用框架 Menu，移动端展开时始终显示完整名称。 */}
        <DocsSidebarMenu collapsed={collapsed && !mobileOpen} onNavigate={() => setMobileOpen(false)} />
        <button className="collapse-action" onClick={() => setCollapsed((value) => !value)}><Icon name="arrow-left" /><span>收起侧边栏</span></button>
      </aside>
      <button className="sidebar-backdrop" aria-label="关闭侧边栏" onClick={() => setMobileOpen(false)} />

      <OverlayScrollArea ref={contentScrollRef} as="main" className="content-shell" viewportClassName="content">
        <div className="doc-column">
          <Routes>
            <Route path="/" element={<Navigate to="/introduction" replace />} />
            <Route path="/components/button" element={<ButtonPage />} />
            <Route path="/components/property-examples" element={<PropertyExamplesPage />} />
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
            {/* 数字区间提供独立文档入口，便于查询表单直接接入。 */}
            <Route path="/components/number-range" element={<NumberRangePage />} />
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
            <Route path="/components/query-form" element={<QueryFormPage />} />
            <Route path="/components/message" element={<MessagePage />} />
            <Route path="/components/modal" element={<ModalPage />} />
            <Route path="/components/select" element={<SelectPage />} />
            <Route path="/components/choose-box" element={<ChooseBoxPage />} />
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
