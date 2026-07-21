import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Icon,
  Input,
  message,
  Popconfirm,
  Segmented,
  Select,
  Spin,
  Tag,
} from "@sia-ui/react";
import ProjectFormModal from "./ProjectFormModal";
import {
  archiveProject,
  listProjects,
  saveProject,
  type ProjectPriority,
  type ProjectRecord,
  type ProjectStatus,
  type SaveProjectInput,
} from "./projectRepository";
import "./projects.css";

type ArchiveFilter = "current" | "archived" | "all";
type StatusFilter = "all" | ProjectStatus;

const STATUS_META: Record<ProjectStatus, { label: string; tag: "default" | "success" | "processing" | "warning" }> = {
  planning: { label: "规划中", tag: "default" },
  active: { label: "进行中", tag: "processing" },
  paused: { label: "已暂停", tag: "warning" },
  completed: { label: "已完成", tag: "success" },
};

const PRIORITY_META: Record<ProjectPriority, { label: string; className: string }> = {
  low: { label: "低", className: "is-low" },
  medium: { label: "中", className: "is-medium" },
  high: { label: "高", className: "is-high" },
  urgent: { label: "紧急", className: "is-urgent" },
};

const STATUS_FILTER_OPTIONS = [
  { label: "全部状态", value: "all" },
  { label: "规划中", value: "planning" },
  { label: "进行中", value: "active" },
  { label: "已暂停", value: "paused" },
  { label: "已完成", value: "completed" },
] as const;

function formatProjectDate(value: string | null) {
  if (!value) return "未设置";
  return value.replaceAll("-", ".");
}

function projectDateRange(project: ProjectRecord) {
  if (!project.startDate && !project.dueDate) return "暂未设置项目周期";
  return `${formatProjectDate(project.startDate)} — ${formatProjectDate(project.dueDate)}`;
}

function matchesQuery(project: ProjectRecord, query: string) {
  if (!query) return true;
  const target = `${project.name} ${project.code} ${project.companyName ?? ""} ${project.description}`.toLocaleLowerCase();
  return target.includes(query.toLocaleLowerCase());
}

function matchesFilters(
  project: ProjectRecord,
  archiveFilter: ArchiveFilter,
  statusFilter: StatusFilter,
  query: string,
) {
  const archiveMatches = archiveFilter === "all"
    || (archiveFilter === "archived" ? Boolean(project.archivedAt) : !project.archivedAt);
  const statusMatches = statusFilter === "all" || project.status === statusFilter;
  return archiveMatches && statusMatches && matchesQuery(project, query);
}

