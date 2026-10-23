import { useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Modal, Spin, Table, Tag, createResizePlugin, message, type TableColumn } from "@sia.soul/sia-react-ui";
import { isDesktopRuntime } from "./diskGateway";
import "./cleanup.css";

/** 后台生成的清理条目；仅将 id 传回后台，禁止前端自行构造删除路径。 */
interface CleanupEntry extends Record<string, unknown> {
  id: number;
  category: string;
  path: string;
  bytes: number;
  count: number;
  reason: string;
  eligible: boolean;
  status: string;
}
/** 后台返回部分扫描标志，取消和上限均向用户明确展示。 */
interface CleanupReport { entries: CleanupEntry[]; cancelled: boolean; limited: boolean; planId: number; freeSpaceDelta: number | null }
/** 轻量进度轮询不传输明细，保持大列表下界面响应。 */
interface CleanupProgress { busy: boolean; stage: string; visited: number; currentPath: string }

const CATEGORIES = [
  { key: "temp", name: "临时文件", note: "用户和 Windows 临时目录；只清理超过 7 天未修改的文件。" },
  { key: "reports", name: "崩溃转储与错误报告", note: "保留最近 7 天的报告；删除旧报告后可能不便排查历史故障。" },
  { key: "recycle", name: "回收站", note: "当前账户所有磁盘的系统汇总。清空不可恢复，不逐项枚举或选择。" },
  { key: "thumbnails", name: "缩略图缓存", note: "系统会按需重建；被资源管理器占用的缓存将自动跳过。" },
] as const;
const RESIZE_PLUGINS = [createResizePlugin<CleanupEntry>()];

