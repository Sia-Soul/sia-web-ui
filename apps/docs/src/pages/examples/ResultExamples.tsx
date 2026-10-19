import { useState } from "react";
import { Button, Icon, Result, Space } from "@sia.soul/sia-react-ui";

/** 结果区只负责展示，重试由调用方更新状态，避免组件隐式执行业务。 */
export function ResultExamples() {
  const [retried, setRetried] = useState(false);
  return <Space direction="vertical" style={{ width: "100%" }}>
    <Result status={retried ? "success" : "error"} title={retried ? "重试成功" : "导入失败"}
      subTitle="原始数据不会因展示结果而改变，请检查失败记录后重试。"
      extra={<Button onClick={() => setRetried(!retried)}>{retried ? "复位示例" : "重试示例"}</Button>}>
      <div>失败明细可以放在这里，区域默认不添加边框。</div>
    </Result>
    <Result status="info" title="自定义图标" icon={<Icon name="upload" size={48} />} />
    <Result status="warning" title="不显示图标" icon={null} subTitle="隐藏图标后也移除其占位。" />
  </Space>;
}
