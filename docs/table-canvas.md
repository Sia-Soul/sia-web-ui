# Table Canvas 模式

通过 `renderMode="canvas"` 启用混合渲染。默认仍为 `dom`。Canvas 绘制可见行列中的普通文本及声明式标签，表头、网格语义、选区、勾选和自定义交互继续使用框架已有实现。

```tsx
<Table
  renderMode="canvas"
  rowKey="id"
  columns={[
    { key: 'name', dataIndex: 'name', title: '名称', width: 180 },
    {
      key: 'status', dataIndex: 'status', title: '状态', width: 120,
      canvasRender: value => ({ text: String(value), background: '#52c41a', color: '#fff' }),
    },
    // 自定义操作保留 React 组件，仅在横向及纵向可见区域内挂载。
    { key: 'actions', title: '操作', width: 160, render: (_, row) => <Button onClick={() => edit(row)}>编辑</Button> },
  ]}
  dataSource={rows}
/>
```

业务状态色应从项目统一状态映射取得，示例颜色仅用于展示接口。

`canvasRender` 是纯绘制回调，接收参数与 `render` 相同，返回 `{ text, color?, background? }` 或 null。设置 background 后绘制圆角标签。文本过长时单行省略。未提供 canvasRender 的自定义 render 保留原有 React 交互。

Canvas 使用固定行高并强制窗口化；禁止虚拟化的插件回退到 DOM。需要多行可变行高或复杂合并布局的页面应使用 DOM 模式。应为绘制列提供明确列宽；现有 DOM 操作列仍可使用原有自动宽度机制。

勾选、排序、固定列、列设置、右键及拖动选区继续使用 Table 插件。绘制文字可通过单元格选区复制；原生浏览器按字符拖选不适用于 Canvas 文字。复制优先使用 exportRender，其次使用 canvasRender.text，再使用原有取值逻辑。

画布不接收指针事件，DOM 单元格保留 aria-label。绘制按 devicePixelRatio 缩放，滚动和调整窗口尺寸后重新绘制。

滚动事件在捕获阶段同步重绘 Canvas，直接使用本次 scrollLeft / scrollTop，不额外等待下一动画帧或 React 可见窗口提交；DOM 就绪、尺寸与主题变化仍合并到动画帧重绘。此策略减少表头先移动、内容随后追赶的延迟，不代表浏览器主线程阻塞时仍能保证每帧同步。

快速滚动时，尚未挂载的自定义交互单元格默认显示静态骨架灰条，使用当前主题文字色的低透明度绘制。React 提交该单元格后自动清除占位，即使滚动已停止也会更新；已就绪的内容和返回空值的单元格不会被骨架遮盖。占位没有点击行为或循环动画，不增加 DOM 组件数量。

回归脚本：`scripts/test-table-canvas-browser.cjs`。覆盖 58 列、100/500/1000 行、固定操作列、勾选、操作按钮、选区复制及横纵滚动。