function isDueSoon(project: ProjectRecord) {
  if (!project.dueDate || project.archivedAt || project.status === "completed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${project.dueDate}T00:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= 7;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>("current");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  async function loadData() {
    setLoading(true);
    setLoadError("");
    try {
      const result = await listProjects(true);
      setProjects(result);
      setSelectedId((current) => current && result.some((project) => project.id === current)
        ? current
        : result.find((project) => !project.archivedAt)?.id ?? result[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listProjects(true).then((result) => {
      if (cancelled) return;
      setProjects(result);
      setSelectedId(result.find((project) => !project.archivedAt)?.id ?? result[0]?.id ?? null);
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

  const filteredProjects = useMemo(
    () => projects.filter((project) => matchesFilters(project, archiveFilter, statusFilter, deferredQuery)),
    [archiveFilter, deferredQuery, projects, statusFilter],
  );

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const statistics = useMemo(() => ({
    current: projects.filter((project) => !project.archivedAt).length,
    active: projects.filter((project) => !project.archivedAt && project.status === "active").length,
    dueSoon: projects.filter(isDueSoon).length,
    archived: projects.filter((project) => project.archivedAt).length,
  }), [projects]);

  function openCreateModal() {
    setEditingProject(null);
    setFormOpen(true);
  }

  function openEditModal(project: ProjectRecord) {
    setEditingProject(project);
    setFormOpen(true);
  }

  function changeStatusFilter(next: StatusFilter) {
    setStatusFilter(next);
    const firstVisible = projects.find((project) => matchesFilters(project, archiveFilter, next, deferredQuery));
    setSelectedId(firstVisible?.id ?? null);
  }

  function changeArchiveFilter(next: ArchiveFilter) {
    setArchiveFilter(next);
    const firstVisible = projects.find((project) => matchesFilters(project, next, statusFilter, deferredQuery));
    setSelectedId(firstVisible?.id ?? null);
  }

  async function handleSave(input: SaveProjectInput) {
    const saved = await saveProject(input);
    setProjects((current) => [saved, ...current.filter((project) => project.id !== saved.id)]);
    setSelectedId(saved.id);
    message.success(editingProject ? "项目已更新" : "项目已创建");
  }

  async function handleArchive(project: ProjectRecord) {
    try {
      const archived = !project.archivedAt;
      const updated = await archiveProject(project.id, archived);
      setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (archived && archiveFilter === "current") {
        setSelectedId((current) => current === updated.id
          ? projects.find((item) => item.id !== updated.id && !item.archivedAt)?.id ?? null
          : current);
      } else {
        setSelectedId(updated.id);
      }
      message.success(archived ? "项目已归档" : "项目已恢复");
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  return (
    <section className="projects-page" aria-label="项目管理">
      <div className="projects-page__hero">
        <div>
          <span className="projects-page__eyebrow">PROJECT WORKSPACE</span>
          <h2>把工作推进到可交付</h2>
          <p>统一管理项目范围、周期、状态和所属公司，下一阶段将在这里接入任务、BUG 与文档。</p>
        </div>
        <Button variant="primary" icon={<Icon name="plus" size={16} />} onClick={openCreateModal}>
          创建项目
        </Button>
      </div>

      <div className="project-statistics" aria-label="项目统计">
        <Card accent="primary" title="当前项目"><strong>{statistics.current}</strong><span>未归档项目</span></Card>
        <Card accent="success" title="进行中"><strong>{statistics.active}</strong><span>正在推进</span></Card>
        <Card accent="warning" title="即将到期"><strong>{statistics.dueSoon}</strong><span>未来 7 天</span></Card>
        <Card title="已归档"><strong>{statistics.archived}</strong><span>历史项目</span></Card>
      </div>

      {loadError ? (
        <Alert
          className="projects-page__alert"
          status="error"
          message="项目数据读取失败"
          description={loadError}
          showIcon
          action={<Button size="small" onClick={() => void loadData()}>重新加载</Button>}
        />
      ) : null}

      <div className="projects-page__toolbar">
        <Input
          className="projects-page__search"
          aria-label="搜索项目"
          prefix={<Icon name="search" size={15} />}
          placeholder="搜索项目名称、编号、公司或说明"
          value={query}
          allowClear
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          className="projects-page__status-filter"
          aria-label="筛选项目状态"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(value) => changeStatusFilter(value as StatusFilter)}
        />
        <Segmented
          aria-label="筛选归档状态"
          options={[
            { label: "当前", value: "current" },
            { label: "已归档", value: "archived" },
            { label: "全部", value: "all" },
          ]}
          value={archiveFilter}
          onChange={(value) => changeArchiveFilter(value as ArchiveFilter)}
        />
      </div>

      <Spin spinning={loading} tip="正在读取项目…">
        <div className="projects-page__workspace">
          <div className="project-list" aria-label="项目列表">
            <div className="project-list__heading">
              <strong>{archiveFilter === "archived" ? "已归档项目" : archiveFilter === "all" ? "全部项目" : "当前项目"}</strong>
              <span>{filteredProjects.length} 个结果</span>
            </div>

            {filteredProjects.length ? filteredProjects.map((project) => {
              const status = STATUS_META[project.status];
              const priority = PRIORITY_META[project.priority];
              return (
                <article
                  className={`project-list-item${selectedId === project.id ? " is-selected" : ""}${project.archivedAt ? " is-archived" : ""}`}
                  key={project.id}
                  onClick={() => setSelectedId(project.id)}
                >
                  <Button variant="text" className="project-list-item__main" onClick={() => setSelectedId(project.id)}>
                    <span className="project-list-item__topline">
                      <span className="project-list-item__identity">
                        <i>{project.name.slice(0, 1).toLocaleUpperCase()}</i>
                        <span><strong>{project.name}</strong><small>{project.code || "暂无编号"}</small></span>
                      </span>
                      <span className="project-list-item__tags">
                        <Tag compact status={status.tag}>{status.label}</Tag>
                        <span className={`project-priority ${priority.className}`}>{priority.label}</span>
                      </span>
                    </span>
                    <span className="project-list-item__description">{project.description || "暂未填写项目说明"}</span>
                    <span className="project-list-item__meta">
                      <span><Icon name="calendar" size={13} />{projectDateRange(project)}</span>
                      <span><Icon name="users" size={13} />{project.companyName || "个人项目"}</span>
                    </span>
                  </Button>
                  <div className="project-list-item__actions">
                    <Button size="small" variant="text" icon={<Icon name="edit" size={14} />} onClick={(event) => { event.stopPropagation(); openEditModal(project); }}>
                      编辑
                    </Button>
                    <Popconfirm
                      title={project.archivedAt ? "恢复这个项目？" : "归档这个项目？"}
                      description={project.archivedAt ? "恢复后会重新出现在当前项目中。" : "归档不会删除数据，之后可以随时恢复。"}
                      okText={project.archivedAt ? "恢复" : "归档"}
                      onConfirm={() => handleArchive(project)}
                    >
                      <Button size="small" variant="text" onClick={(event) => event.stopPropagation()}>
                        {project.archivedAt ? "恢复" : "归档"}
                      </Button>
                    </Popconfirm>
                  </div>
                </article>
              );
            }) : (
              <div className="project-empty">
                <span><Icon name="folder" size={32} /></span>
                <strong>{projects.length ? "没有符合条件的项目" : "还没有项目"}</strong>
                <p>{projects.length ? "调整搜索或筛选条件后再试试。" : "创建第一个项目，把任务、BUG 和文档组织起来。"}</p>
                {!projects.length ? <Button variant="primary" size="small" onClick={openCreateModal}>创建第一个项目</Button> : null}
              </div>
            )}
          </div>

          <aside className="project-detail" aria-label="项目详情">
            {selectedProject ? (
              <>
                <div className="project-detail__header">
                  <span className="project-detail__mark">{selectedProject.name.slice(0, 1).toLocaleUpperCase()}</span>
                  <div><small>{selectedProject.code || "PROJECT"}</small><h3>{selectedProject.name}</h3></div>
                </div>
                <div className="project-detail__tags">
                  <Tag status={STATUS_META[selectedProject.status].tag}>{STATUS_META[selectedProject.status].label}</Tag>
                  <span className={`project-priority ${PRIORITY_META[selectedProject.priority].className}`}>
                    {PRIORITY_META[selectedProject.priority].label}优先级
                  </span>
                  {selectedProject.archivedAt ? <Tag status="default">已归档</Tag> : null}
                </div>
                <p className="project-detail__description">{selectedProject.description || "暂未填写项目说明。"}</p>
                <dl className="project-detail__facts">
                  <div><dt>所属公司</dt><dd>{selectedProject.companyName || "个人项目"}</dd></div>
                  <div><dt>开始日期</dt><dd>{formatProjectDate(selectedProject.startDate)}</dd></div>
                  <div><dt>结束日期</dt><dd>{formatProjectDate(selectedProject.dueDate)}</dd></div>
                  <div><dt>最近更新</dt><dd>{selectedProject.updatedAt.slice(0, 10).replaceAll("-", ".")}</dd></div>
                </dl>
                <div className="project-detail__next">
                  <strong>项目内容</strong>
                  <div><span><Icon name="check" size={15} />任务与 BUG</span><small>下一阶段接入</small></div>
                  <div><span><Icon name="file" size={15} />项目文档</span><small>文档关联已预留</small></div>
                </div>
                <div className="project-detail__actions">
                  <Button variant="primary" icon={<Icon name="edit" size={14} />} onClick={() => openEditModal(selectedProject)}>编辑项目</Button>
                  <Popconfirm
                    title={selectedProject.archivedAt ? "恢复这个项目？" : "归档这个项目？"}
                    description="这个操作不会删除项目数据。"
                    onConfirm={() => handleArchive(selectedProject)}
                  >
                    <Button>{selectedProject.archivedAt ? "恢复项目" : "归档项目"}</Button>
                  </Popconfirm>
                </div>
              </>
            ) : (
              <div className="project-detail__empty"><Icon name="folder" size={34} /><span>选择一个项目查看详情</span></div>
            )}
          </aside>
        </div>
      </Spin>

      <ProjectFormModal
        open={formOpen}
        project={editingProject}
        onOpenChange={setFormOpen}
        onSubmit={handleSave}
      />
    </section>
  );
}
