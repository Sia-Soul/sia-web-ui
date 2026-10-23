import { useState } from "react";
import { Alert, Button, Checkbox, Modal } from "@sia.soul/sia-react-ui";
import type { BrowserGroup } from "../browserTypes";
import type { ExtensionScope } from "../extensionScopes";
import type { BrowserExtensionRecord } from "./BrowserSettingsPage";

/** 使用框架复选框编辑父子范围；由父组件在成功保存后卸载，失败时保留草稿。 */
export default function ExtensionScopeEditor({ extension, groups, onSave, onClose }: {
  /** 当前扩展及已保存的范围。 */
  extension: BrowserExtensionRecord;
  /** 可选父子分组，包含未分组标签的独立入口。 */
  groups: readonly BrowserGroup[];
  /** 保存失败时抛出错误，弹窗保留当前选择并显示原因。 */
  onSave: (scopes: ExtensionScope[] | null) => Promise<void>;
  /** 取消编辑，不写入配置。 */
  onClose: () => void;
}) {
  const [all, setAll] = useState(extension.scopes == null);
  const [selected, setSelected] = useState<ExtensionScope[]>(extension.scopes ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /** 父分组选择覆盖子分组，保存时删除冗余子项以保持授权含义明确。 */
  function toggle(scope: ExtensionScope, checked: boolean) {
    setSelected((current) => {
      const remaining = current.filter((item) => !(item.groupId === scope.groupId
        && (scope.smallGroupId == null || item.smallGroupId === scope.smallGroupId)));
      return checked ? [...remaining, scope] : remaining;
    });
  }

  return <Modal open title={`生效分组 · ${extension.name}`} width={440} okText="保存" confirmLoading={busy}
    onCancel={() => { if (!busy) onClose(); }}
    onOk={async () => {
      setBusy(true); setError("");
      try { await onSave(all ? null : selected); onClose(); }
      catch (reason) { setError(String(reason)); return false; }
      finally { setBusy(false); }
    }}>
    <div className="browser-extension-scopes">
      <p>选择父分组后，其现有和以后新增的子分组都会生效；也可以只选择子分组。</p>
      {error ? <Alert type="error" message={error} /> : null}
      <Checkbox checked={all} disabled={busy} onChange={setAll}>所有分组</Checkbox>
      {/* 清空也移除已删除分组的历史 ID，避免不可见选择无法取消。 */}
      <Button size="small" disabled={busy} onClick={() => { setAll(false); setSelected([]); }}>清空选择</Button>
      <div className="browser-extension-scopes__groups">
        {groups.map((group) => {
          const parent = selected.some((scope) => scope.groupId === group.id && scope.smallGroupId == null);
          return <div key={group.id}>
            <Checkbox checked={all || parent} disabled={all || busy}
              indeterminate={!all && !parent && selected.some((scope) => scope.groupId === group.id)}
              onChange={(checked) => toggle({ groupId: group.id }, checked)}>{group.name}</Checkbox>
            {group.smallGroups.map((small) => <div className="browser-extension-scopes__child" key={small.id}>
              <Checkbox checked={all || parent || selected.some((scope) => scope.groupId === group.id && scope.smallGroupId === small.id)}
                disabled={all || parent || busy}
                onChange={(checked) => toggle({ groupId: group.id, smallGroupId: small.id }, checked)}>{small.name}</Checkbox>
            </div>)}
          </div>;
        })}
      </div>
      {!all && !selected.length ? <small>未选择分组：此扩展将保留安装，但不在任何分组运行。</small> : null}
    </div>
  </Modal>;
}
