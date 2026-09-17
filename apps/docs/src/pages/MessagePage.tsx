import { Button, Space, message } from "@sia.soul/sia-react-ui";
import { DemoCard } from "./DemoCard";
import { DocsTabs } from "./DocsTabs";
import { PageHeader } from "./PageHeader";

const typeCode = `import { Button, message } from "@sia.soul/sia-react-ui";

export default function Demo() {
  function showLoading() {
    const handle = message.loading("正在保存数据...", 0);
    window.setTimeout(() => handle.update({ type: "success", content: "数据保存成功", duration: 2 }), 900);
  }
  return <>
    <Button onClick={() => message.info("普通提示")}>普通提示</Button>
    <Button onClick={() => message.success("操作成功")}>成功</Button>
    <Button onClick={() => message.warning("请检查输入内容")}>警告</Button>
    <Button onClick={() => message.error("操作失败")}>错误</Button>
    <Button onClick={showLoading}>加载并更新</Button>
  </>;
}`;

const closeCode = `import { Button, message } from "@sia.soul/sia-react-ui";

export default function Demo() {
  return <>
    <Button onClick={() => message.open({ content: "需要手动关闭", duration: 0, closable: true })}>可关闭提示</Button>
    <Button onClick={() => message.destroy()}>清除全部</Button>
  </>;
}`;

export function MessagePage() {
  function showLoading() {
    const handle = message.loading("正在保存数据...", 0);
    window.setTimeout(() => handle.update({ type: "success", content: "数据保存成功", duration: 2 }), 900);
  }

  return <>
    <PageHeader eyebrow="组件 / 反馈 / Message" title="Message 全局提示" description="轻量反馈当前操作结果，通过 API 在任意位置调用。" />
    <DocsTabs showApi={false} />
    <div className="demo-stack">
      <DemoCard title="提示类型" description="提示正文默认字号为 14px，会自动堆叠并在设定时间后关闭。" code={typeCode}>
        <Space wrap>
          <Button onClick={() => message.info("这是一条普通提示")}>普通提示</Button>
          <Button onClick={() => message.success("操作成功")}>成功</Button>
          <Button onClick={() => message.warning("请检查输入内容")}>警告</Button>
          <Button danger onClick={() => message.error("操作失败")}>错误</Button>
          <Button onClick={showLoading}>加载并更新</Button>
        </Space>
      </DemoCard>
      <DemoCard title="可关闭提示" description="duration 为 0 时保持显示，也可以通过返回句柄关闭或更新。" code={closeCode}>
        <Space wrap>
          <Button onClick={() => message.open({ content: "这条提示需要手动关闭", duration: 0, closable: true })}>可关闭提示</Button>
          <Button onClick={() => message.destroy()}>清除全部</Button>
        </Space>
      </DemoCard>
    </div>
  </>;
}
