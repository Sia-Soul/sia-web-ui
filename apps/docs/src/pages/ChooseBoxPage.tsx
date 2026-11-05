import { useState } from "react";
import { ChooseBox, Space } from "@sia.soul/sia-react-ui";
import type { ChooseBoxEntry, ChooseBoxSource } from "@sia.soul/sia-react-ui";
import { DemoCard } from "./DemoCard";
import { PageHeader } from "./PageHeader";
import { DocsTabs } from "./DocsTabs";
import { ApiTable } from "./ApiTable";

// 示例目录与本机文件明确分开，页面打开时不请求用户文件权限。
const root: ChooseBoxEntry = { id: "demo", name: "示例资料", path: "/示例资料", kind: "directory" };
const folder: ChooseBoxEntry = { id: "demo/design", name: "设计资源", path: "/示例资料/设计资源", kind: "directory" };
const empty: ChooseBoxEntry = { id: "demo/empty", name: "空文件夹", path: "/示例资料/空文件夹", kind: "directory" };
const file: ChooseBoxEntry = { id: "demo/readme", name: "使用说明.txt", path: "/示例资料/使用说明.txt", kind: "file" };
const logo: ChooseBoxEntry = { id: "demo/design/logo", name: "品牌标志.svg", path: "/示例资料/设计资源/品牌标志.svg", kind: "file" };
const demoSource: ChooseBoxSource = {
  getRoots: async () => [root],
  readDirectory: async directory => directory.id === root.id ? [folder, empty, file] : directory.id === folder.id ? [logo] : [],
};
const modes = [
  { title: "单选文件", kind: "file", multiple: false },
  { title: "单选文件夹", kind: "directory", multiple: false },
  { title: "多选文件", kind: "file", multiple: true },
  { title: "多选文件夹", kind: "directory", multiple: true },
] as const;

/** 展示同一 ChooseBox 的四种模式、浏览器授权与受控回填。 */
export function ChooseBoxPage() {
  const [tab, setTab] = useState<"examples" | "api">("examples");
  const [value, setValue] = useState<readonly ChooseBoxEntry[]>([]);
  const [error, setError] = useState("");
  return <>
    <PageHeader eyebrow="组件 / 数据录入 / ChooseBox" title="ChooseBox 文件选择框" description="在目录树与文件视图中选择文件或文件夹，支持单选、多选和桌面/网页目录源。" />
    <DocsTabs activeKey={tab} onChange={setTab} />
    {tab === "examples" ? <div className="demo-stack">
      <DemoCard title="四种选择模式" description="以下为示例目录，可以直接体验目录导航、单选、多选、空文件夹、确认及取消。多选可跨目录保留选择。" code={'<ChooseBox source={source} kind="file" />\n<ChooseBox source={source} kind="directory" />\n<ChooseBox source={source} kind="file" multiple />\n<ChooseBox source={source} kind="directory" multiple />'}>
        {/* 标签与控件紧凑对齐，避免段落默认外边距把每一行撑得过高。 */}
        <Space direction="vertical" size={16} className="choose-box-demo">{modes.map(mode => <div key={mode.title} className="choose-box-demo__row"><span>{mode.title}</span><ChooseBox source={demoSource} kind={mode.kind} multiple={mode.multiple} title={mode.title} placeholder={`请${mode.title}`} defaultValue={[]} /></div>)}</Space>
      </DemoCard>
      <DemoCard title="选择本机文件与文件夹（浏览器授权）" description="点击添加授权目录后，可以浏览其中的文件和空文件夹；重复添加可授权多个根目录。需支持目录授权的 Chrome / Edge，以及 HTTPS 或 localhost。网页返回授权范围内的相对路径和句柄。" code={'// 不传 source 时使用浏览器目录授权源。\n<ChooseBox kind="directory" multiple onChange={entries => console.log(entries)} />'}>
        <Space direction="vertical" size={16} className="choose-box-demo">{modes.map(mode => <div key={mode.title} className="choose-box-demo__row"><span>{mode.title}</span><ChooseBox kind={mode.kind} multiple={mode.multiple} placeholder={`本机${mode.title}`} /></div>)}</Space>
      </DemoCard>
      <DemoCard title="受控值、文件过滤与状态" description="仅允许选择 .txt 文件；只有确认或清空才更新当前值。" code={'const [value, setValue] = useState<readonly ChooseBoxEntry[]>([]);\n<ChooseBox source={source} value={value} onChange={setValue} accept=".txt" />'}>
        <Space direction="vertical" style={{width:"100%"}}>
          <ChooseBox source={demoSource} value={value} onChange={setValue} accept=".txt" allowClear size="large" onError={failure => setError(failure.message)} />
          <output>当前值：{value.map(entry => entry.path).join("；") || "未选择"}</output>
          {error && <p role="alert">{error}</p>}
          <ChooseBox source={demoSource} disabled defaultValue={[file]} size="small" />
        </Space>
      </DemoCard>
      <DemoCard title="桌面端接入" description="桌面应用传入 Tauri 目录源即可读取本机常用目录和磁盘。仓库 desktop 应用已注册这两个只读命令，可在组件工作区体验四种模式。" code={'import { ChooseBox, createTauriChooseBoxSource } from "@sia.soul/sia-react-ui";\n// 在组件外创建，保持目录源引用稳定。\nconst source = createTauriChooseBoxSource(window.__TAURI__.core.invoke);\n<ChooseBox source={source} kind="directory" multiple />'}><p>文件项返回绝对路径；组件只选择文件，不读取正文或上传文件。</p></DemoCard>
    </div> : <ApiTable name="ChooseBox" rows={[
      {property:"source",description:"目录数据源；默认浏览器授权，可接入桌面或业务目录",type:"ChooseBoxSource",defaultValue:"浏览器授权源"},
      {property:"kind",description:"file 选文件，directory 选目录",type:"'file' | 'directory'",defaultValue:"file"},
      {property:"multiple",description:"跨目录多选，单选最多一个条目",type:"boolean",defaultValue:"false"},
      {property:"value / defaultValue",description:"条目数组，空数组表示未选择",type:"readonly ChooseBoxEntry[]",defaultValue:"[]"},
      {property:"onChange",description:"确认或清空时提交；取消不触发",type:"(entries: ChooseBoxEntry[]) => void",defaultValue:"—"},
      {property:"accept",description:"逗号分隔的扩展名；文件夹模式忽略",type:"string",defaultValue:"全部文件"},
      {property:"disabled / allowClear",description:"禁用控件 / 是否允许清空",type:"boolean",defaultValue:"false / true"},
      {property:"placeholder / title",description:"控件提示 / 弹窗标题",type:"string",defaultValue:"按模式生成"},
      {property:"size",description:"控件尺寸，默认继承 Form",type:"ControlSize",defaultValue:"medium"},
      {property:"onError",description:"目录读取或授权失败通知；授权取消不触发",type:"(error: Error) => void",defaultValue:"—"},
    ]} />}
  </>;
}
