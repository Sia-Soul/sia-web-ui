import { useState } from "react";
import { Select, Button, message } from "@sia.soul/sia-react-ui";
import type { SelectChangeValue, SelectOption, SelectValue } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const basicCode = `import { useState } from "react";
import { Select } from "@sia.soul/sia-react-ui";

const options = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
];

export default function Demo() {
  const [value, setValue] = useState("react");
  return <Select
    options={options}
    value={value}
    onChange={(nextValue) => setValue(String(nextValue))}
    allowClear
    showSearch
    placeholder="请选择前端框架"
  />;
}`;

const multipleCode = `import { useState } from "react";
import { Select } from "@sia.soul/sia-react-ui";

const options = Array.from({ length: 1000 }, (_, index) => ({
  label: "项目成员 " + String(index + 1).padStart(4, "0"),
  value: "member-" + (index + 1),
}));

export default function Demo() {
  const [value, setValue] = useState(["member-2", "member-8"]);
  return <Select
    mode="multiple"
    options={options}
    value={value}
    onChange={(nextValue) => setValue(Array.isArray(nextValue) ? nextValue : [])}
    showSearch
    showSelectAll
    allowClear
    maxTagCount={3}
    virtualThreshold={50}
    searchPlaceholder="搜索 1000 名项目成员"
  />;
}`;

const sizeStatusCode = `import { Select } from "@sia.soul/sia-react-ui";

const options = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
];

export default function Demo() {
  return <>
    <Select size="large" options={options} placeholder="Large" />
    <Select options={options} placeholder="Medium" />
    <Select size="small" options={options} placeholder="Small" />
    <Select status="error" options={options} placeholder="请选择必填项" />
  </>;
}`;

const stateCode = `import { Select } from "@sia.soul/sia-react-ui";

const options = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
];

export default function Demo() {
  return <>
    <Select options={options} loading placeholder="加载中" />
    <Select options={options} defaultValue="vue" disabled />
    <Select options={[]} notFoundContent="没有可选框架" />
  </>;
}`;

const customInputCode = `import { useState } from "react";
import { Select } from "@sia.soul/sia-react-ui";

export default function Demo() {
  const [value, setValue] = useState(["React"]);
  return <Select
    mode="multiple"
    options={[{ label: "React", value: "React" }]}
    value={value}
    onChange={(next) => setValue(Array.isArray(next) ? next.map(String) : [])}
    allowInput
    inputMaxLength={20}
    showSearch
    allowClear
    placeholder="选择或输入技术栈"
  />;
}`;

const frameworkOptions: readonly SelectOption[] = [
  { label: "React", value: "react" },
  { label: "Vue", value: "vue" },
  { label: "Svelte", value: "svelte" },
  { label: "Angular（暂不可用）", value: "angular", disabled: true },
];

const memberOptions: readonly SelectOption[] = Array.from({ length: 1000 }, (_, index) => ({
  label: `项目成员 ${String(index + 1).padStart(4, "0")}`,
  value: `member-${index + 1}`,
}));

function asSingleValue(nextValue: SelectChangeValue) {
  return Array.isArray(nextValue) ? nextValue[0] ?? null : nextValue;
}

function asMultipleValue(nextValue: SelectChangeValue) {
  if (Array.isArray(nextValue)) return nextValue;
  return nextValue === null ? [] : [nextValue];
}

const apiRows = [
  { property: "popupMode", description: "普通下拉或模态框选择；弹框点击确定才提交", type: "'dropdown' | 'modal'", defaultValue: "'dropdown'" },
  { property: "modalConfig", description: "弹框 title、width、columns、maxHeight 与左下角扩展 footerExtra", type: "object", defaultValue: "width: 900, columns: 3" },
  { property: "options.group", description: "弹框内的选项分组标题", type: "string", defaultValue: "-" },
  { property: "options", description: "下拉选项", type: "SelectOption[]", defaultValue: "[]" },
  { property: "value", description: "当前值（受控）", type: "string | number | null", defaultValue: "-" },
  { property: "mode", description: "单选或多选模式", type: "'single' | 'multiple'", defaultValue: "'single'" },
  { property: "defaultValue", description: "初始选中值", type: "string | number | null", defaultValue: "null" },
  { property: "placeholder", description: "未选择时的提示", type: "ReactNode", defaultValue: "'请选择'" },
  { property: "allowClear", description: "允许清空当前选择", type: "boolean", defaultValue: "false" },
  { property: "showSearch", description: "显示选项搜索框", type: "boolean", defaultValue: "false" },
  { property: "allowInput", description: "允许将搜索内容作为自定义选项提交", type: "boolean", defaultValue: "false" },
  { property: "inputMaxLength", description: "手动输入内容的最大长度", type: "number", defaultValue: "-" },
  { property: "maxTagCount", description: "最多显示的选中标签数；按可用宽度自动继续折叠并预留 +N 空间，始终保持单行", type: "number", defaultValue: "2" },
  { property: "showValue", description: "在选项名称下方显示 value，下拉与弹框模式均支持；不影响按 value 搜索", type: "boolean", defaultValue: "false" },
  { property: "showSelectAll", description: "多选时显示全选、反选；下拉操作栏固定在列表底部", type: "boolean", defaultValue: "true" },
  { property: "virtual", description: "长列表启用窗口化渲染", type: "boolean", defaultValue: "true" },
  { property: "virtualThreshold", description: "启用虚拟滚动的选项数量", type: "number", defaultValue: "100" },
  { property: "loading", description: "显示加载状态并禁用展开", type: "boolean", defaultValue: "false" },
  { property: "onChange", description: "选择变化回调", type: "(value, option) => void", defaultValue: "-" },
] as const;

