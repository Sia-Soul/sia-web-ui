import { Card, ChooseBox, Space, createTauriChooseBoxSource } from "@sia.soul/sia-react-ui";

// 同一宿主目录源供四种模式复用；网页预览自动使用浏览器授权源。
const source = window.__TAURI__ ? createTauriChooseBoxSource(window.__TAURI__.core.invoke) : undefined;
export function ChooseBoxDemo() {
  return <Card title="ChooseBox 文件与文件夹选择" description="使用 SiaWebUI 自定义选择界面，支持跨目录选择和空文件夹。">
    <Space direction="vertical" style={{width:"100%"}}>
      <ChooseBox source={source} kind="file" placeholder="选择单个文件" />
      <ChooseBox source={source} kind="directory" placeholder="选择单个文件夹" />
      <ChooseBox source={source} kind="file" multiple placeholder="选择多个文件" />
      <ChooseBox source={source} kind="directory" multiple placeholder="选择多个文件夹" />
    </Space>
  </Card>;
}
