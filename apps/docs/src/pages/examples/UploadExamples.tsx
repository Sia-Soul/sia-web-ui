import { useState } from "react";
import { Button, Space, Switch, Typography, Upload } from "@sia.soul/sia-react-ui";

/** 文件校验、目录选择、预览与下载；接口示例关闭自动上传，接入时替换 action。 */
export function UploadExamples() {
  const [disabled, setDisabled] = useState(false);
  const [event, setEvent] = useState("选择小于 1MB 的文本文件；列表中可以预览和下载");
  return <Space direction="vertical">
    <Switch checked={disabled} onCheckedChange={setDisabled} label="禁用文件选择" />
    <Upload directory recursive pastable disabled={disabled} showUploadList accept=".txt" autoUpload={false} request={{ action: "/api/upload", method: "POST", name: "document", data: { purpose: "demo" }, timeout: 10000 }}
      beforeUpload={file => { const accepted = file.size < 1024 * 1024; setEvent(accepted ? `通过校验：${file.name}` : "文件超过 1MB"); return accepted; }}
      onRemove={file => { setEvent(`移除 ${file.name}`); return true; }} onReadError={error => setEvent(`读取失败：${String(error)}`)} onPreview={file => setEvent(`预览信息：${file.name}，${file.size ?? 0} 字节`)} downloadRequest={file => file.originFileObj ?? new Blob([file.name], { type: "text/plain" })}><Button disabled={disabled}>选择文本目录（不发送请求）</Button></Upload>
    <Upload.Dragger disabled={disabled} listType="picture" cardSize={{ width: 100, height: 80 }} showUploadList autoUpload={false} request={{ action: "/api/upload", method: "PUT", body: "file", timeout: 10000 }}
      beforeUpload={file => file.size < 1024 * 1024} onRemove={file => { setEvent(`移除 ${file.name}`); return true; }} onPreview={file => setEvent(`文件 ${file.name}`)} downloadRequest={file => file.originFileObj ?? new Blob([file.name])}
      itemRender={(node, file, _files, actions) => <Space>{node}<Button onClick={() => actions.preview()}>查看 {file.name}</Button><Button onClick={() => { void actions.download().catch(error => setEvent(String(error))); }}>下载</Button></Space>} onChoose={() => { setEvent("即将打开文件选择器"); return true; }}>拖入文件，或点击选择；此例仅保存在本地列表</Upload.Dragger>
    <Typography.Text role="status">{event}</Typography.Text>
  </Space>;
}
