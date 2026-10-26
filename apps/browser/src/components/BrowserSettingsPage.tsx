import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Icon,
  Input,
  Modal,
  Switch,
  Table,
  Upload,
  message,
} from "@sia.soul/sia-react-ui";
import {
  formatUpdatedAt,
  parsePasswordCsv,
  type PasswordCredentialSummary,
  type PasswordImportResult,
} from "./PasswordManagerModal";
import { ROOT_GROUP_ID, type BrowserGroup } from "../browserTypes";
import { extensionScopeLabel, type ExtensionScope } from "../extensionScopes";
import ExtensionScopeEditor from "./ExtensionScopeEditor";
import BrowserPasswordCell from "./BrowserPasswordCell";

export type BrowserSettingsSection = "general" | "privacy" | "passwords" | "extensions" | "downloads";

interface BrowserSettingsPageProps {
  /** 当前父子分组，用于设置扩展生效范围。 */
  groups: readonly BrowserGroup[];
  activeDownloadCount: number;
  askBeforeDownload: boolean;
  downloadDirectory: string;
  downloadCount: number;
  initialSection?: BrowserSettingsSection;
  onAskBeforeDownloadChange: (checked: boolean) => void;
  onChooseDownloadDirectory: () => void;
  onOpenDownloads: () => void;
  onOpenDefaultBrowserSettings: () => void;
  onOpenExtensionOptions: (extension: BrowserExtensionRecord) => Promise<string | undefined>;
}

interface SettingsNavigationItem {
  key: BrowserSettingsSection;
  label: string;
}

export interface BrowserExtensionRecord {
  id: string;
  browserId?: string;
  name: string;
  version: string;
  description: string;
  source: string;
  enabled: boolean;
  /** null 或缺省表示所有分组；空数组表示没有允许的分组。 */
  scopes?: ExtensionScope[] | null;
  optionsPage?: string;
  /** 是否在主窗口工具栏显示扩展快捷入口，旧记录默认为 false。 */
  pinned?: boolean;
  /** 原生端从受管扩展目录读取的位图数据地址；缺失时使用框架图标。 */
  iconUrl?: string;
}

interface BrowserExtensionCandidate {
  id: string;
  browserId: string;
  name: string;
  version: string;
  description: string;
  browser: string;
  profile: string;
  path: string;
  installed: boolean;
}

const SETTINGS_NAVIGATION: readonly SettingsNavigationItem[] = [
  { key: "general", label: "常规" },
  { key: "privacy", label: "隐私与安全" },
  { key: "passwords", label: "密码" },
  { key: "extensions", label: "扩展程序" },
  { key: "downloads", label: "下载" },
];

