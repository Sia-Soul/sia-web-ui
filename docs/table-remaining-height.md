# Table 自动填充剩余高度

<!-- 记录公开能力和实际验证边界，业务接入必须使用发布版本。 -->

页面可使用 `<Table fillRemaining={{ bottomOffset: 12 }} />`，表格自动填充从自身顶部到当前视口底部的剩余空间。无需业务计算 `100vh` 或维护 ResizeObserver。

弹框等具有确定高度的区域可使用：

```tsx
const containerRef = useRef<HTMLDivElement>(null);
const fillRemaining = useMemo(() => ({
  container: () => containerRef.current,
  bottomOffset: 6,
}), []);

return <div ref={containerRef} style={{ height: 500 }}>
  <QueryForm fields={fields} />
  <Table fillRemaining={fillRemaining} columns={columns} dataSource={rows} />
</div>;
```

- 默认关闭。传 `true` 使用视口，底部额外留白为 0。
- 高度包含工具栏、表头、内容和分页；沿用表格内部滚动。
- `container` 返回独立确定高度的容器，填充到其底部内边距内侧；不能使用高度依赖表格内容的容器，否则形成循环。
- `bottomOffset` 默认 0px；表格下方还有业务内容时，由调用者预留相应空间。
- `minHeight` 默认 0px，设置后空间不足时允许溢出，以保留最低操作高度。
- 显式 `height`、`tableHeight` 优先于自动测量，原有页面默认行为保持不变。
- 响应窗口、容器、查询区尺寸、祖先显隐和入场动画完成；表格内部滚动不重新测量外部高度。
- 不支持表格高度反过来决定顶部位置的垂直居中布局；应使用顶部对齐布局。

## 验证

`scripts/test-table-remaining-height.cjs` 在真实 Chromium 中覆盖视口缩放、固定容器缩放、查询条件折叠、隐藏后重新显示、显式高度优先、空数据、布尔开关、最小高度和虚拟滚动。测试页面位于 `apps/docs/tests/table-remaining-height.html`，使用 docs Vite 的 4189 端口；脚本参数为包含 playwright 的 node_modules 目录。

这是框架回归，不能替代吊牌管理页面在升级正式依赖后的业务验收。此改动尚未发布，业务不能提前使用未发布属性或修改 node_modules 接入。
