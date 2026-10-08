import { useState } from "react";
import { Icon, Input } from "@sia.soul/sia-react-ui";
import type { ControlStatus } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { Icon, Input } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState("Sia Web UI");
  return <Input
    aria-label="项目名称"
    value={value}
    onChange={(event) => setValue(event.target.value)}
    prefix={<Icon name="search" size={16} />}
    maxLength={30}
    showCount
    allowClear
    placeholder="请输入项目名称"
  />;
}`;

const sizeCode = `import { Input } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <>
    <Input size="large" placeholder="Large" />
    <Input placeholder="Medium" />
    <Input size="small" placeholder="Small" />
  </>;
}`;

const floatingPlaceholderCode = `import { Input } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <>
    <Input placeholder="备注" placeholderMode="floating" />
    <Input placeholder="邮箱" placeholderMode="floating" defaultValue="sia@example.com" />
  </>;
}`;

const validationCode = `import { useState } from "react";
import { Input } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [username, setUsername] = useState("Sia用户");
  const [email, setEmail] = useState("sia@example.com");
  const [accessKey, setAccessKey] = useState("");

  const usernameError = !username.trim() ? "用户名不能为空" : username.length < 3 ? "用户名至少需要 3 个字符" : "用户名格式正确";
  const emailError = !email.includes("@") ? "请输入有效的邮箱地址" : email.endsWith("@sia.com") ? "企业邮箱格式正确" : "建议使用 @sia.com 企业邮箱";
  const accessKeyError = !accessKey ? "访问密钥不能为空" : accessKey.length < 8 ? "访问密钥至少需要 8 个字符" : "访问密钥长度符合要求";
  const usernameStatus = !username.trim() ? "error" : username.length < 3 ? "warning" : "default";
  const emailStatus = !email.includes("@") ? "error" : email.endsWith("@sia.com") ? "default" : "warning";
  const accessKeyStatus = !accessKey ? "error" : accessKey.length < 8 ? "warning" : "default";

  return <>
    <Input label="用户名" value={username} onChange={(event) => setUsername(event.target.value)} status={usernameStatus} hint={usernameError} allowClear />
    <Input label="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} status={emailStatus} hint={emailError} allowClear />
    <Input label="访问密钥" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} status={accessKeyStatus} hint={accessKeyError} allowClear />
    <Input label="只读结果" hint="当前字段不可修改" value="已同步" disabled />
  </>;
}`;

const apiRows = [
  { property: "expandable", description: "展开到多行编辑弹框，确定回填、取消保留原值，继承长度和计数；换行回填为空格", type: "boolean", defaultValue: "false" },
  { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "status", description: "校验状态", type: "'default' | 'warning' | 'error'", defaultValue: "'default'" },
  { property: "prefix", description: "输入框前缀", type: "ReactNode", defaultValue: "-" },
  { property: "suffix", description: "输入框后缀", type: "ReactNode", defaultValue: "-" },
  { property: "allowClear", description: "显示清空按钮", type: "boolean", defaultValue: "true" },
  { property: "maxLength", description: "允许输入的最大字符数", type: "number", defaultValue: "-" },
  // 计数随实际文字宽度变化，不为最大位数提前占用输入空间。
  { property: "showCount", description: "显示当前字符数，设置 maxLength 时显示当前字数/上限；宽度按实际文字自适应", type: "boolean", defaultValue: "false" },
  { property: "placeholderMode", description: "占位文案的显示模式", type: "'default' | 'floating'", defaultValue: "'default'" },
  { property: "label", description: "字段标签", type: "ReactNode", defaultValue: "-" },
  { property: "hint", description: "帮助或校验信息", type: "ReactNode", defaultValue: "-" },
] as const;

type ValidationResult = {
  status: ControlStatus;
  hint: string;
};

function validateUsername(value: string): ValidationResult {
  if (!value.trim()) return { status: "error", hint: "用户名不能为空" };
  if (!/^[\u4e00-\u9fa5A-Za-z0-9_]+$/.test(value)) return { status: "error", hint: "只能输入中文、英文、数字和下划线" };
  if (value.length < 3) return { status: "warning", hint: "用户名至少需要 3 个字符" };
  return { status: "default", hint: "用户名格式正确" };
}

function validateEmail(value: string): ValidationResult {
  if (!value.trim()) return { status: "error", hint: "邮箱不能为空" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { status: "error", hint: "请输入有效的邮箱地址" };
  if (!value.toLowerCase().endsWith("@sia.com")) return { status: "warning", hint: "建议使用 @sia.com 企业邮箱" };
  return { status: "default", hint: "企业邮箱格式正确" };
}

function validateAccessKey(value: string): ValidationResult {
  if (!value) return { status: "error", hint: "访问密钥不能为空" };
  if (value.length < 8) return { status: "warning", hint: "访问密钥至少需要 8 个字符" };
  return { status: "default", hint: "访问密钥长度符合要求" };
}

export function InputPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState("Sia Web UI");
  // 独立草稿由框架维护，业务只接收确定后的输入值。
  const [remark, setRemark] = useState("原备注");
  const [username, setUsername] = useState("Sia用户");
  const [email, setEmail] = useState("sia@example.com");
  const [accessKey, setAccessKey] = useState("");
  const usernameValidation = validateUsername(username);
  const emailValidation = validateEmail(email);
  const accessKeyValidation = validateAccessKey(accessKey);

  return (
    <>
      <PageHeader eyebrow="组件 / 数据录入 / Input" title="Input 输入框" description="接收用户输入的基础表单控件。" />
      <DocsTabs activeKey={tab} onChange={setTab} />
      {tab === "examples" ? <div className="demo-stack">
        <DemoCard title="展开编辑" description="单行输入支持展开编辑，正文仅包含多行输入框，最多 500 字，确定后回填。" code={'<Input expandable maxLength={500} showCount />'}>
          <Input aria-label="可展开备注" expandable maxLength={500} showCount value={remark} onChange={(event) => setRemark(event.target.value)} />
          <Input aria-label="非受控展开备注" expandable maxLength={500} defaultValue="非受控备注" />
          <Input aria-label="只读展开备注" expandable value="只读备注" readOnly />
          <Input aria-label="禁用展开备注" expandable value="禁用备注" disabled />
        </DemoCard>
        <DemoCard title="基础用法" description="支持受控值、前后缀和一键清空。" code={basicCode}>
          <div className="component-demo component-demo--column">
            <Input aria-label="项目名称" value={value} onChange={(event) => setValue(event.target.value)} prefix={<Icon name="search" size={16} />} maxLength={30} showCount allowClear placeholder="请输入项目名称" />
            <span className="demo-result">当前值：{value || "（空）"}</span>
          </div>
        </DemoCard>
        <DemoCard title="三种尺寸" description="与 Button、Select、InputNumber 使用同一套尺寸。" code={sizeCode}>
          <div className="component-demo component-demo--column demo-control-width">
            <Input size="large" placeholder="Large" />
            <Input placeholder="Medium" />
            <Input size="small" placeholder="Small" />
          </div>
        </DemoCard>
        <DemoCard title="浮动占位文案" description="聚焦时占位文案会滑动到输入框顶部；输入内容后会保持浮动。" code={floatingPlaceholderCode}>
          <div className="component-demo component-demo--column demo-control-width">
            <Input aria-label="备注" placeholder="备注" placeholderMode="floating" />
            <Input aria-label="邮箱" placeholder="邮箱" placeholderMode="floating" defaultValue="sia@example.com" />
          </div>
        </DemoCard>
        <DemoCard title="字段与实时校验" description="示例规则会在每次输入后立即重新计算状态和提示。" code={validationCode}>
          <div className="component-demo demo-grid">
            <Input label="用户名" value={username} onChange={(event) => setUsername(event.target.value)} status={usernameValidation.status} hint={usernameValidation.hint} placeholder="请输入用户名" allowClear />
            <Input label="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} status={emailValidation.status} hint={emailValidation.hint} placeholder="name@sia.com" allowClear />
            <Input label="访问密钥" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} status={accessKeyValidation.status} hint={accessKeyValidation.hint} placeholder="至少输入 8 个字符" allowClear />
            <Input label="只读结果" hint="当前字段不可修改" value="已同步" disabled />
          </div>
        </DemoCard>
      </div> : <ApiTable name="Input" rows={apiRows} />}
    </>
  );
}
