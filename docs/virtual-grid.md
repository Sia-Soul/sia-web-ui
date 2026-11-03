# VirtualGrid 虚拟网格

适用于固定行高的大型卡片目录。父级必须提供明确高度（或 `min-height: 0` 的弹性剩余高度）。只挂载视口上下各两行以内的卡片，其余项目由占位高度维持滚动范围；缩放窗口时按可用宽度重算列数。

```tsx
import { useState } from "react";
import { Card, VirtualGrid } from "@sia.soul/sia-react-ui";

// 本地完整数据分批开放浏览，搜索应先对完整数据筛选，再重置 key 和数量。
export function Catalog({ items }: { items: { id: string; name: string }[] }) {
  const [limit, setLimit] = useState(60);
  return <div style={{ height: 480 }}>
    <VirtualGrid items={items.slice(0, limit)} itemKey={item => item.id}
      rowHeight={100} minColumnWidth={180} gap={8} overscan={2}
      hasMore={limit < items.length} onLoadMore={() => setLimit(value => value + 60)}
      empty="没有找到物品" aria-label="物品目录"
      renderItem={item => <Card style={{ height: "100%" }}>{item.name}</Card>} />
  </div>;
}
```

`rowHeight` 是完整一行的固定高度，单位 px，长文字应在卡片内部处理省略或换行上限。`minColumnWidth` 默认 200px，`gap` 默认 8px，`overscan` 默认 2 行。宽度不足时仍保留一列。项目须使用稳定的 `itemKey`。

当剩余滚动距离不超过 `loadMoreThreshold`（默认 120px），或首屏尚未填满时，`hasMore` 为 true 且 `loading` 为 false 会触发 `onLoadMore`。同一 items 长度仅通知一次，调用方负责追加数据、加载状态和失败提示；需重试可更换组件 key。组件不访问网络。筛选变化时更换 key，可重置位置与通知锁。完整目录搜索和收藏排序应在切片之前执行。
