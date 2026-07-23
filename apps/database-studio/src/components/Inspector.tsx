import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Icon,
  Modal,
  Pagination,
  Table,
  Tag,
  Tooltip,
  createResizePlugin,
  type AnyTablePlugin,
  type TableColumn,
} from "@sia-ui/react";
import type {
  ConnectionProfile,
  ExecutionHistoryPage,
  QueryHistoryItem,
} from "../types";

interface InspectorProps {
  profile: ConnectionProfile;
  history: readonly QueryHistoryItem[];
  historyTotal: number;
  onLoadHistoryPage: (page: number, pageSize: number) => Promise<ExecutionHistoryPage>;
}

function executionResult(item: QueryHistoryItem) {
  if (item.returnedRows != null) return `返回 ${item.returnedRows} 行`;
  if (item.affectedRows != null) return `影响 ${item.affectedRows} 行`;
  return item.success ? "执行成功" : "执行失败";
}

function formatStartedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function HistoryCard({ item, connectionName }: { item: QueryHistoryItem; connectionName: string }) {
  return (
    <article className="history-item">
      <header>
        <Tag status={item.success ? "success" : item.highRisk ? "error" : "default"}>{item.operation}</Tag>
        {item.highRisk ? <Tag status="warning">高危</Tag> : null}
        {item.backupSkipped ? <Tag status="error">无备份</Tag> : item.backupPath ? <Tag status="success">已备份</Tag> : null}
      </header>
      <Tooltip title={item.sql} placement="left">
        <code>{item.sql}</code>
      </Tooltip>
      <dl>
        <div><dt>连接</dt><dd>{connectionName}</dd></div>
        <div><dt>数据库</dt><dd>{item.database}</dd></div>
        <div><dt>结果</dt><dd>{executionResult(item)}</dd></div>
        {item.parameters && Object.keys(item.parameters).length > 0 ? <div><dt>参数</dt><dd title={JSON.stringify(item.parameters)}>{JSON.stringify(item.parameters)}</dd></div> : null}
        {item.backupPath ? <div><dt>备份</dt><dd title={item.backupPath}>{item.backupRowCount ?? 0} 行 · {item.backupPath}</dd></div> : null}
        {item.backupError ? <div><dt>备份错误</dt><dd>{item.backupError}</dd></div> : null}
        {item.error ? <div><dt>错误</dt><dd>{item.error}</dd></div> : null}
      </dl>
      <footer>
        <span className={item.success ? "is-success" : "is-error"}><Icon name={item.success ? "circle-check" : "circle-close"} size={14} />{item.durationMs} ms</span>
        <time>{formatStartedAt(item.startedAt)}</time>
      </footer>
    </article>
  );
}

