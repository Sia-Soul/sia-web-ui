# 换行排序列表

`SortableList` 默认保持单行横向排序。设置 `wrap` 后，横向条目按可用宽度自动换行，拖动时可跨行移动并预览最终落点。`direction="vertical"` 时忽略 `wrap`。

```tsx
<SortableList
  items={ids}
  wrap
  handlePlacement="custom"
  onOrderChange={setIds}
  renderItem={(id, index, handle) => (
    <Input aria-label={`标签 ${index + 1}`} prefix={handle} defaultValue={labels[id]} />
  )}
/>
```

条目宽度由内容决定，每行顶部对齐；容器不足以容纳下一项时自动换行。拖动预览不重挂载输入、不提前触发 `onOrderChange`；列表内松手吸附完成后仅提交一次新顺序。左右方向键移动一项，也可跨行；Esc、列表外松手、禁用、外部顺序或视口尺寸变化取消预览。纵向与未换行列表保持原有交互。
