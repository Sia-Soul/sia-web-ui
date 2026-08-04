import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Icon,
  Input,
  Modal,
  Tag,
  Upload,
  message,
} from "@sia-ui/react";

export interface PasswordSubmission {
  tabId: string;
  credentialId?: string;
  origin: string;
  username: string;
  password: string;
  isUpdate: boolean;
}

export interface PasswordCredentialSummary {
  id: string;
  name: string;
  origin: string;
  username: string;
  source: string;
  createdAt: number;
  updatedAt: number;
}

interface PasswordCredential extends PasswordCredentialSummary {
  password: string;
}

interface PasswordCredentialDraft {
  id?: string;
  name: string;
  origin: string;
  username: string;
  password: string;
}

export interface PasswordImportEntry {
  name?: string;
  origin: string;
  username: string;
  password: string;
}

export interface PasswordImportResult {
  imported: number;
  updated: number;
  skipped: number;
}

interface PasswordManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_DRAFT: PasswordCredentialDraft = {
  name: "",
  origin: "",
  username: "",
  password: "",
};

async function invokePasswordCommand<T>(command: string, args?: Record<string, unknown>) {
  if (!window.__TAURI__) throw new Error("密码管理仅在桌面版中可用");
  return window.__TAURI__.core.invoke<T>(command, args);
}

function parseCsvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "\"" && source[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function findHeader(headers: readonly string[], aliases: readonly string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => normalizedAliases.has(normalizeHeader(header)));
}

export function parsePasswordCsv(source: string): PasswordImportEntry[] {
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new Error("CSV 文件中没有可导入的密码");
  const headers = rows[0];
  const originIndex = findHeader(headers, ["url", "origin", "website", "site", "网址", "网站"]);
  const usernameIndex = findHeader(headers, ["username", "user", "login", "用户名", "账号"]);
  const passwordIndex = findHeader(headers, ["password", "pass", "密码"]);
  const nameIndex = findHeader(headers, ["name", "title", "名称", "标题"]);
  if (originIndex < 0 || passwordIndex < 0) {
    throw new Error("无法识别 CSV：至少需要 url 和 password 列");
  }

  return rows.slice(1).flatMap((row) => {
    const origin = row[originIndex]?.trim() ?? "";
    const password = row[passwordIndex] ?? "";
    if (!origin || !password) return [];
    return [{
      name: nameIndex >= 0 ? row[nameIndex]?.trim() : undefined,
      origin,
      username: usernameIndex >= 0 ? row[usernameIndex]?.trim() ?? "" : "",
      password,
    }];
  });
}

