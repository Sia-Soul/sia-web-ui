import { useState } from "react";
import {
  Alert,
  Button,
  Icon,
  Segmented,
  Switch,
  Tag,
  WindowFrame,
  WindowTitleBar,
  type WindowAction,
  type WindowTitleBarActionsAlign,
  type SiaThemeMode,
} from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const basicCode = `import {
  Button,
  Icon,
  WindowFrame,
  WindowTitleBar,
  type WindowAction,
} from "@sia.soul/sia-react-ui";

function App() {
  const handleWindowAction = (action: WindowAction) => {
    void invoke("window_action", { action }).catch(console.error);
  };

  return (
    <WindowFrame
      titleBar={
        <WindowTitleBar
          leading={<strong>Sia Desktop</strong>}
          actions={
            <>
              <Button variant="text" icon={<Icon name="home" />}>工作台</Button>
              <Button variant="text">同步</Button>
            </>
          }
          actionsAlign="right"
          onWindowAction={handleWindowAction}
        />
      }
    >
      <main>窗口内容</main>
    </WindowFrame>
  );
}`;

const tauriCode = `{
  "app": {
    "windows": [
      {
        "label": "main",
        "decorations": false,
        "shadow": true,
        "resizable": true
      }
    ]
  }
}`;

const actionLabels: Record<WindowAction, string> = {
  "start-dragging": "拖动窗口",
  minimize: "最小化",
  "toggle-maximize": "最大化 / 还原",
  close: "关闭",
};

