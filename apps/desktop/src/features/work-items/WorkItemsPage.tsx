import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Icon,
  Input,
  message,
  Popconfirm,
  Select,
  Table,
  Tag,
} from "@sia.soul/sia-react-ui";
import type { TableColumn } from "@sia.soul/sia-react-ui";
import { listProjects, type ProjectRecord } from "../projects/projectRepository";
import WorkItemFormModal from "./WorkItemFormModal";
import {
  deleteWorkItem,
  listWorkItems,
  saveWorkItem,
  type SaveWorkItemInput,
  type WorkItemPriority,
  type WorkItemRecord,
  type WorkItemStatus,
  type WorkItemType,
} from "./workItemRepository";
import "./work-items.css";

type TypeFilter = "all" | WorkItemType;
type StatusFilter = "all" | "open" | WorkItemStatus;

const TYPE_META: Record<WorkItemType, { label: string; color?: string; status?: "processing" }> = {
  task: { label: "任务", status: "processing" },
  bug: { label: "BUG", color: "#cf1322" },
};

const STATUS_META: Record<WorkItemStatus, { label: string; tag: "default" | "processing" | "warning" | "success" | "error" }> = {
  backlog: { label: "待规划", tag: "default" },
  todo: { label: "待处理", tag: "processing" },
  in_progress: { label: "进行中", tag: "processing" },
  blocked: { label: "已阻塞", tag: "error" },
  done: { label: "已完成", tag: "success" },
  cancelled: { label: "已取消", tag: "default" },
};

const PRIORITY_META: Record<WorkItemPriority, { label: string; className: string }> = {
  low: { label: "低", className: "is-low" },
  medium: { label: "中", className: "is-medium" },
  high: { label: "高", className: "is-high" },
  urgent: { label: "紧急", className: "is-urgent" },
};

const TYPE_FILTER_OPTIONS = [
  { label: "全部类型", value: "all" },
  { label: "任务", value: "task" },
  { label: "BUG", value: "bug" },
] as const;

const STATUS_FILTER_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "全部未完成", value: "open" },
  { label: "待规划", value: "backlog" },
  { label: "待处理", value: "todo" },
  { label: "进行中", value: "in_progress" },
  { label: "已阻塞", value: "blocked" },
  { label: "已完成", value: "done" },
  { label: "已取消", value: "cancelled" },
] as const;

function isClosed(item: WorkItemRecord) {
  return item.status === "done" || item.status === "cancelled";
}

function isOverdue(item: WorkItemRecord) {
  if (!item.dueDate || isClosed(item)) return false;
  const today = new Date();
  const todayValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  return item.dueDate < todayValue;
}

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "未设置";
}

function matchesQuery(item: WorkItemRecord, query: string) {
  if (!query) return true;
  const target = `${item.title} ${item.description} ${item.projectName ?? ""}`.toLocaleLowerCase();
  return target.includes(query.toLocaleLowerCase());
}

