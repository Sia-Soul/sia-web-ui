import { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Select } from "@sia.soul/sia-react-ui";
import { bookmarkFolderOptions, type BookmarkFolder, type ImportedBookmark } from "../bookmarks";

/** 本机检测到的浏览器用户配置；id 由原生接口校验，不由 UI 拼接文件路径。 */
interface BookmarkSource { id: string; browser: string; profile: string; }

/** 导入收藏及新建文件夹共用位置选择，弹窗位于原生覆盖层中。 */
export default function BookmarkImportModal({ folders, folderOnly, onClose, onSubmit }: {
  folders: BookmarkFolder[];
  folderOnly?: boolean;
  onClose: () => void;
  onSubmit: (result: { parentId?: string; folderName?: string; nodes?: ImportedBookmark[]; sourceName?: string }) => Promise<void>;
}) {
  const [sources, setSources] = useState<BookmarkSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [parentId, setParentId] = useState("");
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(!folderOnly);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scanRevision = useRef(0);

  async function scan() {
    const revision = ++scanRevision.current;
    setLoading(true); setError("");
    try {
      const result = await window.__TAURI__!.core.invoke<BookmarkSource[]>("list_bookmark_sources");
      if (revision !== scanRevision.current) return;
      setSources(result);
      setSourceId(current => result.some(source => source.id === current) ? current : result[0]?.id ?? "");
    } catch (error) { if (revision === scanRevision.current) setError(String(error)); }
    finally { if (revision === scanRevision.current) setLoading(false); }
  }
  useEffect(() => {
    if (!folderOnly) void scan();
    return () => { scanRevision.current += 1; };
  }, [folderOnly]);

  async function submit() {
    if (busy || loading || (!folderOnly && !sourceId) || (folderOnly && !folderName.trim())) return false;
    setBusy(true); setError("");
    try {
      const source = sources.find(item => item.id === sourceId);
      const nodes = folderOnly ? undefined : await window.__TAURI__!.core.invoke<ImportedBookmark[]>("read_browser_bookmarks", { sourceId });
      if (nodes?.length === 0) { setError("这个配置中没有可导入的收藏夹。"); return false; }
      await onSubmit({ parentId: parentId || undefined, folderName: folderName.trim() || undefined, nodes,
        sourceName: source ? `${source.browser} · ${source.profile}` : undefined });
      return true;
    } catch (error) { setError(String(error)); return false; }
    finally { setBusy(false); }
  }

  return <Modal open centered width={520} title={folderOnly ? "新建收藏夹文件夹" : "导入收藏夹"}
    okText={folderOnly ? "创建" : "导入"} cancelText="取消" confirmLoading={busy} maskClosable={false}
    okButtonProps={{ disabled: loading || (!folderOnly && !sourceId) || (folderOnly && !folderName.trim()) }}
    onOk={submit} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <div className="browser-bookmark-import">
      {!folderOnly && <>
        <label>来源浏览器 / 用户配置</label>
        <Select aria-label="来源浏览器" value={sourceId} options={sources.map(source => ({ value: source.id, label: `${source.browser} · ${source.profile}` }))}
          allowClear={false} popupMode="dropdown" loading={loading} disabled={busy} placeholder="请选择浏览器配置"
          onChange={value => setSourceId(typeof value === "string" ? value : "")} />
        <Button size="small" disabled={loading || busy} onClick={() => void scan()}>重新检测</Button>
        {!loading && sources.length === 0 && <Alert type="info" title="未检测到可导入的浏览器配置" description="支持标准目录中的 Edge、Chrome、Firefox、Brave、Vivaldi、Opera 等浏览器。请先在来源浏览器中保存收藏，再重新检测。" />}
      </>}
      <label>放入位置</label>
      <Select aria-label="放入位置" value={parentId} options={bookmarkFolderOptions(folders)} allowClear={false}
        popupMode="dropdown" disabled={busy} onChange={value => setParentId(typeof value === "string" ? value : "")} />
      <label>{folderOnly ? "文件夹名称" : "新建子文件夹（可选）"}</label>
      <Input aria-label="文件夹名称" value={folderName} maxLength={100} disabled={busy} placeholder={folderOnly ? "请输入文件夹名称" : "留空则直接导入所选位置"}
        onChange={event => setFolderName(event.target.value)} />
      {!folderOnly && <small>保留原有目录结构，追加到所选位置；不会覆盖现有收藏或修改来源浏览器。</small>}
      {error && <Alert type="error" title={error} />}
    </div>
  </Modal>;
}
