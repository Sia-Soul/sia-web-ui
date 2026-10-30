import { useState } from "react";
import { Cascader, Divider } from "@sia.soul/sia-react-ui";
import type { CascaderOption, CascaderValue } from "@sia.soul/sia-react-ui";
import { ComponentDocPage } from "./ComponentDocPage";
import { DemoCard } from "./DemoCard";

const options: readonly CascaderOption[] = [
  { value: "zhejiang", label: "浙江", children: [
    { value: "hangzhou", label: "杭州", children: [{ value: "xihu", label: "西湖区" }, { value: "yuhang", label: "余杭区" }] },
    { value: "ningbo", label: "宁波", children: [{ value: "haishu", label: "海曙区" }] },
  ] },
  { value: "jiangsu", label: "江苏", children: [
    { value: "nanjing", label: "南京", children: [{ value: "xuanwu", label: "玄武区" }, { value: "gulou", label: "鼓楼区" }] },
  ] },
];
const code = `import { Cascader } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return (
    <Cascader
      options={options}
      showSearch
      allowClear
      placeholder="请选择地区"
    />
  );
}`;
export function CascaderPage() {
  const [value, setValue] = useState<readonly CascaderValue[]>(["zhejiang", "hangzhou", "xihu"]);
  const [multiple, setMultiple] = useState<readonly (readonly CascaderValue[])[]>([["zhejiang", "hangzhou", "xihu"]]);
  return <ComponentDocPage eyebrow="组件 / 数据录入 / Cascader" title="Cascader 级联选择" description="从关联的多级选项中逐层选择路径，支持搜索、多选与异步加载；面板按实际展开的列显示宽度，未展开子项时不预留右侧区域。" name="Cascader" apiRows={[
    { property: "size", description: "small / medium / large 高度为 22 / 30 / 38px；默认继承 Form，组件自身 size 优先", type: "'small' | 'medium' | 'large'", defaultValue: "'medium'" },
    { property: "options", description: "级联选项树", type: "CascaderOption[]", defaultValue: "[]" },
    { property: "value / defaultValue", description: "单条或多条路径值", type: "Value[] | Value[][]", defaultValue: "-" },
    { property: "multiple / showSearch", description: "多选与路径搜索", type: "boolean", defaultValue: "false" },
    { property: "changeOnSelect / expandTrigger", description: "选择中间级和展开方式", type: "boolean / click | hover", defaultValue: "false / click" },
    { property: "loadData / fieldNames", description: "异步加载与字段映射", type: "function / object", defaultValue: "-" },
  ]}>
    <DemoCard title="基础级联与搜索" description={`当前路径：${value.join(" / ")}`} code={code}>
      <Cascader options={options} value={value} onChange={(next) => setValue((next as readonly CascaderValue[]) ?? [])} showSearch allowClear placeholder="请选择地区" />
      <Divider />
      <Cascader options={options} value={multiple} onChange={(next) => setMultiple((next as readonly (readonly CascaderValue[])[]) ?? [])} multiple showSearch allowClear placeholder="选择多个地区" />
    </DemoCard>
  </ComponentDocPage>;
}
