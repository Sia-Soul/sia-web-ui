import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Editor,
  Icon,
  Modal,
  Select,
  Splitter,
  Table,
  Tabs,
  Tag,
  Tooltip,
  createCellSelectionPlugin,
  createEditablePlugin,
  createExportPlugin,
  createFilterPlugin,
  createIndexPlugin,
  createPaginationPlugin,
  createResizePlugin,
  createSortPlugin,
  message,
  type AnyTablePlugin,
  type EditorContextMenuItem,
  type EditorHandle,
  type EditorKeyDownEvent,
  type EditorLanguage,
  type EditorSelectionChange,
  type TableColumn,
  type TableExportApi,
  type TableRef,
} from "@sia-ui/react";
import { saveCsvFile } from "../services/fileExport";
import { currentSqlStatement } from "../services/sqlStatement";
import { createSqlCompletionProvider } from "../services/sqlCompletion";
import {
  loadQueryWorkspace,
  saveQueryWorkspace,
  type QueryDocument,
} from "../services/queryWorkspaceRepository";
import type { DatabaseKind, DatabaseSchema, QueryResult } from "../types";

interface ResultTableRow extends Record<string, unknown> {
  __siaRowIndex: number;
  __siaRowKey: string;
}

interface QueryWorkspaceProps {
  sql: string;
  result: QueryResult;
  running: boolean;
  error: string;
  connectionOptions: readonly { label: string; value: string }[];
  databaseOptions: readonly { label: string; value: string }[];
  databaseSchema?: DatabaseSchema;
  activeConnectionId: string;
  activeDatabase: string;
  activeConnectionConnected: boolean;
  activeConnectionConnecting?: boolean;
  databaseLoading?: boolean;
  activeDatabaseKind: DatabaseKind;
  windowTheme: "light" | "dark";
  onConnectionChange: (id: string) => void;
  onDatabaseChange: (database: string) => void;
  onSqlChange: (sql: string) => void;
  onLoadTableColumns?: (tableName: string, schemaName?: string) => Promise<readonly string[]>;
  onRun: (sql: string) => void;
  onFormat: () => void;
  onCellUpdate: (column: string, rowIndex: number, value: unknown) => Promise<boolean>;
  newQueryRequest?: {
    id: number;
    sql?: string;
    label?: string;
  };
}

const DIALECT_LANGUAGE: Record<DatabaseKind, EditorLanguage> = {
  postgres: "sql-postgresql",
  mysql: "sql-mysql",
  sqlserver: "sql-sqlserver",
  sqlite: "sql-sqlite",
};

function displayValue(value: unknown) {
  if (value === null) return <span className="result-null">NULL</span>;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function quoteSqlIdentifier(kind: DatabaseKind, identifier: string) {
  if (kind === "mysql") return `\`${identifier.replaceAll("`", "``")}\``;
  if (kind === "sqlserver") return `[${identifier.replaceAll("]", "]]")}]`;
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function quoteSqlTable(kind: DatabaseKind, table: string) {
  return table.split(".").map((part) => quoteSqlIdentifier(kind, part)).join(".");
}

function sqlParameterPreview(value: unknown, kind: DatabaseKind) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return kind === "sqlserver" ? (value ? "1" : "0") : value ? "TRUE" : "FALSE";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("'", "''")}'`;
}

function buildCellUpdateSql(
  result: QueryResult,
  column: string,
  rowIndex: number,
  value: unknown,
  kind: DatabaseKind,
) {
  const editable = result.editable;
  const row = result.rows[rowIndex];
  if (!editable || !row) return "";
  const predicates = editable.primaryKeys.map((primaryKey, index) =>
    `${quoteSqlIdentifier(kind, primaryKey)} = @pk${index}`);
  const parameters = [
    `-- @value = ${sqlParameterPreview(value, kind)}`,
    ...editable.primaryKeys.map((primaryKey, index) =>
      `-- @pk${index} = ${sqlParameterPreview(row[primaryKey], kind)}`),
  ];
  return [
    `UPDATE ${quoteSqlTable(kind, editable.table)}`,
    `SET ${quoteSqlIdentifier(kind, column)} = @value`,
    `WHERE ${predicates.join(" AND ")};`,
    "",
    "-- 参数",
    ...parameters,
  ].join("\n");
}