export function Inspector({ profile, history, historyTotal, onLoadHistoryPage }: InspectorProps) {
  const [allOpen, setAllOpen] = useState(false);
  const [allHistory, setAllHistory] = useState<ExecutionHistoryPage>({ items: [], total: 0 });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(20);
  const [detail, setDetail] = useState<QueryHistoryItem>();
  const requestId = useRef(0);

  useEffect(() => {
    setAllOpen(false);
    setDetail(undefined);
    setHistoryPage(1);
  }, [profile.id]);

  async function loadPage(page: number, pageSize: number) {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setHistoryLoading(true);
    try {
      const nextPage = await onLoadHistoryPage(page, pageSize);
      if (requestId.current !== currentRequest) return;
      setAllHistory(nextPage);
      setHistoryPage(page);
      setHistoryPageSize(pageSize);
    } catch (error) {
      Modal.error({
        title: "执行日志加载失败",
        children: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (requestId.current === currentRequest) setHistoryLoading(false);
    }
  }

  function openAllHistory() {
    setAllOpen(true);
    void loadPage(1, historyPageSize);
  }

  const historyColumns = useMemo<TableColumn<QueryHistoryItem>[]>(() => [
    {
      key: "startedAt",
      title: "开始时间",
      dataIndex: "startedAt",
      width: 168,
      render: (value) => formatStartedAt(String(value)),
    },
    {
      key: "operation",
      title: "类型",
      dataIndex: "operation",
      width: 92,
      render: (value, item) => <Tag status={item.success ? "success" : "error"}>{String(value)}</Tag>,
    },
    { key: "database", title: "数据库", dataIndex: "database", width: 130, ellipsis: true },
    {
      key: "sql",
      title: "SQL",
      dataIndex: "sql",
      minWidth: 280,
      ellipsis: true,
      render: (value) => <Tooltip title={String(value)}><code className="history-table-sql">{String(value)}</code></Tooltip>,
    },
    {
      key: "result",
      title: "结果",
      width: 108,
      render: (_value, item) => executionResult(item),
    },
    {
      key: "durationMs",
      title: "耗时",
      dataIndex: "durationMs",
      width: 88,
      align: "right",
      render: (value) => `${String(value)} ms`,
    },
    {
      key: "action",
      title: "操作",
      width: 84,
      fixed: "right",
      render: (_value, item) => <Button variant="link" size="small" onClick={() => setDetail(item)}>查看详情</Button>,
    },
  ], []);
  const historyPlugins = useMemo<readonly AnyTablePlugin<QueryHistoryItem>[]>(
    () => [createResizePlugin<QueryHistoryItem>()],
    [],
  );

  return (
    <aside className="query-inspector">
      <h2>数据库日志</h2>
      <div className="history-heading">
        <h3>执行日志（持久化）</h3>
        <div>
          <span>{historyTotal}</span>
          <Button variant="link" size="small" icon={<Icon name="external-link" size={13} />} onClick={openAllHistory}>查看全部</Button>
        </div>
      </div>
      <div className="query-history">
        {history.slice(0, 20).map((item) => <HistoryCard item={item} connectionName={profile.name} key={item.id} />)}
      </div>

      <Modal
        open={allOpen}
        title={`${profile.name} · 全部执行日志`}
        width={1080}
        footer={null}
        onCancel={() => setAllOpen(false)}
      >
        <div className="history-modal-content">
          <Table<QueryHistoryItem>
            dataSource={allHistory.items}
            columns={historyColumns}
            plugins={historyPlugins}
            rowKey="id"
            size="small"
            bordered
            stickyHeader
            height={460}
            loading={historyLoading}
            emptyText="暂无执行日志"
            rowClassName="history-table-row"
            onRowClick={(item) => setDetail(item)}
          />
          <Pagination
            current={historyPage}
            pageSize={historyPageSize}
            total={allHistory.total}
            pageSizeOptions={[20, 50, 100, 200]}
            refreshing={historyLoading}
            showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`}
            onChange={(page, pageSize) => void loadPage(page, pageSize)}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        title="执行日志详情"
        width={760}
        footer={null}
        onCancel={() => setDetail(undefined)}
      >
        {detail ? (
          <div className="execution-detail">
            <dl>
              <div><dt>连接</dt><dd>{profile.name}</dd></div>
              <div><dt>数据库</dt><dd>{detail.database}</dd></div>
              <div><dt>类型</dt><dd>{detail.operation}</dd></div>
              <div><dt>开始时间</dt><dd>{formatStartedAt(detail.startedAt)}</dd></div>
              <div><dt>结束时间</dt><dd>{formatStartedAt(detail.finishedAt)}</dd></div>
              <div><dt>耗时</dt><dd>{detail.durationMs} ms</dd></div>
              <div><dt>结果</dt><dd>{executionResult(detail)}</dd></div>
              <div><dt>状态</dt><dd>{detail.success ? "成功" : "失败"}</dd></div>
              {detail.backupPath ? <div><dt>备份</dt><dd>{detail.backupRowCount ?? 0} 行 · {detail.backupPath}</dd></div> : null}
              {detail.backupError ? <div><dt>备份错误</dt><dd>{detail.backupError}</dd></div> : null}
              {detail.error ? <div><dt>错误</dt><dd>{detail.error}</dd></div> : null}
            </dl>
            <section>
              <h4>SQL</h4>
              <pre>{detail.sql}</pre>
            </section>
            {detail.parameters && Object.keys(detail.parameters).length > 0 ? (
              <section>
                <h4>参数</h4>
                <pre>{JSON.stringify(detail.parameters, null, 2)}</pre>
              </section>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </aside>
  );
}