export function SelectPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState<SelectValue | null>("react");
  const [members, setMembers] = useState<SelectValue[]>(["member-2", "member-8"]);
  const [customValues, setCustomValues] = useState<SelectValue[]>(["React"]);

  return (
    <>
      <PageHeader eyebrow="组件 / 数据录入 / Select" title="Select 选择器" description="从候选项中选择一个值，支持鼠标与完整键盘操作。" />
      <DocsTabs activeKey={tab} onChange={setTab} />
      {tab === "examples" ? <div className="demo-stack">
        <DemoCard title="基础用法" description="点击展开，或使用方向键、Enter、Space 与 Esc 操作。" code={basicCode}>
          <div className="component-demo">
            <Select aria-label="选择前端框架" options={frameworkOptions} value={value} onChange={(nextValue) => setValue(asSingleValue(nextValue))} allowClear showSearch placeholder="请选择前端框架" />
            <span className="demo-result">当前值：{value ?? "（未选择）"}</span>
          </div>
        </DemoCard>
        <DemoCard title="显示选项值" description="开启 showValue 后，选项名称下方会增加一行 value；名称和 value 超长时分别单行省略。" code={'<Select showValue options={options} />\n<Select showValue popupMode="modal" options={options} />'}>
          <div className="component-demo">
            <Select aria-label="显示值下拉选择" showValue options={frameworkOptions} placeholder="下拉显示 value" />
            <Select aria-label="显示值弹框选择" showValue popupMode="modal" mode="multiple" options={frameworkOptions} placeholder="弹框显示 value" />
          </div>
        </DemoCard>
        <DemoCard title="弹框选择" description="点击直接打开弹框；支持分组、全部/已选项、搜索和批量选择，取消不修改原值。左下角可扩展维护操作。" code={'<Select popupMode="modal" mode="multiple" options={options} modalConfig={{ title: "请选择合作方店铺标签", footerExtra: <Button onClick={onMaintain}>维护</Button> }} />'}>
          <Select aria-label="弹框多选标签" popupMode="modal" mode="multiple" placeholder="请选择合作方店铺标签" placeholderMode="floating" allowClear
            options={Array.from({ length: 16 }, (_, index) => ({ value: index, label: index === 15 ? "这是一个用于演示单行省略的超长合作方店铺标签名称" : "标签 " + (index + 1), group: index < 8 ? "自定义标签" : "平台标签", disabled: index === 7 }))}
            modalConfig={{ title: "请选择合作方店铺标签", footerExtra: <Button onClick={() => message.info("这里接入标签维护功能")}>维护</Button> }} />
          <Select aria-label="弹框单选框架" popupMode="modal" options={frameworkOptions} placeholder="弹框单选" modalConfig={{ title: "选择前端框架" }} />
        </DemoCard>
        <DemoCard title="允许输入自定义选项" description="输入候选项之外的内容后按 Enter，或点击“使用”选项，即可把文本作为新值提交。" code={customInputCode}>
          <div className="component-demo component-demo--column">
            <Select
              className="large-select-demo"
              aria-label="选择或输入技术栈"
              mode="multiple"
              options={[{ label: "React", value: "React" }, { label: "Vue", value: "Vue" }, { label: "Svelte", value: "Svelte" }]}
              value={customValues}
              onChange={(nextValue) => setCustomValues(asMultipleValue(nextValue))}
              allowInput
              inputMaxLength={20}
              showSearch
              allowClear
              placeholder="选择或输入技术栈"
            />
            <span className="demo-result">当前值：{customValues.map(String).join("、") || "（未选择）"}</span>
          </div>
        </DemoCard>
        <DemoCard title="搜索、多选与虚拟滚动" description="示例包含 1000 个选项，DOM 中只渲染当前可视区域。支持全选和一键清除。" code={multipleCode}>
          <div className="component-demo component-demo--column">
            <Select
              className="large-select-demo"
              aria-label="选择项目成员"
              mode="multiple"
              options={memberOptions}
              value={members}
              onChange={(nextValue) => setMembers(asMultipleValue(nextValue))}
              showSearch
              showSelectAll
              allowClear
              maxTagCount={3}
              virtualThreshold={50}
              searchPlaceholder="搜索 1000 名项目成员"
              placeholder="请选择项目成员"
            />
            <span className="demo-result">已选择 {members.length} 名成员</span>
          </div>
        </DemoCard>
        <DemoCard title="尺寸与状态" description="尺寸和校验状态与其他表单组件保持一致。" code={sizeStatusCode}>
          <div className="component-demo">
            <Select aria-label="大尺寸选择器" size="large" options={frameworkOptions} placeholder="Large" />
            <Select aria-label="中尺寸选择器" options={frameworkOptions} placeholder="Medium" />
            <Select aria-label="小尺寸选择器" size="small" options={frameworkOptions} placeholder="Small" />
            <Select aria-label="错误状态选择器" status="error" options={frameworkOptions} placeholder="请选择必填项" />
          </div>
        </DemoCard>
        <DemoCard title="加载、禁用与空数据" description="覆盖异步加载和无候选项的常见场景。" code={stateCode}>
          <div className="component-demo">
            <Select aria-label="加载中的选择器" options={frameworkOptions} loading placeholder="加载中" />
            <Select aria-label="禁用的选择器" options={frameworkOptions} defaultValue="vue" disabled />
            <Select aria-label="空数据选择器" options={[]} notFoundContent="没有可选框架" />
          </div>
        </DemoCard>
      </div> : <ApiTable name="Select" rows={apiRows} />}
    </>
  );
}
