import { useMemo, useRef, useState } from "react";
import {
  Button,
  Space,
  Table,
  createWorksheetPlugin,
  type TableColumn,
  type TableRef,
  type TableWorksheetApi,
} from "@sia.soul/sia-react-ui";

type Row = {
  id: number;
  style: string;
  code: string;
  name: string;
  size: string;
  price: number | null;
  applicable: boolean;
};
const initial = (): Row[] => [
  {
    id: 1,
    style: "款式一",
    code: "SKU001",
    name: "商品一",
    size: "M",
    price: 10,
    applicable: true,
  },
  {
    id: 2,
    style: "款式一",
    code: "",
    name: "",
    size: "",
    price: null,
    applicable: true,
  },
  {
    id: 3,
    style: "款式二",
    code: "",
    name: "",
    size: "",
    price: null,
    applicable: false,
  },
  {
    id: 4,
    style: "款式二",
    code: "终点",
    name: "保留",
    size: "L",
    price: 40,
    applicable: true,
  },
];
const columns: TableColumn<Row>[] = [
  {
    key: "style",
    title: "关联款式（只读）",
    dataIndex: "style",
    width: 160,
    fixed: "left",
  },
  {
    key: "code",
    title: "商品编号",
    // 必填列头与空值校验分别声明，不适用行由业务条件排除。
    required: true,
    invalid: (row) => !row.code.trim(),
    dataIndex: "code",
    width: 160,
    editable: true,
  },
  {
    key: "name",
    title: "商品名称",
    dataIndex: "name",
    width: 200,
    editable: true,
  },
  {
    key: "size",
    title: "尺码",
    required: true,
    invalid: (row) => row.applicable && !row.size,
    dataIndex: "size",
    width: 120,
    editable: {
      type: "select",
      options: [
        { value: "M", label: "M" },
        { value: "L", label: "L" },
      ],
      canEdit: (row) => row.applicable,
    },
  },
  {
    key: "price",
    title: "售价",
    // 数字 0 是合法值，不能用真假值判断必填。
    required: true,
    invalid: (row) => row.price == null,
    dataIndex: "price",
    width: 140,
    editable: { type: "inputNumber" },
  },
];

/** 完整工作表交互示例；只管理本地草稿，不调用业务接口。 */
export function WorksheetDemo() {
  const [rows, setRows] = useState(initial);
  const table = useRef<TableRef<Row>>(null);
  // 每个表格保持插件实例稳定，所有普通编辑和批量操作共用一份历史。
  const plugin = useMemo(
    () =>
      createWorksheetPlugin<Row>({
        onChange: (next) => {
          setRows(next);
        },
      }),
    []
  );
  return (
    <Space direction="vertical" size={6}>
      <p>
        单击选中，双击编辑；Ctrl/Cmd+C/V 复制粘贴；拖动右下角填充柄，按住
        Ctrl/Cmd 递增；双击填满下方连续空格。
        点击“定位首个问题”后，目标完整可见才会播放橙色边框光线：尾端固定，线身沿边框增长一圈，再从尾部收缩到头部后消失；只读格不显示填充柄。
      </p>
      <Space>
        <Button onClick={() => setRows(initial())}>重新导入示例</Button>
        <Button onClick={() => {
          // 示例按业务列顺序查找错误，框架只负责整格定位和一次流光反馈。
          for (const row of rows) {
            const column = !row.code.trim() ? 'code' : row.applicable && !row.size ? 'size' : row.price == null ? 'price' : undefined;
            // 通过公开配置演示商品导入采用的橙色、标准快速速度和 4px 线宽。
            if (column) { void table.current?.focusCell(row.id, column, { color: '#fa8c16', speed: 1, lineWidth: 4 }); break; }
          }
        }}>定位首个问题</Button>
        <Button
          onClick={() => {
            // 行复制也通过同一历史入口，复制编号由业务规则清空。
            table.current
              ?.getPluginApi<TableWorksheetApi<Row>>("worksheet")
              ?.replaceData([
                ...rows,
                { ...rows[0], id: Date.now(), code: "" },
              ]);
          }}
        >
          复制首行
        </Button>
      </Space>
      <Table
        ref={table}
        rowKey="id"
        columns={columns}
        dataSource={rows}
        plugins={[plugin]}
        height={360}
        size="small"
        // 工作表用只读单元格灰底区分可写性，不混用斑马纹。
        striped={false}
      />
    </Space>
  );
}
