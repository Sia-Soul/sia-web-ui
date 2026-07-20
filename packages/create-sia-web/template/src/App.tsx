import { Alert, Button, Card, Space } from "@sia-ui/react";

export default function App() {
  return (
    <main className="app-shell">
      <header>
        <div><strong>Sia Web App</strong><span>统一、轻量、可扩展</span></div>
        <Button variant="primary">新建内容</Button>
      </header>
      <section>
        <h1>项目已经准备好了</h1>
        <p>组件、设计令牌与基础样式已接入，可以从这里开始构建业务。</p>
        <Alert title="Sia Web UI 已启用" description="修改 src/App.tsx 开始开发。" />
        <Card title="快速操作" description="这些组件来自 @sia-ui/react">
          <Space wrap><Button variant="primary">主要操作</Button><Button>次要操作</Button><Button variant="dashed">更多操作</Button></Space>
        </Card>
      </section>
    </main>
  );
}

