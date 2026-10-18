import { useState } from "react";
import { Select, Button, Input, Radio, Space, message, openSelectModal } from "@sia.soul/sia-react-ui";
import type { SelectChangeValue, SelectOption, SelectValue } from "@sia.soul/sia-react-ui";
import { ApiTable } from "./ApiTable";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const extraConfirmCode = `const [extraValues, setExtraValues] = useState({ action: "add", remark: "" });

<Select
  popupMode="modal"
  mode="multiple"
  options={options}
  modalConfig={{
    headerExtra: <Space wrap>
      <Radio.Group value={extraValues.action}
        onChange={action => setExtraValues(current => ({ ...current, action: String(action) }))}
        options={[{ label: "添加以下标签", value: "add" }, { label: "移除以下标签", value: "remove" }]} />
      <Input value={extraValues.remark} placeholder="备注"
        onChange={event => setExtraValues(current => ({ ...current, remark: event.target.value }))} />
    </Space>,
    extraValues,
    onConfirm: (value, option, extra) => {
      console.log(value, option, extra.action, extra.remark);
      // 支持返回 Promise；返回 false 可阻止提交和关闭。
    },
  }}
/>`;

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
    popupMode="dropdown"
    mode="multiple"
    options={options}
    value={value}
    onChange={(nextValue) => setValue(Array.isArray(nextValue) ? nextValue : [])}
    // 大于 15 项时默认提供搜索。
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
    { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
  { property: "popupMode", description: "显式指定下拉或弹框，优先于自动判断；未指定时根据选项总数与 modalThreshold 判断。弹框点击确定才提交", type: "'dropdown' | 'modal'", defaultValue: "自动判断" },
  { property: "modalThreshold", description: "未设置 popupMode 时，options 总数超过此值使用弹框；等于阈值仍使用下拉。本次打开期间保持模式稳定，下次打开重新判断", type: "number", defaultValue: "15" },
  { property: "modalConfig", description: "弹框 title、width、columns、maxHeight、顶部首行扩展 headerExtra 与左下角扩展 footerExtra", type: "object", defaultValue: "width: 900, columns: 3" },
  // 标签业务需要分组勾选与帮助说明，入口和独立弹框共享规则。
  { property: "modalConfig.groupCheckable", description: "多选弹框分组勾选；仅操作当前可见可用项，保留隐藏及组外选择", type: "boolean", defaultValue: "false" },
  { property: "options[].description", description: "弹框选项帮助图标的悬停说明；点击不改变选择", type: "ReactNode", defaultValue: "-" },
  { property: "modalConfig.headerExtra", description: "标题下方、选项范围与搜索栏上方的独立扩展行；未传入时不占位。openSelectModal 也支持顶层 headerExtra", type: "ReactNode", defaultValue: "-" },
  { property: "modalConfig.extraValues", description: "扩展区域的受控数据对象，支持多个字段；确认时传出当前数据，不自动读取子组件状态", type: "Record<string, unknown>", defaultValue: "{}" },
  { property: "modalConfig.onConfirm", description: "确定时接收 value、option、extraValues；返回 false 或抛出异常保留弹框，支持异步。成功后再触发原有 onChange；取消不调用", type: "(value, option, extraValues) => void | boolean | Promise<void | boolean>", defaultValue: "-" },
  { property: "options.group", description: "弹框内的选项分组标题", type: "string", defaultValue: "-" },
  { property: "options", description: "下拉选项", type: "SelectOption[]", defaultValue: "[]" },
  { property: "value", description: "当前值（受控）", type: "string | number | null", defaultValue: "-" },
  { property: "mode", description: "单选或多选模式", type: "'single' | 'multiple'", defaultValue: "'single'" },
  { property: "defaultValue", description: "初始选中值", type: "string | number | null", defaultValue: "null" },
  { property: "placeholder", description: "未选择时的提示", type: "ReactNode", defaultValue: "'请选择'" },
  { property: "allowClear", description: "允许清空当前选择，传入 false 可关闭", type: "boolean", defaultValue: "true" },
  { property: "showSearch", description: "下拉搜索：未设置时总选项超过 15 项自动显示，显式值优先；独立于弹框阈值，弹框始终支持搜索", type: "boolean", defaultValue: "options.length > 15" },
  { property: "allowInput", description: "允许将搜索内容作为自定义选项提交", type: "boolean", defaultValue: "false" },
  { property: "inputMaxLength", description: "手动输入内容的最大长度", type: "number", defaultValue: "-" },
  { property: "maxTagCount", description: "最多显示的选中标签数；按可用宽度自动继续折叠并预留 +N 空间，始终保持单行", type: "number", defaultValue: "2" },
  { property: "showValue", description: "在选项名称下方显示 value，下拉与弹框模式均支持；不影响按 value 搜索", type: "boolean", defaultValue: "false" },
  { property: "showSelectAll", description: "多选时显示全选、反选；下拉操作栏固定在列表底部", type: "boolean", defaultValue: "true" },
  { property: "showActions", description: "显示下拉面板底部整行（条数、全选、反选、清空）；默认单选隐藏、多选显示，可显式覆盖；不影响输入框清空按钮或弹框模式", type: "boolean", defaultValue: "mode === 'multiple'" },
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
  const [dialogValues, setDialogValues] = useState<SelectValue[]>(["react"]);
  const [extraValues, setExtraValues] = useState({ action: "add", remark: "" });
  const [extraResult, setExtraResult] = useState("");

  return (
    <>
      <PageHeader eyebrow="组件 / 数据录入 / Select" title="Select 选择器" description="从候选项中选择一个值，支持鼠标与完整键盘操作。" />
      <DocsTabs activeKey={tab} onChange={setTab} />
      {tab === "examples" ? <div className="demo-stack">
        <DemoCard title="根据选项数量自动切换" description="未指定 popupMode 时，默认超过 15 项自动弹框；可通过 modalThreshold 调整阈值。指定 popupMode 后始终使用指定模式。" code={'<Select options={options} />\n<Select options={options} modalThreshold={30} />\n<Select options={options} popupMode="dropdown" />'}>
          <Select aria-label="15项自动下拉" options={Array.from({ length: 15 }, (_,i) => ({ value: i, label: `选项 ${i + 1}` }))} placeholder="15 项：下拉" />
          <Select aria-label="16项自动弹框" options={Array.from({ length: 16 }, (_,i) => ({ value: i, label: `选项 ${i + 1}` }))} placeholder="16 项：弹框" />
          <Select aria-label="自定义弹框阈值" options={frameworkOptions} modalThreshold={2} placeholder="超过 2 项：弹框" />
        </DemoCard>
        <DemoCard title="API 打开选择弹框" description="无需渲染 Select；按钮直接调用 openSelectModal。确认后提交选择，取消保留原值，支持分组、value 搜索、维护操作和异步确认。" code={`import { Button, openSelectModal } from "@sia.soul/sia-react-ui";

<Button onClick={() => openSelectModal({
  title: "请选择合作方店铺标签",
              // 分组勾选只影响当前过滤后的可用项。
              groupCheckable: true,
  mode: "multiple",
  options,
  value: selectedValues,
  showValue: true,
  columns: 3,
  footerExtra: <Button onClick={onMaintain}>维护</Button>,
  onConfirm: async (values, selectedOptions) => {
    await saveSelection(values);
    setSelectedValues(values);
    // 返回 false 或抛出异常时保留弹框，允许重试。
  },
})}>选择标签</Button>

// 返回句柄：handle.update({ options: newOptions }) 更新选项；
// handle.update({ value: newValues }) 替换当前选择；handle.destroy() 关闭。`}>
          <Button onClick={() => openSelectModal({ title: "API 选择框架", mode: "multiple", options: frameworkOptions,
            value: dialogValues, showValue: true,
            footerExtra: <Button onClick={() => message.info("这里接入维护功能")}>维护</Button>,
            onConfirm: next => { setDialogValues(Array.isArray(next) ? next : []); },
          })}>API 打开选择弹框</Button>
          <p>已确认的值：{dialogValues.join("、") || "未选择"}</p>
        </DemoCard>
        <DemoCard title="基础用法" description="点击展开，或使用方向键、Enter、Space 与 Esc 操作。" code={basicCode}>
          <div className="component-demo">
            <Select aria-label="选择前端框架" options={frameworkOptions} value={value} onChange={(nextValue) => setValue(asSingleValue(nextValue))} allowClear showSearch placeholder="请选择前端框架" />
            <span className="demo-result">当前值：{value ?? "（未选择）"}</span>
          </div>
        </DemoCard>
        <DemoCard title="隐藏底部操作行" description="设置 showActions={false} 可隐藏条数、全选、反选和清空整行；选项选择及输入框清空按钮保持可用。" code={'<Select mode="multiple" options={options} showActions={false} allowClear />'}>
          <Select aria-label="隐藏操作行选择器" mode="multiple" options={frameworkOptions} showActions={false} allowClear placeholder="请选择前端框架" />
        </DemoCard>
        <DemoCard title="显示选项值" description="开启 showValue 后，选项名称下方会增加一行 value；名称和 value 超长时分别单行省略。" code={'<Select showValue options={options} />\n<Select showValue popupMode="modal" options={options} />'}>
          <div className="component-demo">
            <Select aria-label="显示值下拉选择" showValue options={frameworkOptions} placeholder="下拉显示 value" />
            <Select aria-label="显示值弹框选择" showValue popupMode="modal" mode="multiple" options={frameworkOptions} placeholder="弹框显示 value" />
          </div>
        </DemoCard>
        <DemoCard title="弹框选择" description="扩展区域可包裹多个控件，通过 extraValues 管理数据，确定时 onConfirm 一并返回选中值、选项详情和扩展数据。取消不提交选项草稿，扩展数据由业务管理。" code={extraConfirmCode}>
          <Select aria-label="弹框多选标签" popupMode="modal" mode="multiple" placeholder="请选择合作方店铺标签" placeholderMode="floating" allowClear
            options={Array.from({ length: 16 }, (_, index) => ({ value: index, label: index === 15 ? "这是一个用于演示单行省略的超长合作方店铺标签名称" : "标签 " + (index + 1), group: index < 8 ? "自定义标签" : "平台标签", disabled: index === 7, description: index === 0 ? "标签帮助说明，点击说明不会切换选中状态" : undefined }))}
            modalConfig={{
              title: "请选择合作方店铺标签",
              // 分组勾选只影响当前过滤后的可用项。
              groupCheckable: true,
              headerExtra: <Space wrap>
                <Radio.Group value={extraValues.action} onChange={action => setExtraValues(current => ({ ...current, action: String(action) }))} options={[{ label: "添加以下标签", value: "add" }, { label: "移除以下标签", value: "remove" }]} />
                <Input aria-label="操作备注" placeholder="操作备注" value={extraValues.remark} onChange={event => setExtraValues(current => ({ ...current, remark: event.target.value }))} />
              </Space>,
              extraValues,
              onConfirm: (value, option, extra) => setExtraResult(JSON.stringify({ value, option, extraValues: extra })),
              footerExtra: <Button onClick={() => message.info("这里接入标签维护功能")}>维护</Button>,
            }} />
          <output aria-label="扩展确认结果" style={{ display: "block", overflowWrap: "anywhere" }}>{extraResult}</output>
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
        <DemoCard title="搜索、多选与虚拟滚动" description="示例包含 1000 个选项，显式下拉仍默认启用搜索，无需传 showSearch；DOM 中只渲染可视区域。支持全选和一键清除。" code={multipleCode}>
          <div className="component-demo component-demo--column">
            <Select
              className="large-select-demo"
              aria-label="选择项目成员"
              popupMode="dropdown"
              mode="multiple"
              options={memberOptions}
              value={members}
              onChange={(nextValue) => setMembers(asMultipleValue(nextValue))}
              // 大列表默认启用搜索，不要求业务重复配置。
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
        <DemoCard title="加载、禁用与空数据" description="面板按内容确定宽度，最小 90px；无选项或搜索无结果时与选择器等宽（仍保留最小宽度）。" code={stateCode}>
          <div className="component-demo">
            <Select aria-label="加载中的选择器" options={frameworkOptions} loading placeholder="加载中" />
            <Select aria-label="禁用的选择器" options={frameworkOptions} defaultValue="vue" disabled />
            <Select aria-label="空数据选择器" options={[]} notFoundContent="没有可选框架" />
          </div>
        </DemoCard>
      </div> : <><ApiTable name="Select" rows={apiRows} />
        <ApiTable name="openSelectModal(config)" rows={[
          { property: "options / value / mode", description: "选项、初始选中值与单选/多选模式，与 Select 相同", type: "SelectOption[] / SelectChangeValue / 'single' | 'multiple'", defaultValue: "必填 / 空 / single" },
          { property: "title / width / columns / maxHeight", description: "弹框标题、宽度、选项列数及列表最大高度", type: "ReactNode / number | string / number / number", defaultValue: "请选择 / 900 / 3 / 360" },
          { property: "showValue / searchPlaceholder / filterOption / onSearch", description: "显示值、搜索提示、自定义筛选与搜索回调；默认同时匹配 label 和 value", type: "同 Select", defaultValue: "false / 搜索选项 / 默认筛选 / -" },
          { property: "onConfirm", description: "确认回调；单选返回单值及选项，多选返回数组；支持 Promise，返回 false 或异常时不关闭", type: "(value, option) => void | boolean | Promise<void | boolean>", defaultValue: "-" },
          { property: "onCancel / footerExtra", description: "取消回调、底部左侧扩展区域；也支持 Modal 的按钮文案、遮罩及键盘关闭等配置", type: "() => void / ReactNode", defaultValue: "-" },
          { property: "返回值 update / destroy", description: "更新配置（不传 value 保留当前草稿），或关闭并释放弹框。独立挂载，不继承调用处的 React Context。", type: "OverlayApiHandle<SelectModalConfig>", defaultValue: "-" },
        ]} /></>}
    </>
  );
}