async function invokeSettingsCommand<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("此功能仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

function sectionCopy(section: BrowserSettingsSection) {
  switch (section) {
    case "general":
      return { title: "常规", description: "管理 西娅浏览器的基本行为和外观。" };
    case "privacy":
      return { title: "隐私与安全", description: "管理会话隔离、缓存与站点数据。" };
    case "passwords":
      return { title: "密码", description: "查看和管理已保存的站点账号，点击眼睛查看密码，或直接复制密码。" };
    case "extensions":
      return { title: "扩展程序", description: "导入 Chrome、Edge 已安装的扩展，或加载本地已解压扩展。" };
    case "downloads":
      return { title: "下载", description: "管理下载记录和保存位置。" };
  }
}

export default function BrowserSettingsPage({
  groups,
  activeDownloadCount,
  askBeforeDownload,
  downloadDirectory,
  downloadCount,
  initialSection = "general",
  onAskBeforeDownloadChange,
  onChooseDownloadDirectory,
  onOpenDownloads,
  onOpenDefaultBrowserSettings,
  onOpenExtensionOptions,
}: BrowserSettingsPageProps) {
  const [section, setSection] = useState<BrowserSettingsSection>(initialSection);
  const [credentials, setCredentials] = useState<PasswordCredentialSummary[]>([]);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSearch, setPasswordSearch] = useState("");
  const scopeGroups: readonly BrowserGroup[] = [{ id: ROOT_GROUP_ID, name: "未分组", color: "", smallGroups: [] }, ...groups];
  const [scopeExtension, setScopeExtension] = useState<BrowserExtensionRecord>();
  const [extensions, setExtensions] = useState<BrowserExtensionRecord[]>([]);
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionActionId, setExtensionActionId] = useState<string>();
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<BrowserExtensionCandidate[]>([]);
  const copy = sectionCopy(section);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const filteredCredentials = useMemo(() => {
    const keyword = passwordSearch.trim().toLocaleLowerCase();
    if (!keyword) return credentials;
    return credentials.filter((credential) => (
      credential.name.toLocaleLowerCase().includes(keyword)
      || credential.origin.toLocaleLowerCase().includes(keyword)
      || credential.username.toLocaleLowerCase().includes(keyword)
    ));
  }, [credentials, passwordSearch]);

  async function loadCredentials() {
    if (!window.__TAURI__) return;
    setPasswordLoading(true);
    try {
      const next = await invokeSettingsCommand<PasswordCredentialSummary[]>("list_browser_passwords");
      setCredentials(next);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setPasswordLoading(false);
    }
  }

  async function loadExtensions() {
    if (!window.__TAURI__) return;
    setExtensionLoading(true);
    try {
      setExtensions(await invokeSettingsCommand<BrowserExtensionRecord[]>("list_browser_extensions"));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionLoading(false);
    }
  }

  useEffect(() => {
    if (section === "passwords") void loadCredentials();
    if (section === "extensions") void loadExtensions();
  }, [section]);

  async function scanBrowserExtensions() {
    setScanOpen(true);
    setScanLoading(true);
    try {
      setScanCandidates(
        await invokeSettingsCommand<BrowserExtensionCandidate[]>("scan_browser_extensions"),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      setScanOpen(false);
    } finally {
      setScanLoading(false);
    }
  }

  async function installExtension(
    path: string,
    source: string,
    browserId?: string,
    actionId = path,
  ) {
    setExtensionActionId(actionId);
    try {
      const installed = await invokeSettingsCommand<BrowserExtensionRecord>(
        "install_browser_extension",
        { path, source, browserId },
      );
      message.success(`扩展“${installed.name}”已安装并启用`);
      await loadExtensions();
      setScanCandidates((current) => current.map((candidate) => (
        candidate.browserId === browserId ? { ...candidate, installed: true } : candidate
      )));
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionActionId(undefined);
    }
  }

  async function installUnpackedExtension() {
    try {
      const path = await invokeSettingsCommand<string | null>("pick_browser_extension_folder");
      if (!path) return;
      await installExtension(path, "本地已解压扩展", undefined, "pick-unpacked");
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function setExtensionEnabled(extension: BrowserExtensionRecord, enabled: boolean) {
    setExtensionActionId(extension.id);
    try {
      const updated = await invokeSettingsCommand<BrowserExtensionRecord>(
        "set_browser_extension_enabled",
        { id: extension.id, enabled },
      );
      setExtensions((current) => current.map((item) => (
        item.id === extension.id ? updated : item
      )));
      message.success(`已${enabled ? "启用" : "停用"}“${extension.name}”`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionActionId(undefined);
    }
  }

  function confirmRemoveExtension(extension: BrowserExtensionRecord) {
    Modal.confirm({
      title: "删除扩展",
      children: `确定从 西娅浏览器中删除“${extension.name}”及其本地扩展文件吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        setExtensionActionId(extension.id);
        try {
          await invokeSettingsCommand("remove_browser_extension", { id: extension.id });
          setExtensions((current) => current.filter((item) => item.id !== extension.id));
          setScanCandidates((current) => current.map((candidate) => (
            candidate.browserId === extension.browserId
              ? { ...candidate, installed: false }
              : candidate
          )));
          message.success(`已删除“${extension.name}”`);
        } finally {
          setExtensionActionId(undefined);
        }
      },
    });
  }

  async function openExtensionOptions(extension: BrowserExtensionRecord) {
    const optionsPage = extension.optionsPage?.trim();
    if (!optionsPage) {
      message.warning(`扩展“${extension.name}”没有提供配置页面`);
      return;
    }
    if (!extension.enabled) {
      message.warning(`请先启用扩展“${extension.name}”，再打开配置页面`);
      return;
    }

    setExtensionActionId(extension.id);
    try {
      const browserId = await onOpenExtensionOptions(extension);
      if (browserId && browserId !== extension.browserId) {
        setExtensions((current) => current.map((item) => (
          item.id === extension.id ? { ...item, browserId } : item
        )));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionActionId(undefined);
    }
  }

  async function importPasswordFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      message.error("CSV 文件不能超过 10 MB");
      return;
    }
    try {
      const entries = parsePasswordCsv(await file.text());
      if (entries.length === 0) throw new Error("CSV 文件中没有有效密码");
      const result = await invokeSettingsCommand<PasswordImportResult>("import_browser_passwords", {
        entries,
        source: file.name,
      });
      message.success(`已导入 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`);
      await loadCredentials();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function confirmDeleteCredential(credential: PasswordCredentialSummary) {
    Modal.confirm({
      title: "删除保存的密码",
      children: `确定删除 ${credential.origin} 中“${credential.username || "未命名账号"}”的密码吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        await invokeSettingsCommand("delete_browser_password", { id: credential.id });
        message.success("密码已删除");
        await loadCredentials();
      },
    });
  }

  function renderGeneral() {
    return (
      <div className="browser-settings__cards">
        <section className="browser-settings-card browser-settings-card--row">
          <div>
            <h3>默认浏览器</h3>
            {/* 默认关联由系统确认，按钮优先定位本应用详情，旧系统由调用方提供选择提示。 */}
            <p>打开西娅浏览器的系统关联设置，在其中确认设为默认浏览器。</p>
          </div>
          <Button variant="primary" onClick={onOpenDefaultBrowserSettings}>
            设为默认浏览器
          </Button>
        </section>
      </div>
    );
  }

  function renderPrivacy() {
    return (
      <div className="browser-settings__cards">
        <section className="browser-settings-card">
          {/* 隔离以稳定的小分组标识为单位，大分组直属标签也有自己的默认空间。 */}
          <p>西娅浏览器的每个小分组使用独立的 Cookie、缓存和本地存储。</p>
          <p className="browser-settings-card__hint">
            同一小分组内共享登录状态，不同小分组互不共享。大分组直属标签使用单独的数据空间，与其下的小分组隔离。
          </p>
        </section>
      </div>
    );
  }

  function renderPasswords() {
    return (
      <div className="browser-settings-passwords">
        <Alert
          type="info"
          showIcon
          message="密码使用 Windows 系统安全存储加密"
          description="密码默认隐藏，点击显示、复制或回填时读取。CSV 中的密码是明文，导入完成后请立即删除原文件。"
        />
        <div className="browser-settings-passwords__toolbar">
          <Input
            value={passwordSearch}
            prefix={<Icon name="search" size={16} />}
            allowClear
            placeholder="搜索站点或账号"
            onChange={(event) => setPasswordSearch(event.target.value)}
          />
          <Upload
            accept=".csv,text/csv"
            maxCount={1}
            showUploadList={false}
            beforeUpload={async (file) => {
              await importPasswordFile(file);
              return Upload.LIST_IGNORE as never;
            }}
          >
            <Button variant="primary" icon={<Icon name="upload" size={16} />}>
              从 Edge 导入 CSV
            </Button>
          </Upload>
        </div>
        <section className="browser-settings-list" aria-busy={passwordLoading}>
          <header className="browser-settings-list__header">
            <strong>已保存的账号</strong>
            <span>已保存 {credentials.length} 个账号</span>
          </header>
          {/* 使用 Sia 表格统一列布局；固定行高与虚拟滚动适配大量已保存账号。 */}
          <Table
            className="browser-settings-passwords__table"
            rowKey="id"
            dataSource={filteredCredentials.map((credential) => ({ ...credential }))}
            loading={passwordLoading}
            emptyText="没有匹配的已保存账号"
            maxBodyHeight={480}
            rowHeight={56}
            columnBordered={false}
            columns={[
              {
                key: "origin", name: "网站", width: 240,
                render: (_, credential) => (
                  <div className="browser-settings-credential__site">
                    <strong>{credential.name || credential.origin}</strong>
                    <span>{credential.origin}</span>
                  </div>
                ),
              },
              { key: "username", name: "账号", width: 190, render: (value) => String(value || "未命名账号") },
              {
                key: "password", name: "密码", width: 230,
                render: (_, credential) => (
                  <BrowserPasswordCell key={`${credential.id}:${credential.updatedAt}`} credentialId={credential.id} />
                ),
              },
              { key: "updatedAt", name: "更新时间", width: 115, render: (_, credential) => formatUpdatedAt(credential.updatedAt) },
              {
                key: "actions", name: "操作", width: 85, fixed: "right",
                render: (_, credential) => (
                  <Button danger size="small" onClick={() => confirmDeleteCredential(credential)}>删除</Button>
                ),
              },
            ]}
          />
        </section>
      </div>
    );
  }

  function renderExtensions() {
    return (
      <div className="browser-settings-extensions">
        <Alert
          type="info"
          showIcon
          message="WebView2 仅兼容部分 Chrome 扩展 API"
          description="扩展统一安装，可按父分组或子分组启用。各隔离分组中的扩展本地设置独立保存；依赖账号同步或商店专用接口的扩展可能无法使用。"
        />
        <div className="browser-settings-extensions__actions">
          <Button
            variant="primary"
            icon={<Icon name="search" size={16} />}
            loading={scanLoading}
            onClick={() => void scanBrowserExtensions()}
          >
            扫描 Chrome / Edge
          </Button>
          <Button
            icon={<Icon name="folder" size={16} />}
            loading={extensionActionId === "pick-unpacked"}
            onClick={() => void installUnpackedExtension()}
          >
            安装已解压扩展
          </Button>
        </div>
        <section className="browser-settings-list" aria-busy={extensionLoading}>
          <header className="browser-settings-list__header">
            <strong>已安装的扩展</strong>
            <span>共 {extensions.length} 个</span>
          </header>
          {extensionLoading ? (
            <div className="browser-settings-list__empty">
              <Icon name="loader" size={22} spin />
              <span>正在读取扩展…</span>
            </div>
          ) : extensions.length === 0 ? (
            <div className="browser-settings-list__empty">暂未安装扩展</div>
          ) : extensions.map((extension) => (
            <div className="browser-settings-extension" key={extension.id}>
              <span className="browser-settings-extension__icon" aria-hidden="true">
                <Icon name="component" size={22} />
              </span>
              <div className="browser-settings-extension__summary">
                <div>
                  <strong>{extension.name}</strong>
                  <small>v{extension.version}</small>
                </div>
                <span>{extension.description || "该扩展未提供说明"}</span>
                <small>{extension.source}</small>
                <small>生效范围：{extensionScopeLabel(extension.scopes, scopeGroups)}</small>
              </div>
              <div className="browser-settings-extension__actions">
                <Button size="small" disabled={Boolean(extensionActionId)} onClick={() => setScopeExtension(extension)}>生效分组</Button>
                <Button
                  size="small"
                  disabled={extensionActionId === extension.id}
                  onClick={() => void openExtensionOptions(extension)}
                >
                  选项
                </Button>
                <Switch
                  checked={extension.enabled}
                  disabled={extensionActionId === extension.id}
                  aria-label={`${extension.enabled ? "停用" : "启用"}${extension.name}`}
                  onCheckedChange={(checked) => void setExtensionEnabled(extension, checked)}
                />
                <Button
                  danger
                  size="small"
                  disabled={extensionActionId === extension.id}
                  onClick={() => confirmRemoveExtension(extension)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </section>
        {scopeExtension ? <ExtensionScopeEditor extension={scopeExtension} groups={scopeGroups}
          onClose={() => setScopeExtension(undefined)}
          onSave={async (scopes) => {
            const updated = await invokeSettingsCommand<BrowserExtensionRecord>("set_browser_extension_scopes", { id: scopeExtension.id, scopes });
            setExtensions((current) => current.map((item) => item.id === updated.id ? updated : item));
            message.success("已更新扩展生效分组");
          }} /> : null}
        <Modal
          open={scanOpen}
          title="从 Chrome / Edge 导入扩展"
          width={760}
          footer={null}
          onCancel={() => setScanOpen(false)}
          onOpenChange={setScanOpen}
        >
          <div className="browser-extension-scan">
            {scanLoading ? (
              <div className="browser-settings-list__empty">
                <Icon name="loader" size={22} spin />
                <span>正在扫描本机浏览器扩展…</span>
              </div>
            ) : scanCandidates.length === 0 ? (
              <div className="browser-settings-list__empty">
                没有在 Chrome 或 Edge 的本地配置中发现扩展
              </div>
            ) : scanCandidates.map((candidate) => (
              <div className="browser-extension-scan__item" key={candidate.id}>
                <span className="browser-settings-extension__icon" aria-hidden="true">
                  <Icon name="component" size={20} />
                </span>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>
                    {candidate.browser} · {candidate.profile} · v{candidate.version}
                  </span>
                </div>
                <Button
                  size="small"
                  variant={candidate.installed ? "default" : "primary"}
                  disabled={candidate.installed}
                  loading={extensionActionId === candidate.id}
                  onClick={() => void installExtension(
                    candidate.path,
                    `${candidate.browser} · ${candidate.profile}`,
                    candidate.browserId,
                    candidate.id,
                  )}
                >
                  {candidate.installed ? "已安装" : "安装"}
                </Button>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    );
  }

  function renderDownloads() {
    return (
      <div className="browser-settings__cards">
        <section className="browser-settings-card browser-download-settings-card">
          <div className="browser-download-settings-row">
            <div className="browser-download-settings-copy">
              <h3>位置</h3>
              <p className="browser-download-settings-path">
                {downloadDirectory || "正在获取系统下载目录…"}
              </p>
            </div>
            <Button onClick={onChooseDownloadDirectory}>更改</Button>
          </div>
          <div className="browser-download-settings-divider" />
          <div className="browser-download-settings-row">
            <div className="browser-download-settings-copy">
              <h3>在下载之前询问每个文件的保存位置</h3>
              <p>始终询问我是要保存文件还是打开它而不保存</p>
            </div>
            <Switch
              checked={askBeforeDownload}
              aria-label="在下载之前询问每个文件的保存位置"
              onCheckedChange={onAskBeforeDownloadChange}
            />
          </div>
        </section>
        <section className="browser-settings-card browser-settings-card--row">
          <div>
            <h3>下载任务</h3>
            <p>
              {activeDownloadCount > 0
                ? `当前有 ${activeDownloadCount} 个下载任务正在进行，已记录 ${downloadCount} 个任务。`
                : `当前没有进行中的下载任务，已记录 ${downloadCount} 个任务。`}
            </p>
            <p className="browser-settings-card__hint">也可以通过工具栏的下载按钮随时查看当前任务。</p>
          </div>
          <Button icon={<Icon name="download" size={16} />} onClick={onOpenDownloads}>
            查看下载
          </Button>
        </section>
      </div>
    );
  }

  return (
    <section className="browser-settings-page">
      <aside className="browser-settings-sidebar">
        <h1>设置</h1>
        <nav aria-label="设置分类">
          {SETTINGS_NAVIGATION.map((item) => (
            <Button
              key={item.key}
              className={`browser-settings-nav-item${section === item.key ? " is-active" : ""}`}
              variant="text"
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="browser-settings-main">
        <header className="browser-settings-heading">
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </header>
        {section === "general" ? renderGeneral() : null}
        {section === "privacy" ? renderPrivacy() : null}
        {section === "passwords" ? renderPasswords() : null}
        {section === "extensions" ? renderExtensions() : null}
        {section === "downloads" ? renderDownloads() : null}
      </main>
    </section>
  );
}
