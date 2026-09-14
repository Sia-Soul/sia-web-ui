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
} from "@sia.soul/sia-react-ui";
import { defaultDatabase } from "../services/connectionDefaults";
import { testConnection } from "../services/databaseGateway";
import type { ConnectionProfile, DatabaseKind } from "../types";

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
    host: "127.0.0.1",
    port: defaultPort(kind),
    database: defaultDatabase(kind),
    username: defaultUsername(kind),
    password: "",
    sslMode: "prefer",
    rememberPassword: false,
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
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setProfile(initialProfile ? { ...initialProfile } : emptyProfile(defaultKind));
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

  async function handleTest() {
    setTesting(true);
    setTestState(null);
    try {
      const duration = await testConnection(profile);
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
    if (!profile.name.trim() || !profile.database.trim()) {
      setTestState({ type: "error", text: "请填写连接名称和数据库信息。" });
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...profile, name: profile.name.trim(), database: profile.database.trim() });
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
            <span>{testState?.text ?? "勾选“记住密码”后，密码会保存到系统安全凭据存储。"}</span>
          </div>
          <Button onClick={() => void handleTest()} loading={testing}>测试连接</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving}>保存并连接</Button>
        </div>
      )}
      onCancel={onCancel}
    >
      <Form layout="vertical" className="connection-form">
        <Form.Item label="数据库类型" className="connection-form__full">
          <Segmented block options={KIND_OPTIONS} value={profile.kind} onChange={changeKind} />
        </Form.Item>

        <Form.Item label="连接名称" required>
          <Input value={profile.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：生产数据库" />
        </Form.Item>

        {sqlite ? (
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

        {!sqlite ? (
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
              记住密码
            </Checkbox>
          </Form.Item>
        ) : null}
      </Form>
    </Modal>
  );
}
