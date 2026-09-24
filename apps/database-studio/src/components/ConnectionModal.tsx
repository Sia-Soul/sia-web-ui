import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Form,
  Icon,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  TextArea,
} from "@sia.soul/sia-react-ui";
import { defaultDatabase } from "../services/connectionDefaults";
import { testConnection } from "../services/databaseGateway";
import type { ConnectionProfile, DatabaseKind, McpStdioConfig } from "../types";

interface ConnectionModalProps {
  open: boolean;
  initialProfile?: ConnectionProfile;
  defaultKind?: DatabaseKind;
  onCancel: () => void;
  onSave: (profile: ConnectionProfile) => Promise<void> | void;
}

function defaultUsername(kind: DatabaseKind) {
  return kind === "postgres" ? "postgres" : kind === "mysql" ? "root" : kind === "sqlserver" ? "sa" : "";
}

function emptyProfile(kind: DatabaseKind = "postgres"): ConnectionProfile {
  return {
    id: `connection-${Date.now()}`,
    name: "新数据库连接",
    kind,
    connectionMode: "direct",
    host: "127.0.0.1",
    port: defaultPort(kind),
    database: defaultDatabase(kind),
    username: defaultUsername(kind),
    password: "",
    sslMode: "prefer",
    rememberPassword: false,
  };
}

/** 连接弹窗可直接粘贴的默认 MCP 配置示例。 */
const DEFAULT_MCP_CONFIG = JSON.stringify({
  postgres: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:password@host:5432/database"],
    disabled: false,
    autoApprove: [],
  },
}, null, 2);

interface ParsedMcpConfig {
  config: McpStdioConfig;
  serverName?: string;
}

/** 将已保存的 MCP 配置还原成便于编辑和复制的标准 JSON。 */
function formatMcpConfig(profile: ConnectionProfile) {
  if (!profile.mcp) return DEFAULT_MCP_CONFIG;
  return JSON.stringify({
    [profile.name.trim() || "database"]: {
      ...profile.mcp,
      disabled: false,
      autoApprove: [],
    },
  }, null, 2);
}