function nextQuerySequence(queries: readonly QueryDocument[]) {
  return queries.reduce((next, query) => {
    const match = /^query-(\d+)$/.exec(query.key);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

export function QueryWorkspace({
  sql,
  result,
  running,
  error,
  connectionOptions,
  databaseOptions,
  databaseSchema,
  activeConnectionId,
  activeDatabase,
  activeConnectionConnected,
  activeConnectionConnecting = false,
  databaseLoading = false,
  activeDatabaseKind,
  windowTheme,
  onConnectionChange,
  onDatabaseChange,
  onSqlChange,
  onLoadTableColumns,
  onRun,
  onFormat,
  onCellUpdate,
  newQueryRequest = { id: 0 },
}: QueryWorkspaceProps) {
  const [resultTab, setResultTab] = useState("result");
  const [selectedCellCount, setSelectedCellCount] = useState(0);
  const [editorSelection, setEditorSelection] = useState<EditorSelectionChange>({
    range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
    text: "",
    cursorOffset: 0,
  });
  const [activeQueryKey, setActiveQueryKey] = useState("query-1");
  const [queries, setQueries] = useState<QueryDocument[]>([
    { key: "query-1", label: "查询 1", sql },
    { key: "query-2", label: "订单分析", sql: "SELECT *\nFROM orders\nWHERE status = 'pending'\nORDER BY created_at DESC;" },
  ]);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const nextQueryNumber = useRef(3);
  const handledNewQueryRequest = useRef(0);
  const resultTableRef = useRef<TableRef<ResultTableRow>>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const activeQuery = queries.find((query) => query.key === activeQueryKey) ?? queries[0];
  const activeSql = activeQuery?.sql ?? sql;
  const activeStatement = useMemo(
    () => currentSqlStatement(activeSql, editorSelection.cursorOffset),
    [activeSql, editorSelection.cursorOffset],
  );
  const completionProvider = useMemo(() => createSqlCompletionProvider({
    kind: activeDatabaseKind,
    databaseNames: databaseOptions.map((option) => option.value),
    schema: databaseSchema,
    loadTableColumns: onLoadTableColumns,
  }), [activeDatabaseKind, databaseOptions, databaseSchema, onLoadTableColumns]);
  const runSelectionOrCurrentStatement = useCallback(() => {
    const selectedSql = editorRef.current?.getSelectedText().trim();
    if (selectedSql) {
      onRun(selectedSql);
      return;
    }
    const statement = activeStatement?.text.trim();
    if (statement && activeStatement) {
      editorRef.current?.setSelection(activeStatement.range);
      onRun(statement);
      return;
    }
    onRun(activeSql);
  }, [activeSql, activeStatement, onRun]);
  const handleEditorKeyDown = useCallback((event: EditorKeyDownEvent) => {
    const modifierPressed = event.ctrlKey || event.metaKey;
    const runShortcut = event.key === "F5"
      || (modifierPressed && event.key.toLowerCase() === "r")
      || (modifierPressed && event.key === "Enter");
    if (!runShortcut) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat && !running) runSelectionOrCurrentStatement();
  }, [runSelectionOrCurrentStatement, running]);
  const editorContextMenuItems = useMemo<readonly EditorContextMenuItem[]>(() => [
    {
      key: "run-selection",
      label: "运行已选择的",
      disabled: (api) => !api?.getSelectedText().trim(),
      onClick: (api) => {
        const selectedSql = api.getSelectedText().trim();
        if (selectedSql) onRun(selectedSql);
      },
    },
    { key: "cut", label: "剪切", command: "cut" },
    { key: "copy", label: "复制", command: "copy" },
    { key: "paste", label: "粘贴", command: "paste" },
    {
      key: "select-current",
      label: "选择当前语句",
      disabled: !activeStatement,
      onClick: (api) => {
        if (activeStatement) api.setSelection(activeStatement.range);
      },
    },
    { key: "select-all", label: "全选", command: "selectAll" },
  ], [activeStatement, onRun]);

  useEffect(() => {
    let cancelled = false;
    void loadQueryWorkspace().then((snapshot) => {
      if (cancelled) return;
      const loadedQueries = snapshot?.queries.filter((query) => query.key && query.label) ?? [];
      if (snapshot && loadedQueries.length === 0) {
        setQueries([]);
        setActiveQueryKey("");
        nextQueryNumber.current = 1;
        onSqlChange("");
      } else if (loadedQueries.length > 0) {
        const loadedActiveKey = loadedQueries.some((query) => query.key === snapshot?.activeQueryKey)
          ? snapshot?.activeQueryKey ?? loadedQueries[0].key
          : loadedQueries[0].key;
        const loadedActiveQuery = loadedQueries.find((query) => query.key === loadedActiveKey) ?? loadedQueries[0];
        setQueries(loadedQueries);
        setActiveQueryKey(loadedActiveKey);
        nextQueryNumber.current = nextQuerySequence(loadedQueries);
        onSqlChange(loadedActiveQuery.sql);
      }
      setWorkspaceReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [onSqlChange]);

  useEffect(() => {
    if (!workspaceReady) return undefined;
    const timer = window.setTimeout(() => {
      void saveQueryWorkspace({
        version: 1,
        activeQueryKey,
        queries,
      }).catch((saveError) => {
        Modal.error({
          title: "查询自动保存失败",
          children: saveError instanceof Error ? saveError.message : String(saveError),
        });
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeQueryKey, queries, workspaceReady]);

  useEffect(() => {
    setQueries((items) => items.map((item) => item.key === activeQueryKey && item.sql !== sql ? { ...item, sql } : item));
  }, [activeQueryKey, sql]);

  function changeActiveQuery(key: string) {
    const query = queries.find((item) => item.key === key);
    if (!query) return;
    setActiveQueryKey(key);
    onSqlChange(query.sql);
  }

  function changeSql(value: string) {
    setQueries((items) => items.map((item) => item.key === activeQueryKey ? { ...item, sql: value } : item));
    onSqlChange(value);
  }

  function addQuery(initialSql = "-- 新查询\n\n", label?: string) {
    const number = nextQueryNumber.current;
    nextQueryNumber.current += 1;
    const next = { key: `query-${number}`, label: label ?? `查询 ${number}`, sql: initialSql };
    setQueries((items) => [...items, next]);
    setActiveQueryKey(next.key);
    onSqlChange(next.sql);
  }

  useEffect(() => {
    if (newQueryRequest.id <= handledNewQueryRequest.current) return;
    handledNewQueryRequest.current = newQueryRequest.id;
    addQuery(newQueryRequest.sql, newQueryRequest.label);
  }, [newQueryRequest]);

  function closeQuery(key: string) {
    const index = queries.findIndex((query) => query.key === key);
    if (index < 0) return;
    const nextQueries = queries.filter((query) => query.key !== key);
    setQueries(nextQueries);
    if (key === activeQueryKey) {
      const nextActive = nextQueries[Math.min(index, nextQueries.length - 1)];
      setActiveQueryKey(nextActive?.key ?? "");
      onSqlChange(nextActive?.sql ?? "");
    }
  }

  function closeOtherQueries(key: string) {
    const query = queries.find((item) => item.key === key);
    if (!query) return;
    setQueries([query]);
    setActiveQueryKey(query.key);
    onSqlChange(query.sql);
  }

  function closeAllQueries() {
    setQueries([]);
    setActiveQueryKey("");
    onSqlChange("");
  }

  useEffect(() => {
    function handleCloseTabShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "w") return;
      event.preventDefault();
      if (event.shiftKey) closeAllQueries();
      else closeQuery(activeQueryKey);
    }
    window.addEventListener("keydown", handleCloseTabShortcut);
    return () => window.removeEventListener("keydown", handleCloseTabShortcut);
  }, [activeQueryKey, queries]);

  const columns = useMemo<TableColumn<ResultTableRow>[]>(() => {
    const keys = Object.keys(result.rows[0] ?? {});
    return keys.map((key) => {
      const isPrimaryKey = result.editable?.primaryKeys.some((primaryKey) => primaryKey.toLowerCase() === key.toLowerCase()) ?? false;
      const isSourceColumn = result.editable?.columns.some((column) => column.toLowerCase() === key.toLowerCase()) ?? false;
      return {
        key,
        name: key,
        title: key,
        description: isPrimaryKey
          ? "主键列只读，用于安全定位数据库记录。"
          : isSourceColumn ? "双击修改后将执行参数化 UPDATE，并在执行前自动备份原记录。" : "该列不是来源表的直接列，不能写回数据库。",
        dataIndex: key,
        minWidth: key.includes("email") || key.includes("time") || key.includes("date") ? 190 : 110,
        ellipsis: true,
        sortable: true,
        filterable: true,
        editable: (() => {
          if (!result.editable || isPrimaryKey || !isSourceColumn) return false;
        const sample = result.rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key];
        if (typeof sample === "object") return false;
        if (typeof sample === "number") return { type: "inputNumber" as const };
        if (typeof sample === "boolean") return { type: "select" as const, options: [{ label: "true", value: "true" }, { label: "false", value: "false" }] };
        return { type: "input" as const };
        })(),
        render: (value: unknown) => key === "status"
          ? <Tag status={String(value) === "active" ? "success" : "default"}>{displayValue(value)}</Tag>
          : displayValue(value),
      };
    });
  }, [result.editable, result.rows]);
  const tableRows = useMemo<ResultTableRow[]>(() => result.rows.map((row, index) => ({
    ...row,
    __siaRowIndex: index,
    __siaRowKey: `${result.executedAt || "result"}-${index}`,
  })), [result.executedAt, result.rows]);
  const resultPlugins = useMemo<readonly AnyTablePlugin<ResultTableRow>[]>(() => [
    createIndexPlugin<ResultTableRow>({ width: 52 }),
    createCellSelectionPlugin<ResultTableRow>({
      copyable: true,
      onChange: (_range, cells) => setSelectedCellCount(cells.length),
    }),
    createFilterPlugin<ResultTableRow>(),
    createSortPlugin<ResultTableRow>({ scope: "all" }),
    createPaginationPlugin<ResultTableRow>({ defaultPageSize: 20, pageSizeOptions: [20, 50, 100, 200] }),
    createEditablePlugin<ResultTableRow>({
      trigger: "doubleClick",
      onCellChange: async (columnKey, record, nextValue) => {
        const originalValue = record[columnKey];
        const normalizedValue = typeof originalValue === "boolean" ? String(nextValue) === "true" : nextValue;
        const updateSql = buildCellUpdateSql(result, columnKey, record.__siaRowIndex, normalizedValue, activeDatabaseKind);
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: "确认修改单元格",
            centered: true,
            width: 680,
            okText: "确认修改",
            cancelText: "取消",
            children: (
              <div className="cell-update-confirmation">
                <p>确认后将先备份原始数据，再执行下面的参数化 SQL：</p>
                <pre><code>{updateSql}</code></pre>
              </div>
            ),
            onCancel: () => resolve(false),
            onOk: () => {
              resolve(true);
            },
          });
        });
        if (!confirmed) return false;
        return onCellUpdate(columnKey, record.__siaRowIndex, normalizedValue);
      },
    }),
    createResizePlugin<ResultTableRow>(),
    createExportPlugin<ResultTableRow>({
      scope: "all",
      fileName: `query-result-${new Date().toISOString().slice(0, 10)}.csv`,
      showButton: false,
    }),
  ], [activeDatabaseKind, onCellUpdate, result]);

  async function exportResults() {
    const exportApi = resultTableRef.current?.getPluginApi<TableExportApi<ResultTableRow>>("export");
    if (!exportApi || result.rows.length === 0) {
      message.warning("当前没有可导出的结果。");
      return;
    }
    try {
      const fileName = `query-result-${new Date().toISOString().slice(0, 10)}.csv`;
      const savedPath = await saveCsvFile(fileName, exportApi.getCsv("all"));
      if (savedPath) message.success(`已导出 ${result.rows.length} 行 CSV：${savedPath}`);
    } catch (exportError) {
      Modal.error({
        title: "导出结果失败",
        centered: true,
        children: exportError instanceof Error ? exportError.message : String(exportError),
      });
    }
  }

  return (
    <main className="query-workspace">
      <Tabs
        className="query-tabs"
        activeKey={activeQueryKey}
        onChange={changeActiveQuery}
        items={queries.map((query) => ({ key: query.key, label: query.label, icon: <Icon name="file" size={14} /> }))}
        closable
        onEdit={(key, action) => action === "remove" && closeQuery(key)}
        tabContextMenu={[
          { key: "close", label: "关闭(S)", extra: "Ctrl+W" },
          { key: "close-others", label: "关闭其他选项卡(T)", disabled: queries.length <= 1 },
          { key: "close-all", label: "全部关闭(U)", extra: "Shift+Ctrl+W" },
        ]}
        onTabContextMenuClick={({ key, tabKey }) => {
          if (key === "close") closeQuery(tabKey);
          else if (key === "close-others") closeOtherQueries(tabKey);
          else if (key === "close-all") closeAllQueries();
        }}
        tabBarExtraContent={<Tooltip title="新建查询"><Button variant="text" size="small" icon={<Icon name="plus" size={16} />} aria-label="新建查询" onClick={() => addQuery()} /></Tooltip>}
      />

      {activeQuery ? (
        <Splitter orientation="vertical" className="query-splitter">
        <Splitter.Panel defaultSize={53} min={30}>
          <section className="editor-panel">
            <div className="query-toolbar">
              <Tooltip title="运行（F5 / Ctrl+R / Ctrl+Enter）：优先运行选中内容，否则运行当前 SQL 语句">
                <Button variant="primary" icon={<Icon name="play" size={15} />} loading={running} onClick={runSelectionOrCurrentStatement}>运行</Button>
              </Tooltip>
              <Button danger icon={<Icon name="stop" size={15} />} disabled={!running}>停止</Button>
              <Button icon={<Icon name="code" size={15} />} onClick={onFormat}>格式化</Button>
              <span className="query-toolbar__spacer" />
              <Select
                className="active-connection-select"
                value={activeConnectionId}
                options={connectionOptions}
                aria-label="当前数据库连接"
                onChange={(value) => value && onConnectionChange(String(value))}
              />
              <Select
                className="active-database-select"
                value={activeDatabase}
                options={databaseOptions}
                loading={databaseLoading}
                disabled={!activeConnectionConnected}
                showSearch
                searchPlaceholder="搜索数据库"
                notFoundContent="没有匹配的数据库"
                aria-label="当前数据库"
                onChange={(value) => value && onDatabaseChange(String(value))}
              />
              <span className={`connection-state${activeConnectionConnected ? " is-online" : ""}`}>
                {activeConnectionConnecting ? <Icon name="loader" size={13} spin /> : <i />}
                {activeConnectionConnecting ? "正在连接，成功后自动执行…" : activeConnectionConnected ? "已连接" : "未连接"}
              </span>
            </div>
            <Editor
              className="sql-editor"
              value={activeSql}
              onChange={changeSql}
              onReady={(api) => {
                editorRef.current = api;
              }}
              onSelectionChange={setEditorSelection}
              onKeyDown={handleEditorKeyDown}
              language={DIALECT_LANGUAGE[activeDatabaseKind]}
              theme={windowTheme}
              highlightRange={activeStatement?.range}
              contextMenuItems={editorContextMenuItems}
              completionProvider={completionProvider}
              completionTriggerCharacters={["."]}
              refreshSuggestionOnSpace
              ariaLabel="SQL 查询编辑器"
              options={{
                fontSize: 14,
                lineHeight: 24,
                padding: { top: 16, bottom: 16 },
                quickSuggestions: { other: true, comments: false, strings: false },
                suggestOnTriggerCharacters: true,
                wordBasedSuggestions: "off",
                wordWrap: "off",
                renderLineHighlight: "none",
              }}
            />
          </section>
        </Splitter.Panel>

        <Splitter.Panel defaultSize={47} min={25}>
          <section className="result-panel">
            <Tabs
              className="result-tabs"
              activeKey={resultTab}
              onChange={setResultTab}
              items={[
                { key: "result", label: `结果 ${result.rows.length}` },
                { key: "message", label: "消息" },
                { key: "plan", label: "执行计划" },
              ]}
              tabBarExtraContent={(
                <div className="result-actions">
                  <div className="result-inline-info">
                    <span>{result.rows.length} 行 · {result.durationMs} ms{selectedCellCount > 0 ? ` · 已选 ${selectedCellCount} 个单元格` : ""}</span>
                    <span>{result.rows.length === 0
                      ? "运行 SQL 后将在下方显示结果"
                      : result.editable
                        ? "双击编辑非主键列 · 确认 SQL 后自动备份并执行 UPDATE"
                        : "当前结果只读：仅包含主键的单表查询可写回"}</span>
                  </div>
                  <Tooltip title="选择路径并导出全部结果为 CSV"><Button variant="text" size="small" icon={<Icon name="download" size={15} />} aria-label="导出结果" disabled={result.rows.length === 0} onClick={() => void exportResults()} /></Tooltip>
                </div>
              )}
            />
            {resultTab === "result" ? (
              <div className="result-table-wrap">
                <Table
                  key={result.executedAt || "empty-result"}
                  ref={resultTableRef}
                  dataSource={tableRows}
                  columns={columns}
                  plugins={resultPlugins}
                  rowKey="__siaRowKey"
                  size="small"
                  bordered
                  stickyHeader
                  height="100%"
                  loading={running}
                  emptyText={error || "运行 SQL 后将在这里显示结果"}
                />
              </div>
            ) : resultTab === "message" ? (
              <div className={`query-message${error ? " is-error" : ""}`}>
                <Icon name={error ? "circle-close" : "circle-check"} size={18} />
                <div><strong>{error ? "执行失败" : "执行完成"}</strong><p>{error || result.message}</p></div>
              </div>
            ) : (
              <div className="query-empty-state"><Icon name="code" size={28} /><p>运行 EXPLAIN 查询后显示执行计划。</p></div>
            )}
          </section>
        </Splitter.Panel>
        </Splitter>
      ) : (
        <section className="query-workspace-empty">
          <Icon name="file" size={34} />
          <strong>没有打开的查询</strong>
          <p>点击上方“+”创建一个新的 SQL 查询。</p>
          <Button variant="primary" icon={<Icon name="plus" size={15} />} onClick={() => addQuery()}>
            新建查询
          </Button>
        </section>
      )}
    </main>
  );
}
