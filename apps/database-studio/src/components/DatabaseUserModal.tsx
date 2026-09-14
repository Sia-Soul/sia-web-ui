import { useEffect, useState } from "react";
import { Button, Form, Input, Modal, Tag } from "@sia.soul/sia-react-ui";
import type { DatabaseKind, DatabaseUser, DatabaseUserInput } from "../types";

interface DatabaseUserModalProps {
  open: boolean;
  mode: "create" | "edit";
  kind: DatabaseKind;
  user?: DatabaseUser;
  onCancel: () => void;
  onSave: (input: DatabaseUserInput) => Promise<void>;
}

export function DatabaseUserModal({
  open,
  mode,
  kind,
  user,
  onCancel,
  onSave,
}: DatabaseUserModalProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("%");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setHost(user?.host ?? "%");
    setPassword("");
  }, [open, user]);

  async function save() {
    if (!name.trim()) {
      Modal.error({ title: "用户信息不完整", children: "请输入用户名。", centered: true });
      return;
    }
    if (!password) {
      Modal.error({
        title: "用户信息不完整",
        children: mode === "create" ? "请为新用户设置密码。" : "请输入要设置的新密码。",
        centered: true,
      });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        host: kind === "mysql" ? host.trim() || "%" : undefined,
        password,
      });
    } catch (error) {
      Modal.error({
        title: mode === "create" ? "新建用户失败" : "编辑用户失败",
        children: error instanceof Error ? error.message : String(error),
        centered: true,
        width: 560,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={mode === "create" ? "新建数据库用户" : "编辑数据库用户"}
      width={520}
      centered
      footer={(
        <div className="database-user-modal__footer">
          <Button onClick={onCancel}>取消</Button>
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {mode === "create" ? "新建" : "保存修改"}
          </Button>
        </div>
      )}
      onCancel={onCancel}
    >
      <Form layout="vertical" className="database-user-form">
        <Form.Item label="用户名" required>
          <Input
            value={name}
            disabled={mode === "edit"}
            autoComplete="off"
            placeholder="请输入用户名"
            onChange={(event) => setName(event.target.value)}
          />
        </Form.Item>
        {kind === "mysql" ? (
          <Form.Item label="登录主机" required>
            <Input
              value={host}
              disabled={mode === "edit"}
              autoComplete="off"
              placeholder="例如：% 或 localhost"
              onChange={(event) => setHost(event.target.value)}
            />
          </Form.Item>
        ) : null}
        {mode === "edit" && (user?.type || user?.status) ? (
          <Form.Item label="当前信息">
            <div className="database-user-form__meta">
              {user.type ? <Tag>{user.type}</Tag> : null}
              {user.status ? <Tag status={user.status === "正常" ? "success" : "warning"}>{user.status}</Tag> : null}
            </div>
          </Form.Item>
        ) : null}
        <Form.Item label={mode === "create" ? "密码" : "新密码"} required>
          <Input
            type="password"
            value={password}
            autoComplete="new-password"
            placeholder={mode === "create" ? "请输入用户密码" : "输入后将重置该用户密码"}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Form.Item>
      </Form>
      <p className="database-user-modal__hint">
        密码只会发送给本机数据库宿主，不会写入 SQL 执行日志；日志中的密码将显示为 ***。
      </p>
    </Modal>
  );
}