export function formatUpdatedAt(value: number) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default function PasswordManagerModal({
  open,
  onOpenChange,
}: PasswordManagerModalProps) {
  const [credentials, setCredentials] = useState<PasswordCredentialSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PasswordCredentialDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const filteredCredentials = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    if (!keyword) return credentials;
    return credentials.filter((credential) => (
      credential.name.toLocaleLowerCase().includes(keyword)
      || credential.origin.toLocaleLowerCase().includes(keyword)
      || credential.username.toLocaleLowerCase().includes(keyword)
    ));
  }, [credentials, search]);

  async function loadCredentials() {
    setLoading(true);
    try {
      const next = await invokePasswordCommand<PasswordCredentialSummary[]>("list_browser_passwords");
      setCredentials(next);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadCredentials();
  }, [open]);

  function openNewCredential() {
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  async function openCredentialEditor(id: string) {
    try {
      const credential = await invokePasswordCommand<PasswordCredential>("get_browser_password", { id });
      setDraft({
        id: credential.id,
        name: credential.name,
        origin: credential.origin,
        username: credential.username,
        password: credential.password,
      });
      setEditorOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveCredential() {
    if (!draft.origin.trim()) {
      message.warning("请输入网站地址");
      return false;
    }
    if (!draft.password) {
      message.warning("请输入密码");
      return false;
    }
    setSaving(true);
    try {
      await invokePasswordCommand("save_browser_password", {
        credential: {
          ...draft,
          name: draft.name.trim() || undefined,
          origin: draft.origin.trim(),
          username: draft.username.trim(),
        },
      });
      message.success(draft.id ? "密码已更新" : "密码已添加");
      setEditorOpen(false);
      await loadCredentials();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteCredential(credential: PasswordCredentialSummary) {
    Modal.confirm({
      title: "删除保存的密码",
      children: `确定删除 ${credential.origin} 中“${credential.username || "未命名账号"}”的密码吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        await invokePasswordCommand("delete_browser_password", { id: credential.id });
        message.success("密码已删除");
        await loadCredentials();
      },
    });
  }

  async function importPasswordFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      message.error("CSV 文件不能超过 10 MB");
      return;
    }
    try {
      const entries = parsePasswordCsv(await file.text());
      if (entries.length === 0) throw new Error("CSV 文件中没有有效密码");
      const result = await invokePasswordCommand<PasswordImportResult>("import_browser_passwords", {
        entries,
        source: file.name,
      });
      message.success(`已导入 ${result.imported} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`);
      await loadCredentials();
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <Modal
        className="password-manager-modal"
        open={open}
        title="密码管理"
        width={860}
        centered
        footer={null}
        onOpenChange={onOpenChange}
      >
        <div className="password-manager">
          <Alert
            type="info"
            showIcon
            message="密码由 Windows 当前用户加密保护"
            description="支持导入 Chrome、Edge、Firefox 和 Safari 导出的 CSV。CSV 中的密码是明文，导入完成后请立即删除原文件。"
          />
          <div className="password-manager__toolbar">
            <Input
              value={search}
              prefix={<Icon name="search" size={15} />}
              allowClear
              placeholder="搜索网站或用户名"
              onChange={(event) => setSearch(event.target.value)}
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
              <Button icon={<Icon name="upload" size={15} />}>从浏览器导入</Button>
            </Upload>
            <Button
              variant="primary"
              icon={<Icon name="plus" size={15} />}
              onClick={openNewCredential}
            >
              添加密码
            </Button>
          </div>

          <div className="password-manager__list" aria-busy={loading}>
            {loading ? (
              <div className="password-manager__empty">
                <Icon name="loader" size={22} spin />
                <span>正在读取加密密码库…</span>
              </div>
            ) : filteredCredentials.length === 0 ? (
              <div className="password-manager__empty">
                <Icon name="key" size={28} />
                <strong>{credentials.length === 0 ? "还没有保存密码" : "没有匹配的密码"}</strong>
                <span>{credentials.length === 0 ? "登录网站时可保存，或从其他浏览器导入。" : "请尝试其他搜索关键词。"}</span>
              </div>
            ) : (
              <>
                <div className="password-manager__header" aria-hidden="true">
                  <span />
                  <span>网站</span>
                  <span>用户名</span>
                  <span>来源</span>
                  <span>操作</span>
                </div>
                {filteredCredentials.map((credential) => (
                  <div className="password-manager__row" key={credential.id}>
                    <span className="password-manager__site-icon" aria-hidden="true">
                      <Icon name="key" size={16} />
                    </span>
                    <div className="password-manager__identity">
                      <strong title={credential.name || credential.origin}>
                        {credential.name || credential.origin}
                      </strong>
                      <span title={credential.origin}>{credential.origin}</span>
                    </div>
                    <div className="password-manager__username">
                      <span title={credential.username || "未填写用户名"}>
                        {credential.username || "未填写用户名"}
                      </span>
                      <small>更新于 {formatUpdatedAt(credential.updatedAt)}</small>
                    </div>
                    <div className="password-manager__source" title={credential.source || "Sia Browser"}>
                      <Tag>{credential.source || "Sia Browser"}</Tag>
                    </div>
                    <div className="password-manager__actions">
                      <Button
                        variant="text"
                        size="small"
                        icon={<Icon name="edit" size={15} />}
                        aria-label={`编辑 ${credential.origin}`}
                        title="编辑"
                        onClick={() => void openCredentialEditor(credential.id)}
                      />
                      <Button
                        variant="text"
                        size="small"
                        danger
                        icon={<Icon name="trash" size={15} />}
                        aria-label={`删除 ${credential.origin}`}
                        title="删除"
                        onClick={() => confirmDeleteCredential(credential)}
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        className="password-editor-modal"
        open={editorOpen}
        title={draft.id ? "编辑密码" : "添加密码"}
        width={440}
        centered
        okText="保存"
        confirmLoading={saving}
        onOk={saveCredential}
        onOpenChange={setEditorOpen}
      >
        <div className="password-editor">
          <label htmlFor="password-site">网站地址</label>
          <Input
            id="password-site"
            value={draft.origin}
            autoFocus
            placeholder="https://example.com"
            onChange={(event) => setDraft((current) => ({ ...current, origin: event.target.value }))}
          />
          <label htmlFor="password-name">名称</label>
          <Input
            id="password-name"
            value={draft.name}
            placeholder="可选，例如：公司后台"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <label htmlFor="password-username">用户名</label>
          <Input
            id="password-username"
            value={draft.username}
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
          />
          <label htmlFor="password-value">密码</label>
          <Input
            id="password-value"
            type="password"
            value={draft.password}
            autoComplete="new-password"
            onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}
