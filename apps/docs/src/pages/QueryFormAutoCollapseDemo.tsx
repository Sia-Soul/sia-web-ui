import { useState } from "react";
import { Button, Input, QueryForm, Space } from "@sia.soul/sia-react-ui";

/** 改变容器宽度比较两行与三行；手动展开后保持选择，重建实例恢复自动模式。 */
export function QueryFormAutoCollapseDemo() {
  const [width, setWidth] = useState(380);
  const [instance, setInstance] = useState(0);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Space wrap><Button onClick={() => setWidth(560)}>两行条件</Button><Button onClick={() => setWidth(380)}>三行条件</Button><Button onClick={() => setInstance(value => value + 1)}>恢复自动判断</Button></Space>
    <div style={{ width, maxWidth: "100%" }}>
      <QueryForm key={instance} fieldWidth={160} fields={Array.from({ length: 6 }, (_, index) => ({ key: `field-${index}`, name: `field-${index}`, children: <Input placeholder={`条件 ${index + 1}`} /> }))} onSearch={() => { /* 此例仅演示布局，不请求业务数据。 */ }} />
    </div>
  </Space>;
}