/** 兼容直接配置、单服务器包装和 `mcpServers` 包装三种常见 MCP JSON 结构。 */
function parseMcpConfig(text: string): ParsedMcpConfig {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (error) {
    throw new Error(`MCP 配置不是有效的 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!root || typeof root !== "object" || Array.isArray(root)) throw new Error("MCP 配置必须是 JSON 对象。");

  const rootRecord = root as Record<string, unknown>;
  const servers = rootRecord.mcpServers && typeof rootRecord.mcpServers === "object" && !Array.isArray(rootRecord.mcpServers)
    ? rootRecord.mcpServers as Record<string, unknown>
    : rootRecord;
  let serverName: string | undefined;
  let candidate: Record<string, unknown>;
  if (typeof servers.command === "string") {
    candidate = servers;
  } else {
    const entry = Object.entries(servers).find(([, value]) => value && typeof value === "object" && !Array.isArray(value));
    if (!entry) throw new Error("MCP 配置中没有找到包含 command 的服务器配置。");
    serverName = entry[0];
    candidate = entry[1] as Record<string, unknown>;
  }

  if (candidate.disabled === true) throw new Error("当前 MCP 配置已禁用，请将 disabled 改为 false 后重试。");
  const command = typeof candidate.command === "string" ? candidate.command.trim() : "";
  if (!command) throw new Error("MCP 配置缺少 command。");
  if (!Array.isArray(candidate.args) || !candidate.args.every((argument) => typeof argument === "string")) {
    throw new Error("MCP 配置的 args 必须是字符串数组。");
  }
  const env = candidate.env === undefined
    ? undefined
    : candidate.env && typeof candidate.env === "object" && !Array.isArray(candidate.env)
      ? Object.fromEntries(Object.entries(candidate.env as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
      : undefined;
  if (candidate.env !== undefined && env === undefined) throw new Error("MCP 配置的 env 必须是键值对象。");

  return {
    serverName,
    config: {
      command,
      args: [...candidate.args],
      env,
      toolName: typeof candidate.toolName === "string" && candidate.toolName.trim() ? candidate.toolName.trim() : "query",
    },
  };
}

/** 从常见数据库 URI 中提取非敏感连接元数据，供对象树和执行日志显示。 */
function applyMcpMetadata(profile: ConnectionProfile, parsed: ParsedMcpConfig): ConnectionProfile {
  const databaseUrl = parsed.config.args.find((argument) => /^(postgres(?:ql)?|mysql):\/\//i.test(argument));
  let metadata: Partial<ConnectionProfile> = {};
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      const kind: DatabaseKind = url.protocol.startsWith("mysql") ? "mysql" : "postgres";
      metadata = {
        kind,
        host: url.hostname || profile.host,
        port: url.port ? Number(url.port) : defaultPort(kind),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")) || profile.database,
        username: decodeURIComponent(url.username) || profile.username,
      };
    } catch {
      // 非标准 URI 仍可交给 MCP 服务器自行处理，弹窗保留用户填写的元数据。
    }
  }
  return {
    ...profile,
    ...metadata,
    name: profile.name === "新数据库连接" && parsed.serverName ? parsed.serverName : profile.name,
    connectionMode: "mcp",
    mcp: parsed.config,
    password: "",
  };
}

const KIND_OPTIONS = [
  { label: "PostgreSQL", value: "postgres", icon: <Icon name="database" size={16} /> },
  { label: "MySQL / MariaDB", value: "mysql", icon: <Icon name="database" size={16} /> },
  { label: "SQL Server", value: "sqlserver", icon: <Icon name="database" size={16} /> },
  { label: "SQLite", value: "sqlite", icon: <Icon name="file" size={16} /> },
];

function defaultPort(kind: DatabaseKind) {
  return kind === "postgres" ? 5432 : kind === "mysql" ? 3306 : kind === "sqlserver" ? 1433 : 0;
}

export function ConnectionModal({ open, initialProfile, defaultKind = "postgres", onCancel, onSave }: ConnectionModalProps) {
  const [profile, setProfile] = useState<ConnectionProfile>(() => initialProfile ?? emptyProfile(defaultKind));
  const [mcpConfigText, setMcpConfigText] = useState(() => formatMcpConfig(initialProfile ?? emptyProfile(defaultKind)));
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextProfile = initialProfile ? { ...initialProfile } : emptyProfile(defaultKind);
    setProfile(nextProfile);
    setMcpConfigText(formatMcpConfig(nextProfile));
    setTestState(null);
  }, [defaultKind, initialProfile, open]);

  function update<Key extends keyof ConnectionProfile>(key: Key, value: ConnectionProfile[Key]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setTestState(null);
  }

  function changeKind(value: string | number) {
    const kind = value as DatabaseKind;
    setProfile((current) => ({
      ...current,
      kind,
      port: defaultPort(kind),
      database: defaultDatabase(kind),
      username: defaultUsername(kind),
      sslMode: kind === "sqlite" ? "disable" : current.sslMode,
    }));
    setTestState(null);
  }

  /** 切换连接方式时保留数据库类型和显示信息，仅替换实际传输通道。 */
  function changeConnectionMode(value: string | number) {
    const connectionMode = value === "mcp" ? "mcp" : "direct";
    setProfile((current) => ({ ...current, connectionMode }));
    setTestState(null);
  }

  /** 返回经过校验并补齐 MCP 元数据的待连接配置。 */
  function resolvedProfile() {
    if (profile.connectionMode !== "mcp") return { ...profile, connectionMode: "direct" as const, mcp: undefined };
    return applyMcpMetadata(profile, parseMcpConfig(mcpConfigText));
  }

  async function handleTest() {
    setTesting(true);
    setTestState(null);
    try {
      const candidate = resolvedProfile();
      setProfile(candidate);
      const duration = await testConnection(candidate);
      setTestState({ type: "success", text: `连接成功 · ${duration} ms` });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setTestState({ type: "error", text });
      Modal.error({
        title: "测试连接失败",
        children: text,
        centered: true,
        width: 560,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const candidate = resolvedProfile();
      if (!candidate.name.trim() || !candidate.database.trim()) {
        setTestState({ type: "error", text: "请填写连接名称和数据库信息。" });
        return;
      }
      setProfile(candidate);
      await onSave({ ...candidate, name: candidate.name.trim(), database: candidate.database.trim() });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setTestState({ type: "error", text });
      Modal.error({
        title: "保存并连接失败",
        children: text,
        centered: true,
        width: 560,
      });
    } finally {
      setSaving(false);
    }
  }

  const sqlite = profile.kind === "sqlite";
  const mcp = profile.connectionMode === "mcp";

  return (
    <Modal
      open={open}
      title={initialProfile ? "编辑连接" : "新建连接"}
      width={700}
      centered
      footer={(
        <div className="connection-modal__footer">
          <div className={`connection-test-state${testState ? ` is-${testState.type}` : ""}`} role="status">
            {testState ? <Icon name={testState.type === "success" ? "circle-check" : "circle-close"} size={16} /> : null}
            <span>{testState?.text ?? (mcp
              ? "MCP 配置可能包含连接凭据；勾选安全保存后将写入系统凭据存储。"
              : "勾选“记住密码”后，密码会保存到系统安全凭据存储。")}</span>
          </div>
          <Button onClick={() => void handleTest()} loading={testing}>测试连接</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving}>保存并连接</Button>
        </div>
      )}
      onCancel={onCancel}
    >
      <Form layout="vertical" className="connection-form">
        <Form.Item label="连接方式" className="connection-form__full">
          <Segmented
            block
            options={[
              { label: "数据库直连", value: "direct", icon: <Icon name="database" size={16} /> },
              { label: "MCP（stdio）", value: "mcp", icon: <Icon name="code" size={16} /> },
            ]}
            value={profile.connectionMode ?? "direct"}
            onChange={changeConnectionMode}
          />
        </Form.Item>

        <Form.Item label="数据库类型" className="connection-form__full">
          <Segmented block options={KIND_OPTIONS} value={profile.kind} onChange={changeKind} />
        </Form.Item>

        <Form.Item label="连接名称" required>
          <Input value={profile.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：生产数据库" />
        </Form.Item>

        {mcp ? (
          <>
            <Form.Item label="默认数据库" required>
              <Input value={profile.database} onChange={(event) => update("database", event.target.value)} placeholder={defaultDatabase(profile.kind)} />
            </Form.Item>
            <Form.Item
              label="MCP 服务器配置"
              className="connection-form__full"
              extra="支持直接配置、单服务器对象或 mcpServers 对象；可用 toolName 指定 SQL 工具，默认为 query。当前按单数据库只读连接处理。"
              required
            >
              <TextArea
                className="connection-mcp-config"
                rows={10}
                value={mcpConfigText}
                spellCheck={false}
                onChange={(event) => {
                  setMcpConfigText(event.target.value);
                  setTestState(null);
                }}
              />
            </Form.Item>
          </>
        ) : sqlite ? (
          <Form.Item label="数据库文件" required>
            <Input value={profile.database} onChange={(event) => update("database", event.target.value)} placeholder="例如：data/orders.sqlite3" prefix={<Icon name="file" size={15} />} />
          </Form.Item>
        ) : (
          <>
            <Form.Item label="主机" required>
              <Input value={profile.host} onChange={(event) => update("host", event.target.value)} placeholder="127.0.0.1" />
            </Form.Item>
            <Form.Item label="端口" required>
              <InputNumber value={profile.port} min={1} max={65535} onChange={(value) => update("port", value ?? defaultPort(profile.kind))} />
            </Form.Item>
            <Form.Item label="默认数据库" required>
              <Input value={profile.database} onChange={(event) => update("database", event.target.value)} placeholder={defaultDatabase(profile.kind)} />
            </Form.Item>
            <Form.Item label="用户名" required>
              <Input value={profile.username} onChange={(event) => update("username", event.target.value)} autoComplete="username" />
            </Form.Item>
            <Form.Item label="密码">
              <Input type="password" value={profile.password} onChange={(event) => update("password", event.target.value)} autoComplete="current-password" />
            </Form.Item>
          </>
        )}

        {!mcp && !sqlite ? (
          <Form.Item label="SSL 模式">
            <Select
              value={profile.sslMode}
              options={[
                { label: "优先", value: "prefer" },
                { label: "必须", value: "require" },
                { label: "禁用", value: "disable" },
              ]}
              onChange={(value) => update("sslMode", (value ?? "prefer") as ConnectionProfile["sslMode"])}
            />
          </Form.Item>
        ) : null}

        {!sqlite ? (
          <Form.Item className="connection-form__full">
            <Checkbox checked={profile.rememberPassword} onChange={(checked) => update("rememberPassword", checked)}>
              {mcp ? "安全保存 MCP 配置" : "记住密码"}
            </Checkbox>
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