/** 清理容量使用二进制单位，与文件逻辑大小一致，不冒充磁盘实际释放量。 */
function sizeText(bytes: number) {
  const power = bytes > 0 ? Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${(bytes / 1024 ** power).toFixed(2)} ${["B", "KiB", "MiB", "GiB", "TiB"][power]}`;
}

/** 浏览器预览不执行任何清理命令，避免将模拟数据当成实际清理结果。 */
async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktopRuntime) throw new Error("垃圾清理仅在 Windows 桌面程序中可用");
  return window.__TAURI__!.core.invoke<T>(command, args);
}

/** 独立清理页面：先扫描、再勾选、最后确认；任务期间禁止离开页面。 */
export function CleanupView({ onBack, onBusyChange }: { onBack: () => void; onBusyChange: (busy: boolean) => void }) {
  const [report, setReport] = useState<CleanupReport | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [resultMode, setResultMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recycleConfirmed, setRecycleConfirmed] = useState(false);
  const [progress, setProgress] = useState<CleanupProgress | null>(null);
  const entries = report?.entries ?? [];
  const chosen = entries.filter((entry) => entry.eligible && selected.has(entry.id));
  const hasRecycle = chosen.some((entry) => entry.category === "recycle");
  const selectedBytes = chosen.reduce((sum, entry) => sum + entry.bytes, 0);

  useEffect(() => {
    if (!busy) return;
    let mounted = true;
    let pending = false;
    const timer = window.setInterval(() => {
      if (pending) return;
      pending = true;
      void invoke<CleanupProgress>("cleanup_progress").then((value) => { if (mounted) setProgress(value); }).catch(() => undefined).finally(() => { pending = false; });
    }, 400);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [busy]);

  // 选择和分类汇总仅针对当前扫描快照；执行后的结果不能再次清理。
  function toggle(ids: number[], checked: boolean) {
    setSelected((previous) => { const next = new Set(previous); ids.forEach((id) => checked ? next.add(id) : next.delete(id)); return next; });
  }
  function setWorking(value: boolean) { setBusy(value); onBusyChange(value); if (value) { setProgress(null); setStopping(false); } }
  async function scan() {
    setWorking(true); setReport(null); setSelected(new Set()); setResultMode(false);
    try {
      const next = await invoke<CleanupReport>("scan_cleanup");
      setReport(next);
      setSelected(new Set(next.entries.filter((entry) => entry.category === "temp" && entry.eligible).map((entry) => entry.id)));
    } catch (error) { message.error(`扫描失败：${String(error)}`); }
    finally { setWorking(false); }
  }
  async function clean() {
    if (!chosen.length || (hasRecycle && !recycleConfirmed)) return;
    setConfirmOpen(false); setWorking(true);
    try {
      const next = await invoke<CleanupReport>("execute_cleanup", { ids: chosen.map((entry) => entry.id), confirmRecycle: recycleConfirmed, planId: report?.planId });
      setReport(next); setResultMode(true); setSelected(new Set()); setFilter(null);
    } catch (error) {
      // 执行异常时不复用旧计划，必须重新扫描后才能再次删除。
      setSelected(new Set()); setReport(null); message.error(`清理失败，请重新扫描：${String(error)}`);
    } finally { setWorking(false); }
  }
  async function stop() {
    setStopping(true);
    try { await invoke("cancel_cleanup"); }
    catch (error) { setStopping(false); message.error(`停止失败：${String(error)}`); }
  }

  const columns: TableColumn<CleanupEntry>[] = [
    { key: "choose", title: "选择", width: 66, render: (_, entry) => <Checkbox aria-label={`选择 ${entry.path}`} disabled={busy || !entry.eligible || resultMode} checked={selected.has(entry.id)} onChange={(checked) => toggle([entry.id], checked)} /> },
    { key: "path", title: "路径 / 系统项目", dataIndex: "path", width: 460, minWidth: 180, ellipsis: true },
    { key: "bytes", title: "大小", width: 110, render: (_, entry) => sizeText(entry.bytes) },
    { key: "status", title: "状态", dataIndex: "status", width: 110 },
    { key: "reason", title: "判定 / 处理原因", dataIndex: "reason", width: 450, minWidth: 200, ellipsis: true },
  ];
  const filtered = useMemo(() => report?.entries.filter((entry) => !filter || entry.category === filter) ?? [], [report, filter]);
  const cleaned = entries.filter((entry) => entry.status === "已清理");

  return <main className="cleanup-view">
    <header className="cleanup-heading">
      <div><h1>垃圾清理</h1><p>先扫描，确认后再清理。不会扫描微信资料、下载目录、浏览器资料或开发依赖缓存。</p></div>
      <Button disabled={busy} onClick={onBack}>返回空间探测</Button>
    </header>
    <div className="cleanup-actions">
      <Button variant="primary" disabled={busy || !isDesktopRuntime} onClick={() => void scan()}>{report ? "重新扫描垃圾" : "扫描垃圾"}</Button>
      <Button danger disabled={busy || !chosen.length || resultMode} onClick={() => { setRecycleConfirmed(false); setConfirmOpen(true); }}>清理所选 · {sizeText(selectedBytes)}</Button>
      {busy ? <Button danger disabled={stopping} onClick={() => void stop()}>{stopping ? "正在停止…" : "停止"}</Button> : null}
      <span>只统计文件大小；压缩、稀疏文件和磁盘其他活动会影响实际释放空间。</span>
    </div>
    {/* 扫描仅检查文件，使用“已扫描”；执行清理时才使用包含成功、失败和跳过的“已处理”。 */}
    {busy ? <div className="cleanup-progress" role="status"><Spin size="small" /><span>{stopping ? "正在等待当前系统操作结束" : progress?.stage || "准备中"} · {progress?.stage === "清理" ? "已处理" : "已扫描"} {progress?.visited ?? 0} 项</span><span title={progress?.currentPath}>{progress?.currentPath}</span></div> : null}
    {!isDesktopRuntime ? <p role="status">浏览器仅展示界面，请在 Windows 桌面程序内扫描和清理。</p> : null}
    {report?.cancelled ? <p role="status">任务已停止。{resultMode ? "已删除的内容不会撤销，未执行项见下表。" : "下方是已扫描到的部分结果。"}</p> : null}
    {report?.limited ? <p role="status">本次达到 20,000 条明细或待扫描路径上限，仅展示部分结果；清理后可重新扫描。未扫描部分不会被删除。</p> : null}
    {resultMode ? <p role="status">已清理 {cleaned.reduce((sum, entry) => sum + entry.count, 0)} 项，文件逻辑大小合计 {sizeText(cleaned.reduce((sum, entry) => sum + entry.bytes, 0))}；失败、跳过及未执行 {entries.length - cleaned.length} 条。</p> : null}
    {resultMode && report?.freeSpaceDelta != null ? <p role="status">本地磁盘可用空间实测净变化：{report.freeSpaceDelta >= 0 ? "+" : "−"}{sizeText(Math.abs(report.freeSpaceDelta))}（包含同期其他程序的磁盘活动，不作为本次清理的独占释放量）。</p> : null}
    <section className="cleanup-categories" aria-label="清理分类">
      {CATEGORIES.map((category) => {
        const items = entries.filter((entry) => entry.category === category.key);
        const eligible = items.filter((entry) => entry.eligible);
        const checkedCount = eligible.filter((entry) => selected.has(entry.id)).length;
        return <Card key={category.key} title={<Checkbox checked={eligible.length > 0 && checkedCount === eligible.length} indeterminate={checkedCount > 0 && checkedCount < eligible.length} disabled={busy || !eligible.length || resultMode} onChange={(checked) => toggle(eligible.map((entry) => entry.id), checked)}>{category.name}</Checkbox>} extra={<Tag>{items.reduce((sum, entry) => sum + entry.count, 0)} 项</Tag>}>
          <strong>{sizeText((resultMode ? items.filter((entry) => entry.status === "已清理") : eligible).reduce((sum, entry) => sum + entry.bytes, 0))}</strong><p>{category.note}</p>
          <Button size="small" variant="text" onClick={() => setFilter(filter === category.key ? null : category.key)}>{filter === category.key ? "显示全部明细" : "展开此类明细"}</Button>
        </Card>;
      })}
    </section>
    <section className="cleanup-details">
      <h2>{filter ? CATEGORIES.find((category) => category.key === filter)?.name : "全部明细"} <Tag>{filtered.length} 条</Tag></h2>
      <Table<CleanupEntry> rowKey="id" columns={columns} dataSource={filtered} plugins={RESIZE_PLUGINS} height="100%" size="small" bordered striped virtual stickyHeader emptyText={busy ? "正在处理，完成后显示明细" : "点击扫描垃圾，查看可清理项目"} />
    </section>
    <Modal open={confirmOpen} title="确认永久清理所选项目" type="warning" showCancel okText="永久清理" okButtonProps={{ danger: true, disabled: hasRecycle && !recycleConfirmed }} onCancel={() => setConfirmOpen(false)} onOk={() => void clean()}>
      <p>即将永久删除所选 {chosen.length} 条项目，共 {sizeText(selectedBytes)}。文件不会移入回收站，不能通过本程序撤销。</p>
      <p>正在使用、无权限、扫描后发生变化的文件会跳过。清理可以停止，但已完成的删除不会撤销。</p>
      {hasRecycle ? <Checkbox checked={recycleConfirmed} onChange={setRecycleConfirmed}>我确认清空当前账户所有磁盘的回收站，包括系统清空时其中的内容；不可恢复，单次系统清空操作无法中途停止。</Checkbox> : null}
    </Modal>
  </main>;
}
