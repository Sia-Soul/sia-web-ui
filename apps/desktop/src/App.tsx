import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import {
  Button,
  Card,
  Icon,
  Input,
  Menu,
  Tag,
  ThemeSwitch,
  applySiaTheme,
  type MenuItem,
} from "@sia.soul/sia-react-ui";
import SiaEditor from "./features/editor/SiaEditor";
import ProjectsPage from "./features/projects/ProjectsPage";
import { ChooseBoxDemo } from "./ChooseBoxDemo";
import WorkItemsPage from "./features/work-items/WorkItemsPage";

interface RuntimeInfo {
  platform: string;
  architecture: string;
  appVersion: string;
}

type SectionKey = "workspace" | "projects" | "workItems" | "documents" | "components" | "settings";

const navigationItems: readonly MenuItem[] = [
  { key: "workspace", icon: <Icon name="home" size={18} />, label: "工作台" },
  { key: "projects", icon: <Icon name="folder" size={18} />, label: "项目" },
  { key: "workItems", icon: <Icon name="clipboard-check" size={18} />, label: "任务 / BUG" },
  { key: "documents", icon: <Icon name="file" size={18} />, label: "文档" },
  { key: "components", icon: <Icon name="code" size={18} />, label: "组件" },
  { key: "settings", icon: <Icon name="settings" size={18} />, label: "设置" },
];

const isDesktopRuntime = Boolean(window.__TAURI__);

const SECTION_META: Record<SectionKey, { title: string; description: string }> = {
  workspace: {
    title: "客户端工作台",
    description: "复用同一套 Sia WebUI 组件，构建跨平台桌面应用。",
  },
  projects: {
    title: "项目中心",
    description: "管理项目范围、状态、周期以及关联的任务与文档。",
  },
  workItems: {
    title: "任务 / BUG 中心",
    description: "聚合日常任务和问题，持续跟踪优先级、状态与截止日期。",
  },
  documents: {
    title: "文档工作区",
    description: "沉淀 PRD、需求、原型说明与日常工作记录。",
  },
  components: {
    title: "组件工作区",
    description: "查看客户端正在复用的 Sia WebUI 能力。",
  },
  settings: {
    title: "客户端设置",
    description: "管理外观、数据与桌面运行时选项。",
  },
};

function preventBrowserContextMenu(event: MouseEvent<HTMLElement>) {
  const target = event.target;
  if (target instanceof Element && target.closest(".monaco-editor")) return;
  event.preventDefault();
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("workspace");
  const [projectName, setProjectName] = useState("我的桌面项目");
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const sectionMeta = SECTION_META[activeSection];

  useEffect(() => {
    function preventPortalContextMenu(event: globalThis.MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(".monaco-editor")) return;
      event.preventDefault();
    }
    document.addEventListener("contextmenu", preventPortalContextMenu);
    return () => document.removeEventListener("contextmenu", preventPortalContextMenu);
  }, []);

  function handleThemeChange(checked: boolean) {
    setDarkMode(checked);
    applySiaTheme(checked ? "dark" : "light");
  }

  async function checkRuntime() {
    setErrorMessage("");
    if (!isDesktopRuntime) {
      setErrorMessage("当前是浏览器预览；请运行 pnpm desktop:dev 测试客户端桥接。");
      return;
    }

    setIsChecking(true);
    try {
      const info = await window.__TAURI__!.core.invoke<RuntimeInfo>("runtime_info");
      setRuntimeInfo(info);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="desktop-shell" onContextMenu={preventBrowserContextMenu}>
      <aside className="sidebar">
        <div className="brand" aria-label="Sia Desktop">
          <span className="brand__mark">S</span>
          <span>
            <strong>Sia</strong>
            <small>Desktop</small>
          </span>
        </div>

        <nav className="sidebar__navigation" aria-label="主导航">
          <Menu
            className="sidebar__menu"
            items={navigationItems}
            mode="inline"
            theme="dark"
            selectedKeys={[activeSection]}
            onSelect={({ key }) => setActiveSection(key as SectionKey)}
          />
        </nav>

        <div className="sidebar__footer">
          <span className="runtime-dot" aria-hidden="true" />
          <span>{isDesktopRuntime ? "桌面运行时已连接" : "浏览器预览模式"}</span>
        </div>
      </aside>

      <main className={`workspace${activeSection === "documents" ? " workspace--editor" : ""}`}>
        <header className="topbar">
          <div>
            <h1>{sectionMeta.title}</h1>
            <p>{sectionMeta.description}</p>
          </div>
          <ThemeSwitch checked={darkMode} onCheckedChange={handleThemeChange} />
        </header>

        <section className={`workspace__content${activeSection === "documents" ? " workspace__content--editor" : activeSection === "projects" || activeSection === "workItems" ? " workspace__content--projects" : ""}`}>
          {activeSection === "documents"
            ? <SiaEditor darkMode={darkMode} />
            : activeSection === "projects"
              ? <ProjectsPage />
              : activeSection === "workItems"
                ? <WorkItemsPage />
                : <>
          <div className="welcome-panel">
            <div className="welcome-panel__content">
              <h2>WebUI 已经运行在客户端中</h2>
              <p>React 界面负责产品体验，Tauri 提供文件、窗口和系统能力。组件代码无需复制，也不需要维护第二套样式。</p>
              <div className="welcome-panel__actions">
                <Button variant="primary" icon={<Icon name="check" size={16} />} loading={isChecking} onClick={checkRuntime}>
                  检查客户端桥接
                </Button>
                <Tag status={isDesktopRuntime ? "success" : "processing"}>
                  {isDesktopRuntime ? "Tauri 运行中" : "Web 预览"}
                </Tag>
              </div>
              {errorMessage ? <p className="bridge-message bridge-message--warning" role="status">{errorMessage}</p> : null}
              {runtimeInfo ? (
                <p className="bridge-message bridge-message--success" role="status">
                  已连接：{runtimeInfo.platform} / {runtimeInfo.architecture} / v{runtimeInfo.appVersion}
                </p>
              ) : null}
            </div>
            <div className="welcome-panel__visual" aria-hidden="true">
              <span className="window-preview__bar"><i /><i /><i /></span>
              <span className="window-preview__body">
                <i className="window-preview__rail" />
                <i className="window-preview__line window-preview__line--strong" />
                <i className="window-preview__line" />
                <i className="window-preview__button" />
              </span>
            </div>
          </div>

          <div className="content-grid">
            {activeSection === "components" && <ChooseBoxDemo />}
            <Card title="创建项目" description="这是直接来自 @sia.soul/sia-react-ui 的 Input、Button 和 Card。" accent="primary">
              <div className="project-form">
                <Input
                  label="项目名称"
                  value={projectName}
                  allowClear
                  onChange={(event) => setProjectName(event.target.value)}
                />
                <Button variant="primary" disabled={!projectName.trim()}>创建</Button>
              </div>
            </Card>

            <Card title="架构分层" description="界面与系统能力保持清晰边界。">
              <ol className="architecture-list">
                <li><span>1</span><div><strong>Sia WebUI</strong><small>组件、主题与交互</small></div></li>
                <li><span>2</span><div><strong>Tauri Commands</strong><small>安全的前后端桥接</small></div></li>
                <li><span>3</span><div><strong>Rust / OS</strong><small>本地文件与系统能力</small></div></li>
              </ol>
            </Card>
          </div>
          </>}
        </section>
      </main>
    </div>
  );
}
