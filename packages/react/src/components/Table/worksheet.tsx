import type { ReactNode } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { createEditablePlugin } from "./plugins";
import type {
  TableCellAddress,
  TableCellRange,
  TableCellSelectionApi,
} from "./plugins";
import type {
  TableColumn,
  TableKey,
  TablePlugin,
  TablePluginContext,
} from "./types";
import type {
  TableWorksheetApi,
  TableWorksheetChange,
  TableWorksheetOperation,
  TableWorksheetPluginOptions,
  TableWorksheetReason,
} from "./worksheetTypes";
import {
  flattenTableColumns,
  getTableValue,
  mapTableLeafColumns,
  sortTableColumnsByFixed,
} from "./utils";
import {
  incrementWorksheetValue,
  parseWorksheetText,
  setWorksheetValue,
  worksheetText,
} from "./worksheetModel";
import "./worksheet.css";

/** 工作表内部视图状态，数据和历史由插件实例独立持有。 */
interface WorksheetState {
  /** 当前编辑单元格；null 表示浏览状态。 */
  editing: TableCellAddress | null;
  /** 历史或拖拽预览变化时递增。 */
  revision: number;
}
type Bounds = { top: number; bottom: number; left: number; right: number };
type SourceCell = {
  value: unknown;
  kind: string;
  columnKey: string;
  record: unknown;
};
type Snapshot<T> = { data: readonly T[]; range: TableCellRange | null };
type Update = {
  address: TableCellAddress;
  value: unknown;
  source?: SourceCell;
};
const isEmpty = (value: unknown) => value == null || value === "";
const editorKind = <T,>(column: TableColumn<T>) =>
  !column.editable
    ? "readonly"
    : typeof column.editable === "object"
    ? column.editable.type ?? "input"
    : "input";
const nativeEditor = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'input,textarea,select,[contenteditable="true"],[role="combobox"]'
    )
  );

/**
 * 创建 Excel 式工作表插件，内含双击编辑、选区批量粘贴、上下填充和整次撤销恢复。
 * 与 Table 默认单元格选择配合，勿再同时安装 createEditablePlugin；使用稳定 rowKey。
 * 每个表格用 useMemo 创建独立实例，onChange 必须同步更新不可变 dataSource；外部换表自动清空历史。
 * 输入框中的原生复制、粘贴和撤销保留；快捷键只在当前工作表内生效，不发送网络请求。
 * 填充柄仅在选区右下角单元格可编辑时显示，遵循 editable 与 editable.canEdit；只读格仍可选中和复制。
 */