export function WindowFramePage() {
  const [lastAction, setLastAction] = useState<WindowAction>("start-dragging");
  const [maximized, setMaximized] = useState(false);
  const [actionsAlign, setActionsAlign] = useState<WindowTitleBarActionsAlign>("right");
  const [showThemeSwitch, setShowThemeSwitch] = useState(true);
  const [previewTheme, setPreviewTheme] = useState<SiaThemeMode>("light");

  function handleAction(action: WindowAction) {
    setLastAction(action);
    if (action === "toggle-maximize") setMaximized((value) => !value);
  }

  return (
    <ComponentDocPage
      eyebrow="组件 / 布局 / WindowFrame"
      title="WindowFrame 自定义窗口"
      description="为 Tauri、Electron 等无系统装饰的桌面窗口提供统一外框、可拖动标题栏与窗口控制按钮。"
      name="WindowFrame / WindowTitleBar / WindowControls"
      apiRows={[
        { property: "WindowFrame.titleBar", description: "窗口顶部的自定义标题栏。", type: "ReactNode", defaultValue: "-" },
        { property: "WindowTitleBar.leading", description: "标题栏左侧品牌、图标或标题。", type: "ReactNode", defaultValue: "-" },
        { property: "WindowTitleBar.showThemeSwitch", description: "显示右侧浅色/深色切换入口，独立于业务动作和窗口控制组。", type: "boolean", defaultValue: "true" },
        { property: "WindowTitleBar.theme", description: "受控主题，由宿主更新并应用；省略时自动读取和切换文档根节点主题。", type: '"light" | "dark"', defaultValue: "文档主题，未设置时 light" },
        { property: "WindowTitleBar.onThemeChange", description: "点击后返回目标主题；受控时需回填 theme 并应用主题，外部变化不触发。", type: '(theme: "light" | "dark") => void', defaultValue: "-" },
        { property: "WindowTitleBar.actions", description: "窗口控制按钮前的业务操作区。", type: "ReactNode", defaultValue: "-" },
        { property: "WindowTitleBar.actionsAlign", description: "动作区放在标题栏左侧，或紧贴窗口控制按钮左侧。", type: "\"left\" | \"right\"", defaultValue: "\"right\"" },
        { property: "WindowTitleBar.controls", description: "显示默认控制组，或传入自定义控制节点。", type: "boolean | ReactNode", defaultValue: "true" },
        { property: "WindowTitleBar.draggable", description: "允许在非交互区域按下并触发拖动动作。", type: "boolean", defaultValue: "true" },
        // 图标对应宿主窗口状态，最大化与页面全屏使用不同的视觉符号。
        { property: "WindowTitleBar.maximized", description: "false 显示单方框，true 显示叠放方框和还原标签；由宿主回填真实窗口状态。", type: "boolean", defaultValue: "false" },
        { property: "WindowTitleBar.onWindowAction", description: "将拖动、最小化、最大化/还原和关闭动作交给桌面宿主。", type: "(action: WindowAction) => void | Promise<void>", defaultValue: "-" },
        { property: "WindowControls.disabledActions", description: "禁用指定窗口操作。", type: "WindowControlAction[]", defaultValue: "[]" },
      ]}
    >
      <DemoCard
        title="完整自定义窗口"
        description="标题栏默认提供浅色/深色切换，自动应用文档主题；空白区支持拖动和双击最大化，主题按钮不会触发窗口动作。"
        code={basicCode}
      >
        <div className="window-frame-demo">
          <div className="window-frame-demo__options">
            <span>功能按钮位置</span>
            <Segmented
              size="small"
              options={[
                { label: "居左", value: "left" },
                { label: "居右", value: "right" },
              ]}
              value={actionsAlign}
              onChange={(value) => setActionsAlign(value as WindowTitleBarActionsAlign)}
            />
          </div>
          <WindowFrame
            className="window-frame-demo__frame"
            titleBar={(
              <WindowTitleBar
                className="window-frame-demo__titlebar"
                leading={(
                  <div className="window-frame-demo__brand">
                    <Icon name="component" size={17} />
                    <strong>Sia Desktop</strong>
                  </div>
                )}
                actions={(
                  <>
                    <Button variant="text" size="small" icon={<Icon name="home" size={15} />}>
                      工作台
                    </Button>
                    <Button variant="text" size="small">同步</Button>
                  </>
                )}
                actionsAlign={actionsAlign}
                maximized={maximized}
                onWindowAction={handleAction}
              />
            )}
          >
            <div className="window-frame-demo__body">
              <aside>
                <Button variant="text" icon={<Icon name="folder" size={16} />}>项目</Button>
                <Button variant="text" icon={<Icon name="settings" size={16} />}>设置</Button>
              </aside>
              <main>
                <Icon name="desktop" size={34} />
                <strong>自定义窗口内容区</strong>
                <span>最近动作：<Tag status="processing">{actionLabels[lastAction]}</Tag></span>
              </main>
            </div>
          </WindowFrame>
        </div>
      </DemoCard>

      <DemoCard title="主题受控与隐藏入口" description="用 theme 和 onThemeChange 接入应用主题状态；此例仅改变窗口自身主题。showThemeSwitch=false 可隐藏默认入口，保留业务已有的主题按钮。" code={'const [theme, setTheme] = useState<"light" | "dark">("light");\n<WindowFrame data-sia-theme={theme} titleBar={<WindowTitleBar theme={theme} onThemeChange={setTheme} showThemeSwitch={showThemeSwitch} controls={false}>局部主题</WindowTitleBar>}>窗口内容</WindowFrame>'}>
        <Switch checked={showThemeSwitch} onCheckedChange={setShowThemeSwitch} label="显示标题栏主题按钮" />
        {/* 受控值和局部主题属性一起更新，不改变文档或其他窗口的主题。 */}
        <WindowFrame className="window-frame-theme-demo" data-sia-theme={previewTheme} style={{ height: 120, marginTop: 12 }} titleBar={<WindowTitleBar controls={false} theme={previewTheme} onThemeChange={setPreviewTheme} showThemeSwitch={showThemeSwitch} leading={<strong>局部主题</strong>} />}>
          <div style={{ padding: 16 }}>当前主题：{previewTheme === "dark" ? "深色" : "浅色"}</div>
        </WindowFrame>
      </DemoCard>

      <DemoCard
        title="Tauri 无边框配置"
        description="框架负责界面和交互分发；宿主仍需关闭系统装饰，并把 WindowAction 接到实际窗口 API 或 Rust 命令。"
        code={tauriCode}
        language="json"
      >
        <Alert
          status="info"
          title="宿主适配"
          description="浏览器程序使用 browser_window_action Rust 命令完成拖动、最小化、最大化/还原与关闭，其他桌面应用可以复用同一动作协议。"
          showIcon
        />
      </DemoCard>
    </ComponentDocPage>
  );
}