export default function WorkItemsPage() {
  const [items, setItems] = useState<WorkItemRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [projectFilter, setProjectFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkItemRecord | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([listWorkItems(), listProjects(true)]).then(([workItems, projectItems]) => {
      if (cancelled) return;
      setItems(workItems);
      setProjects(projectItems);
      setLoadError("");
    }).catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => items.filter((item) => {
    const typeMatches = typeFilter === "all" || item.itemType === typeFilter;
    const statusMatches = statusFilter === "all"
      || (statusFilter === "open" ? !isClosed(item) : item.status === statusFilter);
    const projectMatches = projectFilter === "all" || item.projectId === projectFilter;
    return typeMatches && statusMatches && projectMatches && matchesQuery(item, deferredQuery);
  }), [deferredQuery, items, projectFilter, statusFilter, typeFilter]);

  const statistics = useMemo(() => ({
    open: items.filter((item) => !isClosed(item)).length,
    inProgress: items.filter((item) => item.status === "in_progress").length,
    blocked: items.filter((item) => item.status === "blocked").length,
    overdue: items.filter(isOverdue).length,
  }), [items]);

  function openCreateModal() {
    setEditingItem(null);
    setFormOpen(true);
  }

  function openEditModal(item: WorkItemRecord) {
    setEditingItem(item);
    setFormOpen(true);
  }

  async function handleSave(input: SaveWorkItemInput) {
    const projectName = projects.find((project) => project.id === input.projectId)?.name ?? null;
    const saved = await saveWorkItem(input, projectName);
    setItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    message.success(editingItem ? "任务已更新" : "任务已创建");
  }

  async function changeStatus(item: WorkItemRecord, status: WorkItemStatus) {
    try {
      const updated = await saveWorkItem({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
        status,
        priority: item.priority,
        projectId: item.projectId,
        dueDate: item.dueDate,
        description: item.description,
      }, item.projectName);
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      message.success(status === "done" ? "已标记为完成" : "任务已开始");
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleDelete(item: WorkItemRecord) {
    try {
      const deleted = await deleteWorkItem(item.id);
      if (!deleted) throw new Error("没有找到要删除的任务");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      message.success("任务已删除");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  const columns = useMemo<readonly TableColumn<WorkItemRecord>[]>(() => [
    {
      key: "title",
      title: "任务 / BUG",
      dataIndex: "title",
      minWidth: 260,
      ellipsis: true,
      render: (_value, item) => (
        <div className="work-item-title">
          <Tag
            color={TYPE_META[item.itemType].color}
            status={TYPE_META[item.itemType].status}
          >
            {TYPE_META[item.itemType].label}
          </Tag>
          <Button variant="link" size="small" title={item.title} onClick={() => openEditModal(item)}>
            {item.title}
          </Button>
        </div>
      ),
    },
    {
      key: "project",
      title: "关联项目",
      dataIndex: "projectName",
      width: 170,
      ellipsis: true,
      render: (_value, item) => item.projectName ?? <span className="work-item-muted">未关联</span>,
    },
    {
      key: "status",
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (_value, item) => <Tag status={STATUS_META[item.status].tag}>{STATUS_META[item.status].label}</Tag>,
    },
    {
      key: "priority",
      title: "优先级",
      dataIndex: "priority",
      width: 86,
      render: (_value, item) => (
        <span className={`work-item-priority ${PRIORITY_META[item.priority].className}`}>
          {PRIORITY_META[item.priority].label}
        </span>
      ),
    },
    {
      key: "dueDate",
      title: "截止日期",
      dataIndex: "dueDate",
      width: 116,
      render: (_value, item) => (
        <span className={isOverdue(item) ? "work-item-due is-overdue" : "work-item-due"}>
          {formatDate(item.dueDate)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      width: 224,
      fixed: "right",
      render: (_value, item) => (
        <div className="work-item-actions">
          {item.status === "todo" || item.status === "backlog" ? (
            <Button size="small" variant="link" onClick={() => void changeStatus(item, "in_progress")}>开始</Button>
          ) : null}
          {!isClosed(item) ? (
            <Button size="small" variant="link" onClick={() => void changeStatus(item, "done")}>完成</Button>
          ) : null}
          <Button size="small" variant="text" onClick={() => openEditModal(item)}>编辑</Button>
          <Popconfirm
            title="删除这条记录？"
            description="删除后无法恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(item)}
          >
            <Button size="small" variant="text" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ], [projects]);

  const projectOptions = useMemo(() => [
    { label: "全部项目", value: "all" },
    ...projects.map((project) => ({
      label: project.archivedAt ? `${project.name}（已归档）` : project.name,
      value: project.id,
    })),
  ], [projects]);

  return (
    <section className="work-items-page" aria-label="任务与 BUG 管理">
      <div className="work-items-page__hero">
        <div>
          <span className="work-items-page__eyebrow">TASK &amp; ISSUE WORKSPACE</span>
          <h2>聚焦下一件要完成的事</h2>
          <p>统一记录任务与 BUG，关联项目、优先级和截止日期，并持续推进处理状态。</p>
        </div>
        <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreateModal}>
          新建任务 / BUG
        </Button>
      </div>

      <div className="work-item-statistics" aria-label="任务统计">
        <Card accent="primary" title="未完成"><strong>{statistics.open}</strong><span>仍需处理</span></Card>
        <Card accent="success" title="进行中"><strong>{statistics.inProgress}</strong><span>正在推进</span></Card>
        <Card accent="warning" title="已阻塞"><strong>{statistics.blocked}</strong><span>需要关注</span></Card>
        <Card accent="error" title="已逾期"><strong>{statistics.overdue}</strong><span>超过截止日期</span></Card>
      </div>

      <Card className="work-items-board">
        <div className="work-items-toolbar">
          <Input
            className="work-items-search"
            prefix={<Icon name="search" size={16} />}
            value={query}
            allowClear
            placeholder="搜索标题、说明或项目"
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            aria-label="按类型筛选"
            className="work-items-filter"
            options={TYPE_FILTER_OPTIONS}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as TypeFilter)}
          />
          <Select
            aria-label="按状态筛选"
            className="work-items-filter"
            options={STATUS_FILTER_OPTIONS}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
          />
          <Select
            aria-label="按项目筛选"
            className="work-items-project-filter"
            options={projectOptions}
            value={projectFilter}
            onChange={(value) => setProjectFilter(String(value))}
          />
        </div>

        {loadError ? <Alert status="error" message="无法读取任务数据" description={loadError} showIcon /> : null}

        <Table
          className="work-items-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          stickyHeader
          emptyText={items.length ? "没有符合当前筛选条件的记录" : "还没有任务或 BUG，点击右上角开始创建"}
          onRowDoubleClick={openEditModal}
        />
      </Card>

      <WorkItemFormModal
        open={formOpen}
        item={editingItem}
        projects={projects}
        onSubmit={handleSave}
        onOpenChange={setFormOpen}
      />
    </section>
  );
}
