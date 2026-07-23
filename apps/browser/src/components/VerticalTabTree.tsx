import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { Button, Dropdown, Icon } from "@sia-ui/react";
import { ROOT_GROUP_ID, type BrowserGroup, type BrowserTab } from "../browserTypes";
import BrowserFavicon from "./BrowserFavicon";

interface VerticalTabTreeProps {
  groups: readonly BrowserGroup[];
  tabs: readonly BrowserTab[];
  activeId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onToggleAudio: (tabId: string) => void;
  onContextMenu: (tabId: string, event: MouseEvent<HTMLElement>) => void;
  onNewTab: (groupId: string, smallGroupId?: string) => void;
  onNewRootTab: () => void;
  onNewGroup: () => void;
  onNewSmallGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string) => void;
  onRenameSmallGroup: (groupId: string, smallGroupId: string) => void;
  onClearGroupData: (groupId: string, smallGroupId?: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteSmallGroup: (groupId: string, smallGroupId: string) => void;
}

export default function VerticalTabTree({
  groups,
  tabs,
  activeId,
  onSelect,
  onClose,
  onToggleAudio,
  onContextMenu,
  onNewTab,
  onNewRootTab,
  onNewGroup,
  onNewSmallGroup,
  onRenameGroup,
  onRenameSmallGroup,
  onClearGroupData,
  onDeleteGroup,
  onDeleteSmallGroup,
}: VerticalTabTreeProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedSmallGroups, setCollapsedSmallGroups] = useState<Set<string>>(new Set());
  const tabsByGroup = useMemo(() => {
    const map = new Map<string, BrowserTab[]>();
    for (const tab of tabs) {
      const groupTabs = map.get(tab.groupId) ?? [];
      groupTabs.push(tab);
      map.set(tab.groupId, groupTabs);
    }
    return map;
  }, [tabs]);
  const rootTabs = tabsByGroup.get(ROOT_GROUP_ID) ?? [];
  const activeTab = tabs.find((tab) => tab.id === activeId);

  function toggle(setter: typeof setCollapsedGroups, key: string) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderTab(tab: BrowserTab) {
    const active = tab.id === activeId;
    return (
      <div
        key={tab.id}
        className={`vertical-tree-tab${active ? " is-active" : ""}${tab.audible || tab.muted ? " has-audio" : ""}`}
        onContextMenu={(event) => onContextMenu(tab.id, event)}
      >
        <Button
          className="vertical-tree-tab__select"
          variant="text"
          size="small"
          icon={<BrowserFavicon url={tab.url} loading={tab.loading} size={15} />}
          title={tab.title}
          onClick={() => onSelect(tab.id)}
        >
          <span className="vertical-tree-tab__title">{tab.title}</span>
          {!active && tab.sleeping ? <span className="vertical-tree-tab__sleeping">休眠</span> : null}
        </Button>
        {tab.audible || tab.muted ? (
          <Button
            className="vertical-tree-tab__audio"
            variant="text"
            size="small"
            icon={<Icon name={tab.muted ? "volume-off" : "volume-up"} size={12} />}
            aria-label={tab.muted ? `取消静音 ${tab.title}` : `静音 ${tab.title}`}
            title={tab.muted ? "取消静音" : "静音"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleAudio(tab.id);
            }}
          />
        ) : null}
        <Button
          className="vertical-tree-tab__close"
          variant="text"
          size="small"
          icon={<Icon name="close" size={11} />}
          aria-label={`关闭 ${tab.title}`}
          onClick={() => onClose(tab.id)}
        />
      </div>
    );
  }

  return (
    <aside className="vertical-tab-tree" aria-label="垂直标签页">
      <div className="vertical-tab-tree__header">
        <div className="vertical-tab-tree__intro">
          <strong>标签分组</strong>
          <small>分组间 Cookie 独立</small>
        </div>
        <div className="vertical-tab-tree__actions">
          <Button
            className="vertical-tree-header-action"
            variant="text"
            size="small"
            icon={<Icon name="file-plus" size={15} />}
            aria-label="新建根级标签页"
            title="新建根级标签页"
            onClick={onNewRootTab}
          >
            新页签
          </Button>
          <Button
            className="vertical-tree-header-action"
            variant="text"
            size="small"
            icon={<Icon name="plus" size={15} />}
            aria-label="新建根分组"
            title="新建根分组"
            onClick={onNewGroup}
          >
            新分组
          </Button>
        </div>
      </div>

      <div className="vertical-tab-tree__scroll">
        {groups.map((group) => {
          const groupCollapsed = collapsedGroups.has(group.id);
          const activeGroupParent = activeTab?.groupId === group.id;
          const groupTabs = tabsByGroup.get(group.id) ?? [];
          const directTabs = groupTabs.filter((tab) => !tab.smallGroupId);
          return (
            <section
              key={group.id}
              className="vertical-tree-group"
              style={{ "--group-color": group.color } as React.CSSProperties}
            >
              <div className="vertical-tree-group__heading">
                <Button
                  className="vertical-tree-group__toggle"
                  variant="text"
                  size="small"
                  icon={<Icon name={groupCollapsed ? "chevron-right" : "chevron-down"} size={13} />}
                  aria-expanded={!groupCollapsed}
                  title={`分组：${group.name}`}
                  onClick={() => toggle(setCollapsedGroups, group.id)}
                >
                  <span className={`vertical-tree-group__name${activeGroupParent ? " is-current-ancestor" : ""}`}>
                    {group.name}
                  </span>
                </Button>
                <Button
                  className="vertical-tree-icon-button"
                  variant="text"
                  size="small"
                  icon={<Icon name="plus" size={15} />}
                  aria-label={`在分组 ${group.name} 的根节点新建标签页`}
                  title={`在“${group.name}”根节点新建标签页`}
                  onClick={() => onNewTab(group.id)}
                />
                <Dropdown
                  className="vertical-tree-context-trigger"
                  popupClassName="vertical-tree-context-popup"
                  trigger={["click"]}
                  placement="bottomRight"
                  menu={{
                    items: [
                      { key: "new-tab", label: "新建标签页" },
                      { key: "new-small-group", label: "新建小分组" },
                      { key: "rename", label: "重命名" },
                      { key: "divider-1", type: "divider" },
                      { key: "clear-data", label: "清除此组的浏览数据" },
                      { key: "divider-2", type: "divider" },
                      { key: "delete", label: "删除标签组" },
                    ],
                    onClick: ({ key }) => {
                      if (key === "new-tab") onNewTab(group.id);
                      else if (key === "new-small-group") onNewSmallGroup(group.id);
                      else if (key === "rename") onRenameGroup(group.id);
                      else if (key === "clear-data") onClearGroupData(group.id);
                      else if (key === "delete") onDeleteGroup(group.id);
                    },
                  }}
                >
                  <Button
                    className="vertical-tree-icon-button"
                    variant="text"
                    size="small"
                    icon={<Icon name="more-horizontal" size={16} />}
                    aria-label={`${group.name} 分组设置`}
                    title={`${group.name} 分组设置`}
                  />
                </Dropdown>
              </div>

              {!groupCollapsed ? (
                <div className="vertical-tree-group__content">
                  {group.smallGroups.map((smallGroup) => {
                    const smallGroupCollapsed = collapsedSmallGroups.has(smallGroup.id);
                    const activeSmallGroupParent = activeGroupParent && activeTab?.smallGroupId === smallGroup.id;
                    const smallGroupTabs = groupTabs.filter((tab) => tab.smallGroupId === smallGroup.id);
                    return (
                      <section key={smallGroup.id} className="vertical-tree-small-group">
                        <div className="vertical-tree-small-group__heading">
                          <Button
                            className="vertical-tree-small-group__toggle"
                            variant="text"
                            size="small"
                            icon={<Icon name={smallGroupCollapsed ? "chevron-right" : "chevron-down"} size={12} />}
                            aria-expanded={!smallGroupCollapsed}
                            title={`小分组：${smallGroup.name}`}
                            onClick={() => toggle(setCollapsedSmallGroups, smallGroup.id)}
                          >
                            <span className={`vertical-tree-small-group__name${activeSmallGroupParent ? " is-current-ancestor" : ""}`}>
                              {smallGroup.name}
                            </span>
                          </Button>
                          <Button
                            className="vertical-tree-icon-button"
                            variant="text"
                            size="small"
                            icon={<Icon name="plus" size={14} />}
                            aria-label={`在小分组 ${smallGroup.name} 中新建标签`}
                            onClick={() => onNewTab(group.id, smallGroup.id)}
                          />
                          <Dropdown
                            className="vertical-tree-context-trigger"
                            popupClassName="vertical-tree-context-popup"
                            trigger={["click"]}
                            placement="bottomRight"
                            menu={{
                              items: [
                                { key: "new-tab", label: "新建标签页" },
                                { key: "rename", label: "重命名" },
                                { key: "divider-1", type: "divider" },
                                { key: "clear-data", label: "清除此小分组的浏览数据" },
                                { key: "divider-2", type: "divider" },
                                { key: "delete", label: "删除小分组" },
                              ],
                              onClick: ({ key }) => {
                                if (key === "new-tab") onNewTab(group.id, smallGroup.id);
                                else if (key === "rename") onRenameSmallGroup(group.id, smallGroup.id);
                                else if (key === "clear-data") onClearGroupData(group.id, smallGroup.id);
                                else if (key === "delete") onDeleteSmallGroup(group.id, smallGroup.id);
                              },
                            }}
                          >
                            <Button
                              className="vertical-tree-icon-button"
                              variant="text"
                              size="small"
                              icon={<Icon name="more-horizontal" size={15} />}
                              aria-label={`${smallGroup.name} 小分组设置`}
                              title={`${smallGroup.name} 小分组设置`}
                            />
                          </Dropdown>
                        </div>
                        {!smallGroupCollapsed ? (
                          <div className="vertical-tree-small-group__tabs">
                            {smallGroupTabs.map(renderTab)}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                  <div className="vertical-tree-group__direct-tabs">
                    {directTabs.map(renderTab)}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
        {rootTabs.length > 0 ? (
          <div className="vertical-tab-tree__root-tabs" aria-label="根级标签页">
            {rootTabs.map(renderTab)}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
