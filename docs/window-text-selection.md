# 桌面窗口文字选择

`WindowFrame.textSelectable` 默认 `true`，保留普通文档的文字选择行为。

桌面工具传入 `textSelectable={false}` 时，所在文档（包括 Portal 弹层）的普通文字不可拖选，图片也不允许浏览器原生拖拽。输入框、文本域及 contenteditable 可编辑区域仍支持选择、替换和编辑文字。此模式作用于整个文档，适用于独占 WebView 页面；文档内只要有一个窗口开启该模式就会生效，移除该窗口或改回 true 后自动恢复。

```tsx
// 桌面工具界面避免误选文字，颜色输入等编辑行为仍保留。
<WindowFrame textSelectable={false} titleBar={<WindowTitleBar/>}>
  {children}
</WindowFrame>
```

标题栏拖动：主键按下后，移动至少 2 CSS 像素才触发 `start-dragging`。静止长按不启动系统移动循环，松开或窗口失焦会取消待拖动状态。双击仍触发最大化/还原，按钮与交互控件不参与拖动。宿主应在 WebView 事件返回后异步执行原生窗口移动，避免嵌套消息循环。
