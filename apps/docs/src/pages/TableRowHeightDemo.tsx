import { useMemo, useRef, useState } from "react";
import { Button, Space, Table, createWorksheetPlugin, type TableColumn, type TableRef } from "@sia.soul/sia-react-ui";

type Row = { id: number; code: string; properties: string[] };
const columns: TableColumn<Row>[] = [
  { key: "code", title: "款式资料编号", dataIndex: "code", width: 220, fixed: "left", editable: true, required: true },
  { key: "properties", title: "属性组预览", dataIndex: "properties", width: 260, ellipsis: false,
    render: value => (value as string[]).map((text, index) => <div key={index}>{text}</div>) },
];

/** 不等行高使用稳定行键保存，业务只维护高度数据，不接触表格内部 DOM。 */
export function TableRowHeightDemo() {
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 500 }, (_, id) => ({ id, code: `STYLE${String(id + 1).padStart(3, "0")}`, properties: ["颜色：红色", "尺码：M、L", "材质：棉"] })));
  const [heights, setHeights] = useState<Record<string, number>>({ 0: 120, 1: 56 });
  const table = useRef<TableRef<Row>>(null);
  const plugin = useMemo(() => createWorksheetPlugin<Row>({ onChange: setRows }), []);
  return <Space direction="vertical">
    <p>拖动序号列底边调整该行高度；聚焦行高柄后按上下键调整。属性内容超出行高时在格内滚动。</p>
    <Space><Button onClick={() => table.current?.scrollToRow(499)}>定位第 500 行</Button><Button onClick={() => setHeights({})}>恢复默认行高</Button></Space>
    <Table ref={table} rowKey="id" columns={columns} dataSource={rows} plugins={[plugin]} height={400} size="small" striped={false}
      rowHeight={80} rowHeights={heights} rowResizable minRowHeight={56} maxRowHeight={480}
      // 每次拖动结束只写一次，业务可同时登记自己的行高撤销历史。
      onRowHeightChange={(record, height) => setHeights(previous => ({ ...previous, [record.id]: height }))} />
  </Space>;
}
