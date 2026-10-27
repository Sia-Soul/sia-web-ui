# 表格按行定位

`TableRef.scrollToRow(key)` 按稳定的 `rowKey` 查找当前展示列表中的行。适用于导入进度跟随正在处理项、校验错误定位等场景。

- 支持普通列表、虚拟列表和 Canvas 表格，使用排序、筛选、分页和树展开后的行位置。
- 仅当目标行被遮挡时立即纵向滚动，避开吸顶表头及合计行；不移动横向位置、不转移焦点、不排队播放平滑滚动动画。
- 已完整可见的行保持原位置。目标行高于可视区域时，优先对齐行顶部。
- 表格隐藏或未挂载、目标被筛掉或在其他页时返回 `false`，不自动切换筛选和分页；找到可定位的目标返回 `true`。
- 在 React 提交数据后调用；弹框重新显示时再次调用。不自动持续跟随，业务决定何时跟随及何时尊重用户筛选。

```tsx
const table = useRef<TableRef<SaveRow>>(null);
const processingKey = rows.find(row => row.status === 'processing')?.key;

// 保存状态变化后定位，结果筛选时保留用户选择。
useEffect(() => {
  if (open && running && filter === 'all' && processingKey !== undefined) {
    table.current?.scrollToRow(processingKey);
  }
}, [open, running, filter, processingKey]);

<Table ref={table} rowKey="key" columns={columns} dataSource={rows} />
```

此能力已随用户发布的 0.1.131 提供。合作方端已升级正式依赖并接入保存进度跟随，完成实际业务页面 500 行逐项可见性验证；资料读取与保存接口采用受控返回，未新增真实业务单据。业务验收见 `D:/Projects/Company/KA/ka-group/ka-web-group/docs/sia-131-progress-follow.md`。

2026-10-27 验证：组件库类型检查、构建、`check:api-docs`、`test:api-docs` 通过。Edge 浏览器覆盖 DOM/Canvas、500 行逐项连续定位、首行/末行往返、手动滚动后继续跟随、排序、多层表头与合计避让、非虚拟列表、非吸顶表头、空表、无效键、隐藏后重显及横向位置保留；日志位于 `logs/table-scroll-row-*.log`。