export function createWorksheetPlugin<T extends Record<string, unknown>>(
  options: TableWorksheetPluginOptions<T>
): TablePlugin<T, WorksheetState, TableWorksheetApi<T>> {
  let context: TablePluginContext<T, WorksheetState>;
  let root: HTMLElement | null = null;
  let data: readonly T[] = [];
  let observed: readonly T[] | undefined;
  let expected: readonly T[] | undefined;
  let editEpoch = 0;
  let suppressEditing = false;
  const undoStack: Snapshot<T>[] = [];
  const redoStack: Snapshot<T>[] = [];
  const limit = Number.isFinite(options.historyLimit)
    ? Math.max(1, Math.floor(options.historyLimit!))
    : 100;
  let clipboard: { text: string; cells: SourceCell[][] } | undefined;
  let drag:
    | {
        bounds: Bounds;
        target: number;
        cells: SourceCell[][];
        increment: boolean;
      }
    | undefined;
  let frame = 0,
    pointerY = 0,
    pointerX = 0;
  const selection = () =>
    context.getPluginApi<TableCellSelectionApi<T>>("cellSelection");
  const range = () => selection()?.getRange() ?? null;
  const redraw = () =>
    context.setState((state) => ({ ...state, revision: state.revision + 1 }));
  let columnInput: readonly TableColumn<T>[] | undefined;
  let columnCache: TableColumn<T>[] = [];
  let rangeContext: TablePluginContext<T, WorksheetState> | undefined;
  let cachedRange: TableCellRange | null | undefined;
  let cachedBounds: Bounds | undefined;
  // 同一渲染内所有单元格共享列/选区计算，避免 500 行时逐格扫描全表。
  const columns = () => {
    if (columnInput !== context.columns) {
      columnInput = context.columns;
      columnCache = flattenTableColumns(
        sortTableColumnsByFixed(context.columns)
      ).filter((column) => !column.meta?.plugin);
    }
    return columnCache;
  };
  const valueAt = (rowIndex: number, column: TableColumn<T>) =>
    getTableValue(
      context.rows[rowIndex].record,
      column.dataIndex,
      column.code ?? column.key
    );
  const editable = (record: T, column: TableColumn<T>) =>
    Boolean(column.editable) &&
    (typeof column.editable !== "object" ||
      column.editable.canEdit?.(record) !== false);
  function bounds(): Bounds | undefined {
    const selectedRange = range();
    if (rangeContext === context && cachedRange === selectedRange)
      return cachedBounds;
    rangeContext = context;
    cachedRange = selectedRange;
    const cols = columns();
    const rowIndexes = new Map(
      context.rows.map((row, index) => [row.key, index])
    );
    const columnIndexes = new Map(
      cols.map((column, index) => [column.key, index])
    );
    let result: Bounds | undefined;
    for (const cell of selection()?.getSelectedCells() ?? []) {
      const col = columnIndexes.get(cell.columnKey),
        row = rowIndexes.get(cell.rowKey);
      if (col === undefined || row === undefined) continue;
      if (!result) result = { top: row, bottom: row, left: col, right: col };
      else {
        result.top = Math.min(result.top, row);
        result.bottom = Math.max(result.bottom, row);
        result.left = Math.min(result.left, col);
        result.right = Math.max(result.right, col);
      }
    }
    return (cachedBounds = result);
  }
  function sourceCells(area: Bounds): SourceCell[][] {
    return context.rows.slice(area.top, area.bottom + 1).map((row) =>
      columns()
        .slice(area.left, area.right + 1)
        .map((column) => ({
          value: getTableValue(
            row.record,
            column.dataIndex,
            column.code ?? column.key
          ),
          kind: editable(row.record, column) ? editorKind(column) : "readonly",
          columnKey: column.key,
          record: row.record,
        }))
    );
  }
  function stopDrag() {
    cancelAnimationFrame(frame);
    frame = 0;
    const active = Boolean(drag);
    drag = undefined;
    if (active) redraw();
  }
  function clearHistory() {
    undoStack.length = 0;
    redoStack.length = 0;
    clipboard = undefined;
    stopDrag();
    editEpoch++;
    suppressEditing = true;
    context.setState((state) => ({
      ...state,
      editing: null,
      revision: state.revision + 1,
    }));
  }
  function remember(next: TablePluginContext<T, WorksheetState>) {
    context = next;
    if (observed !== next.sourceData) {
      // 受控回写保持同一数组引用；外部换表不能撤销回上一份文件。
      if (observed && next.sourceData !== expected) {
        undoStack.length = 0;
        redoStack.length = 0;
        clipboard = undefined;
        drag = undefined;
        // 同行键、同值的新文件也必须终止旧输入会话，迟到保存不能串写新批次。
        editEpoch++;
        suppressEditing = true;
      }
      observed = next.sourceData;
      data = next.sourceData;
      expected = undefined;
    }
  }
  function commit(
    next: T[],
    operation: TableWorksheetOperation,
    history = true
  ) {
    if (next === data) return false;
    const previous = { data, range: range() };
    try {
      if (options.onChange(next, operation) === false) return false;
    } catch (error) {
      options.onError?.(error);
      return false;
    }
    if (history) {
      undoStack.push(previous);
      if (undoStack.length > limit) undoStack.shift();
      redoStack.length = 0;
    }
    data = next;
    expected = next;
    redraw();
    return true;
  }
  function apply(updates: Update[], reason: TableWorksheetReason) {
    const cols = columns(),
      next = [...data];
    const changes: TableWorksheetChange[] = [];
    let skipped = 0;
    // 在副本中计算全部变更，只触发一次业务回调和一条历史；异常不提交部分数据。
    try {
      for (const update of updates) {
        const index = next.findIndex(
          (record, i) => context.getRowKey(record, i) === update.address.rowKey
        );
        const column = cols.find(
          (item) => item.key === update.address.columnKey
        );
        if (index < 0 || !column || !editable(next[index], column)) {
          skipped++;
          continue;
        }
        const kind = editorKind(column);
        let value = update.value;
        if (update.source && update.source.kind !== kind) {
          skipped++;
          continue;
        }
        if (
          !update.source &&
          reason !== "edit" &&
          (kind === "select" || kind === "custom")
        ) {
          skipped++;
          continue;
        }
        if (
          kind === "custom" &&
          reason !== "edit" &&
          update.source?.columnKey !== column.key
        ) {
          skipped++;
          continue;
        }
        if (kind === "inputNumber") {
          if (isEmpty(value)) value = null;
          else if (!Number.isFinite(Number(value))) {
            skipped++;
            continue;
          } else value = Number(value);
        }
        if (
          kind === "select" &&
          !isEmpty(value) &&
          typeof column.editable === "object" &&
          !column.editable.options?.some(
            (option) =>
              Object.is(option.value, value) ||
              String(option.value) === String(value)
          )
        ) {
          skipped++;
          continue;
        }
        if (
          options.canWrite?.({
            record: next[index],
            column,
            value,
            sourceColumnKey: update.source?.columnKey,
            sourceRecord: update.source?.record as T | undefined,
          }) === false
        ) {
          skipped++;
          continue;
        }
        const previousValue = getTableValue(
          next[index],
          column.dataIndex,
          column.code ?? column.key
        );
        if (Object.is(previousValue, value)) continue;
        const record = (options.setValue ?? setWorksheetValue)(
          next[index],
          column,
          value
        );
        if (record === next[index]) {
          skipped++;
          continue;
        }
        next[index] = record;
        changes.push({ ...update.address, previousValue, value });
      }
    } catch (error) {
      options.onError?.(error);
      return false;
    }
    const operation = { reason, changes, skipped };
    const changed = changes.length > 0 && commit(next, operation);
    if (changed || changes.length === 0) options.onOperation?.(operation);
    return changed;
  }
  function restore(
    from: Snapshot<T>[],
    to: Snapshot<T>[],
    reason: "undo" | "redo"
  ) {
    const snapshot = from.at(-1);
    if (!snapshot) return false;
    const previous = { data, range: range() };
    if (!commit([...snapshot.data], { reason, changes: [], skipped: 0 }, false))
      return false;
    from.pop();
    to.push(previous);
    editEpoch++;
    suppressEditing = true;
    context.setState((state) => ({
      ...state,
      editing: null,
      revision: state.revision + 1,
    }));
    selection()?.setRange(snapshot.range);
    return true;
  }
  function paste(text: string) {
    const area = bounds();
    if (!area) return false;
    const matrix = parseWorksheetText(text),
      metadata = clipboard?.text === text ? clipboard.cells : undefined;
    const single = matrix.length === 1 && matrix[0].length === 1;
    const updates: Update[] = [],
      cols = columns();
    const height = single ? area.bottom - area.top + 1 : matrix.length;
    const width = single
      ? area.right - area.left + 1
      : Math.max(...matrix.map((row) => row.length));
    for (let r = 0; r < height && area.top + r < context.rows.length; r++) {
      for (let c = 0; c < width && area.left + c < cols.length; c++) {
        const value = single ? matrix[0][0] : matrix[r]?.[c];
        if (value === undefined) continue;
        const source = single ? metadata?.[0]?.[0] : metadata?.[r]?.[c];
        updates.push({
          address: {
            rowKey: context.rows[area.top + r].key,
            columnKey: cols[area.left + c].key,
          },
          value: source ? source.value : value,
          source,
        });
      }
    }
    return apply(updates, "paste");
  }
  function fill(
    area: Bounds,
    target: number,
    cells: SourceCell[][],
    increment = false
  ) {
    const cols = columns(),
      updates: Update[] = [];
    const start = target < area.top ? target : area.bottom + 1,
      end = target < area.top ? area.top - 1 : target;
    for (let r = start; r <= end; r++) {
      if (!context.rows[r]) continue;
      const offset =
        (((r - area.top) % cells.length) + cells.length) % cells.length;
      cells[offset].forEach((source, c) => {
        const column = cols[area.left + c];
        if (!column) return;
        updates.push({
          address: { rowKey: context.rows[r].key, columnKey: column.key },
          source,
          value: increment
            ? incrementWorksheetValue(source.value, r - (area.top + offset))
            : source.value,
        });
      });
    }
    const changed = apply(updates, "fill");
    if (changed)
      selection()?.setRange({
        anchor: {
          rowKey: context.rows[Math.min(area.top, target)].key,
          columnKey: cols[area.left].key,
        },
        focus: {
          rowKey: context.rows[Math.max(area.bottom, target)].key,
          columnKey: cols[area.right].key,
        },
      });
    return changed;
  }
  function fillTo(rowKey: TableKey, increment = false) {
    const area = bounds(),
      target = context.rows.findIndex((row) => row.key === rowKey);
    return Boolean(
      area && target >= 0 && fill(area, target, sourceCells(area), increment)
    );
  }
  function fillDownValues() {
    const area = bounds();
    if (!area) return false;
    const cells = sourceCells(area);
    // 组合属性和多选数组由业务提供空值语义；普通单元格保持原默认判定。
    const empty = options.isEmpty ?? isEmpty;
    const cols = columns().slice(area.left, area.right + 1);
    if (
      !cells.some((row, index) =>
        row.some((cell, columnIndex) => cell.kind !== "readonly" && !empty(cell.value, context.rows[area.top + index].record, cols[columnIndex]))
      )
    )
      return false;
    let target = area.bottom;
    for (let r = area.bottom + 1; r < context.rows.length; r++) {
      if (
        cols.some(
          (column) =>
            editable(context.rows[r].record, column) &&
            !empty(valueAt(r, column), context.rows[r].record, column)
        )
      )
        break;
      target = r;
    }
    return fill(area, target, cells);
  }
  function fillDown() {
    // 自定义判空属于业务回调，失败时与其余写入回调一致：不提交部分数据或历史。
    try { return fillDownValues(); }
    catch (error) { options.onError?.(error); return false; }
  }
  function pointTarget() {
    if (!drag || !root) return;
    const td = document
      .elementFromPoint(pointerX, pointerY)
      ?.closest("td[data-column-key]");
    if (td?.closest(".sia-table") !== root) return;
    const key = td?.closest("tr")?.getAttribute("data-row-key");
    const target = context.rows.findIndex((row) => String(row.key) === key);
    if (target >= 0 && target !== drag.target) {
      drag.target = target;
      redraw();
    }
  }
  function scrollDrag() {
    if (!drag || !root) return;
    const viewport = root.querySelector<HTMLElement>(".sia-table__viewport");
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const delta =
        pointerY < rect.top + 35 ? -12 : pointerY > rect.bottom - 35 ? 12 : 0;
      if (delta) viewport.scrollTop += delta;
      pointTarget();
    }
    frame = requestAnimationFrame(scrollDrag);
  }
  const api: TableWorksheetApi<T> = {
    undo: () => restore(undoStack, redoStack, "undo"),
    redo: () => restore(redoStack, undoStack, "redo"),
    getHistory: () => ({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    }),
    clearHistory,
    paste,
    fillTo,
    fillDown,
    editCell: (address, value) => apply([{ address, value }], "edit"),
    replaceData: (next) => {
      const changed = commit(next, {
        reason: "replace",
        changes: [],
        skipped: 0,
      });
      if (changed) {
        editEpoch++;
        suppressEditing = true;
      }
      return changed;
    },
  };
  return {
    id: "worksheet",
    order: 71,
    initialState: { editing: null, revision: 0 },
    transformColumns(input, current) {
      remember(current);
      const epoch = editEpoch;
      const editPlugin = createEditablePlugin<T>({
        trigger: "doubleClick",
        // 工作表由选区和填充柄提示操作，不额外展示容易被误认作清理按钮的铅笔。
        showEditIcon: false,
        onCellChange: (columnKey, record, value) => {
          if (epoch !== editEpoch) return false;
          const row = context.rows.find((item) => item.record === record);
          return Boolean(
            row &&
              apply(
                [{ address: { rowKey: row.key, columnKey }, value }],
                "edit"
              )
          );
        },
      });
      // 取消编辑立即作用于本次渲染，不在渲染期间 setState；旧批次保存和取消回调均失效。
      const edited = editPlugin.transformColumns!(input, {
        ...current,
        state: suppressEditing
          ? { ...current.state, editing: null }
          : current.state,
        setState: (next) => {
          if (epoch !== editEpoch) return;
          suppressEditing = false;
          current.setState((previous) => ({
            ...previous,
            ...(typeof next === "function" ? next(previous) : next),
          }));
        },
      });
      return mapTableLeafColumns(edited, (column) => {
        const render = column.render;
        return {
          ...column,
          render: (value, record, index, info) => {
            const area = bounds(),
              cols = columns();
            const handle =
              area &&
              context.rows[area.bottom]?.key === info.row.key &&
              cols[area.right]?.key === column.key &&
              // 填充入口与编辑权限一致，避免只读格或保存锁定后仍暗示可以拖拽修改。
              editable(record, column) &&
              (suppressEditing || !context.state.editing);
            return (
              <>
                {render
                  ? render(value, record, index, info)
                  : (value as ReactNode)}
                {handle && (
                  <button
                    type="button"
                    className="sia-table__worksheet-handle"
                    aria-label="拖拽填充；双击自动填充下方连续空单元格"
                    title="拖拽填充；Ctrl/Cmd 拖拽递增；双击填满下方连续空格"
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      drag = {
                        bounds: area,
                        target: area.bottom,
                        cells: sourceCells(area),
                        increment: event.ctrlKey || event.metaKey,
                      };
                      pointerX = event.clientX;
                      pointerY = event.clientY;
                      frame = requestAnimationFrame(scrollDrag);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      stopDrag();
                      fillDown();
                    }}
                    onClick={(event) => event.stopPropagation()}
                  />
                )}
              </>
            );
          },
        };
      });
    },
    getCellProps(row, column, current) {
      remember(current);
      const r = current.rows.indexOf(row),
        c = columns().findIndex((item) => item.key === column.key);
      const preview =
        drag &&
        c >= drag.bounds.left &&
        c <= drag.bounds.right &&
        r >= Math.min(drag.target, drag.bounds.top) &&
        r <= Math.max(drag.target, drag.bounds.bottom);
      // 灰底表达实际可写性，不改变序号等附加列；选区边框仍由选择插件保留。
      const readonly = !column.meta?.plugin && !editable(row.record, column);
      return {
        className: `sia-table__worksheet-cell${
          preview ? " sia-table__worksheet-fill-preview" : ""
        }${readonly ? " sia-table__worksheet-cell--readonly" : ""}`,
      };
    },
    renderToolbarStart(current) {
      remember(current);
      return options.toolbar === false ? null : (
        <span className="sia-table__worksheet-tools">
          <Button
            variant="text"
            size="small"
            icon={<Icon name="undo" />}
            disabled={!undoStack.length}
            title="撤销（Ctrl/Cmd + Z）"
            onClick={api.undo}
          >
            撤销
          </Button>
          <Button
            variant="text"
            size="small"
            icon={<Icon name="redo" />}
            disabled={!redoStack.length}
            title="恢复（Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y）"
            onClick={api.redo}
          >
            恢复
          </Button>
        </span>
      );
    },
    renderOverlay(current) {
      remember(current);
      return (
        <span
          hidden
          ref={(element) => {
            root = element?.closest<HTMLElement>(".sia-table") ?? null;
          }}
        />
      );
    },
    getApi(current) {
      remember(current);
      return api;
    },
    onMount() {
      const active = (event: Event) =>
        Boolean(
          root &&
            event.target instanceof Element &&
            event.target.closest(".sia-table") === root &&
            !nativeEditor(event.target)
        );
      const copy = (event: ClipboardEvent) => {
        if (
          !active(event) ||
          !event.clipboardData ||
          window.getSelection()?.toString()
        )
          return;
        const area = bounds();
        if (!area) return;
        const cells = sourceCells(area),
          text = worksheetText(
            cells.map((row) => row.map((cell) => cell.value))
          );
        clipboard = { text, cells };
        event.preventDefault();
        event.stopImmediatePropagation();
        event.clipboardData.setData("text/plain", text);
      };
      const onPaste = (event: ClipboardEvent) => {
        if (
          !active(event) ||
          !bounds() ||
          !event.clipboardData?.types.includes("text/plain")
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        paste(event.clipboardData.getData("text/plain"));
      };
      const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape" && drag) {
          stopDrag();
          return;
        }
        if (!active(event) || !(event.ctrlKey || event.metaKey)) return;
        const key = event.key.toLowerCase();
        if (key !== "z" && key !== "y") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (key === "y" || event.shiftKey) api.redo();
        else api.undo();
      };
      const move = (event: PointerEvent) => {
        if (!drag) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        drag.increment = event.ctrlKey || event.metaKey;
        pointTarget();
      };
      const up = () => {
        if (!drag) return;
        const current = drag;
        stopDrag();
        fill(current.bounds, current.target, current.cells, current.increment);
      };
      document.addEventListener("copy", copy, true);
      document.addEventListener("paste", onPaste, true);
      document.addEventListener("keydown", keydown, true);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", stopDrag);
      window.addEventListener("blur", stopDrag);
      return () => {
        cancelAnimationFrame(frame);
        drag = undefined;
        document.removeEventListener("copy", copy, true);
        document.removeEventListener("paste", onPaste, true);
        document.removeEventListener("keydown", keydown, true);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", stopDrag);
        window.removeEventListener("blur", stopDrag);
      };
    },
  };
}
