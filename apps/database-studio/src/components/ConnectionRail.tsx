import { Button, Dropdown, Icon, Input, Tag, Tree, type MenuItem, type TreeKey, type TreeNode } from "@sia.soul/sia-react-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ConnectionProfile, DatabaseKind, DatabaseObjectCategory, DatabaseUser, DatabaseUserSnapshot, SchemaSnapshot } from "../types";

export type ConnectionMenuAction = "open" | "edit" | "delete" | "duplicate" | "new-query" | "command-line" | "run-sql-file" | "refresh" | `new-${DatabaseKind}`;
export type DatabaseMenuAction = "database-open" | "database-edit" | "database-create" | "database-delete" | "database-new-query" | "database-run-sql-file" | "database-refresh";
export type TableMenuAction =
  | "table-open" | "table-design" | "table-create" | "table-delete" | "table-clear" | "table-truncate"
  | "table-copy-structure" | "table-copy-data" | "table-permissions" | "table-import" | "table-export"
  | "table-dump-structure" | "table-dump-data" | "table-print" | "table-reverse-model"
  | "table-group-add" | "table-group-create" | "table-copy-name" | "table-rename"
  | "table-create-shortcut" | "table-refresh" | "table-info";
export type UserMenuAction = "user-new" | "user-edit" | "user-delete";

export interface TableMenuTarget {
  profileId: string;
  databaseName: string;
  tableName: string;
  schemaName?: string;
}

export interface UserMenuTarget {
  profileId: string;
  user?: DatabaseUser;
}

interface ConnectionRailProps {
  profiles: readonly ConnectionProfile[];
  schemas: Readonly<Record<string, SchemaSnapshot>>;
  users: Readonly<Record<string, DatabaseUserSnapshot>>;
  activeId: string;
  loadingId?: string;
  databaseLoadingKeys?: ReadonlySet<string>;
  connectingId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
  onConnect: (profile: ConnectionProfile) => Promise<boolean>;
  onLoadConnection: (profileId: string) => Promise<void>;
  onLoadDatabases: (profileId: string) => Promise<void>;
  onLoadDatabase: (profileId: string, databaseName: string) => Promise<void>;
  onLoadDatabaseCategory: (profileId: string, databaseName: string, category: DatabaseObjectCategory) => Promise<void>;
  onLoadDatabaseObject: (profileId: string, databaseName: string, tableName: string, schemaName?: string) => Promise<void>;
  onLoadUsers: (profileId: string, force?: boolean) => Promise<void>;
  onMenuAction: (action: ConnectionMenuAction, profile: ConnectionProfile) => void;
  onDatabaseMenuAction: (action: DatabaseMenuAction, profileId: string, databaseName: string) => void;
  onTableMenuAction: (action: TableMenuAction, target: TableMenuTarget) => void;
  onUserMenuAction: (action: UserMenuAction, target: UserMenuTarget) => void;
}

function connectionKey(id: string) {
  return `connection:${id}`;
}

const FAVORITES_STORAGE_KEY = "sia-data-studio:object-favorites:v1";

function databaseFavoriteKey(profileId: string, databaseName: string) {
  return `database:${profileId}:${databaseName}`;
}

function tableFavoriteKey(profileId: string, databaseName: string, tableName: string, schemaName?: string) {
  return `table:${profileId}:${databaseName}:${schemaName ?? ""}:${tableName}`;
}

function loadFavoriteKeys() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function FavoriteButton({
  favorite,
  label,
  onClick,
}: {
  favorite: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      className={`tree-favorite-button${favorite ? " is-favorite" : ""}`}
      variant="text"
      size="small"
      icon={<Icon name="star" variant={favorite ? "filled" : "outline"} size={14} />}
      aria-label={`${favorite ? "取消收藏" : "收藏"}${label}`}
      title={`${favorite ? "取消收藏" : "收藏"}${label}`}
      onClick={onClick}
    />
  );
}

const KIND_COLORS: Record<DatabaseKind, string> = {
  postgres: "#3366ff",
  mysql: "#f59e0b",
  sqlserver: "#0ea5e9",
  sqlite: "#8b5cf6",
};

function prefixObjectNodes(
  nodes: readonly TreeNode[],
  profileId: string,
  databaseName: string,
  favoriteKeys: ReadonlySet<string>,
  onToggleFavorite: (key: string) => void,
  depth = 0,
): TreeNode[] {
  return nodes.map((node) => {
    const nodeType = typeof node.nodeType === "string" ? node.nodeType : "";
    const categoryTitle = String(node.title);
    const iconName = nodeType === "function" ? "code"
      : nodeType === "procedure" ? "settings"
        : nodeType === "view" || categoryTitle.startsWith("视图") ? "eye"
          : nodeType === "table" || categoryTitle.startsWith("表") ? "table"
            : node.isLeaf ? "file" : "database";
    const tableName = typeof node.tableName === "string" ? node.tableName : "";
    const schemaName = typeof node.schemaName === "string" ? node.schemaName : undefined;
    const favoriteKey = nodeType === "table"
      ? tableFavoriteKey(profileId, databaseName, tableName, schemaName)
      : "";
    const favorite = Boolean(favoriteKey && favoriteKeys.has(favoriteKey));
    return {
      ...node,
      key: `object:${profileId}:${databaseName}:${node.key}`,
      profileId,
      databaseName,
      selectable: false,
      icon: <Icon
        name={iconName}
        size={15}
        style={{ color: node.isLeaf ? "var(--sia-color-text-secondary)" : depth === 0 ? "#0f9f8f" : "#4f7cff" }}
      />,
      prefix: nodeType === "table" ? (
        <FavoriteButton
          favorite={favorite}
          label={`表 ${tableName}`}
          onClick={() => onToggleFavorite(favoriteKey)}
        />
      ) : undefined,
      favoriteKey,
      rowProps: nodeType === "table" ? {
        "data-node-context": "table",
        "data-profile-id": profileId,
        "data-database-name": databaseName,
        "data-table-name": tableName,
        "data-schema-name": schemaName,
      } : undefined,
      children: node.children
        ? prefixObjectNodes(node.children, profileId, databaseName, favoriteKeys, onToggleFavorite, depth + 1)
        : undefined,
    };
  }).sort((first, second) => Number(Boolean(second.favoriteKey && favoriteKeys.has(String(second.favoriteKey))))
    - Number(Boolean(first.favoriteKey && favoriteKeys.has(String(first.favoriteKey)))));
}

function filterObjectNodes(nodes: readonly TreeNode[], query: string): TreeNode[] {
  return nodes.flatMap((node) => {
    const children = node.children ? filterObjectNodes(node.children, query) : [];
    if (String(node.searchText ?? node.title).toLowerCase().includes(query)) return [{ ...node }];
    return children.length ? [{ ...node, children }] : [];
  });
}

function collectBranchKeys(nodes: readonly TreeNode[]): TreeKey[] {
  return nodes.flatMap((node) => node.children?.length ? [node.key, ...collectBranchKeys(node.children)] : []);
}

function placeholderNode(key: string, title = "暂无可见对象"): TreeNode {
  return {
    key,
    title,
    selectable: false,
    isLeaf: true,
    icon: <Icon name="minus" size={13} style={{ color: "var(--sia-color-text-tertiary)" }} />,
  };
}

type TreeContext =
  | { type: "connection"; profileId: string }
  | { type: "database"; profileId: string; databaseName: string }
  | { type: "users"; profileId: string }
  | { type: "user"; profileId: string; userName: string; userHost?: string }
  | ({ type: "table" } & TableMenuTarget);

export function ConnectionRail({
  profiles,
  schemas,
  users,
  activeId,
  loadingId,
  databaseLoadingKeys = new Set(),
  connectingId,
  onSelect,
  onNew,
  onRefresh,
  onConnect,
  onLoadConnection,
  onLoadDatabases,
  onLoadDatabase,
  onLoadDatabaseCategory,
  onLoadDatabaseObject,
  onLoadUsers,
  onMenuAction,
  onDatabaseMenuAction,
  onTableMenuAction,
  onUserMenuAction,
}: ConnectionRailProps) {
  const [query, setQuery] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<TreeKey[]>([]);
  const [treeContext, setTreeContext] = useState<TreeContext>({ type: "connection", profileId: activeId });
  const [favoriteKeys, setFavoriteKeys] = useState<Set<string>>(loadFavoriteKeys);
  const pendingConnectionIds = useRef(new Set<string>());

  useEffect(() => {
    const disconnectedKeys = new Set<TreeKey>(
      profiles.filter((profile) => !profile.connected).map((profile) => connectionKey(profile.id)),
    );
    setExpandedKeys((current) => {
      const next = current.filter((key) => !disconnectedKeys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [profiles]);

  const toggleFavorite = useCallback((key: string) => {
    setFavoriteKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const contextProfile = profiles.find((profile) => profile.id === treeContext.profileId) ?? profiles.find((profile) => profile.id === activeId) ?? profiles[0];
  const contextUser = treeContext.type === "user"
    ? users[treeContext.profileId]?.users.find((user) =>
      user.name === treeContext.userName && (user.host ?? "") === (treeContext.userHost ?? ""))
    : undefined;
  const contextMenuItems = useMemo<MenuItem[]>(() => {
    // MCP 数据库连接按只读模式展示，写入类菜单保留但不可触发。
    const mcpReadOnly = contextProfile?.connectionMode === "mcp";
    if (treeContext.type === "users") {
      return [
        {
          key: "user-new",
          label: "新建",
          icon: <Icon name="plus" size={15} />,
          disabled: contextProfile?.kind === "sqlite" || mcpReadOnly,
        },
      ];
    }

    if (treeContext.type === "user") {
      return [
        { key: "user-edit", label: "编辑", icon: <Icon name="edit" size={15} />, disabled: mcpReadOnly },
        { key: "user-delete", label: "删除", icon: <Icon name="trash" size={15} />, danger: true, disabled: mcpReadOnly },
      ];
    }

    if (treeContext.type === "database") {
      return [
        { key: "database-open", label: "打开数据库", icon: <Icon name="database" size={15} /> },
        { key: "database-edit", label: "编辑数据库…", icon: <Icon name="edit" size={15} /> },
        { key: "database-create", label: "新建数据库…", icon: <Icon name="plus" size={15} />, disabled: mcpReadOnly },
        { key: "database-delete", label: "删除数据库", icon: <Icon name="trash" size={15} />, danger: true, disabled: mcpReadOnly },
        { key: "database-divider-1", type: "divider" },
        { key: "database-new-query", label: "新建查询", icon: <Icon name="code" size={15} /> },
        { key: "database-run-sql-file", label: "运行 SQL 文件…", icon: <Icon name="file" size={15} />, disabled: true },
        { key: "database-divider-2", type: "divider" },
        { key: "database-refresh", label: "刷新", icon: <Icon name="refresh" size={15} /> },
      ];
    }

    if (treeContext.type === "table") {
      return [
        { key: "table-open", label: "打开表", icon: <Icon name="table" size={15} /> },
        { key: "table-design", label: "设计表", icon: <Icon name="edit" size={15} />, disabled: mcpReadOnly },
        { key: "table-create", label: "新建表", icon: <Icon name="plus" size={15} />, disabled: mcpReadOnly },
        { key: "table-delete", label: "删除表", icon: <Icon name="trash" size={15} />, danger: true, disabled: mcpReadOnly },
        { key: "table-clear", label: "清空表", danger: true, disabled: mcpReadOnly },
        { key: "table-truncate", label: "截断表", danger: true, disabled: mcpReadOnly },
        {
          key: "table-copy",
          label: "复制表",
          children: [
            { key: "table-copy-structure", label: "仅复制结构", disabled: mcpReadOnly },
            { key: "table-copy-data", label: "复制结构和数据", disabled: mcpReadOnly },
          ],
        },
        { key: "table-permissions", label: "设置权限", disabled: mcpReadOnly },
        { key: "table-divider-1", type: "divider" },
        { key: "table-import", label: "导入向导…", disabled: mcpReadOnly },
        { key: "table-export", label: "导出向导…" },
        { key: "table-divider-2", type: "divider" },
        {
          key: "table-dump",
          label: "转储 SQL 文件",
          children: [
            { key: "table-dump-structure", label: "仅结构…" },
            { key: "table-dump-data", label: "结构和数据…" },
          ],
        },
        { key: "table-print", label: "打印表" },
        { key: "table-reverse-model", label: "逆向表到模型…" },
        { key: "table-divider-3", type: "divider" },
        {
          key: "table-group",
          label: "管理组",
          children: [
            { key: "table-group-add", label: "添加到组…" },
            { key: "table-group-create", label: "新建组…" },
          ],
        },
        { key: "table-copy-name", label: "复制", icon: <Icon name="copy" size={15} /> },
        { key: "table-rename", label: "重命名", disabled: mcpReadOnly },
        { key: "table-create-shortcut", label: "创建打开表快捷方式…" },
        { key: "table-divider-4", type: "divider" },
        { key: "table-refresh", label: "刷新", icon: <Icon name="refresh" size={15} /> },
        { key: "table-info", label: "对象信息", icon: <Icon name="info" size={15} /> },
      ];
    }

    return [
      {
        key: "open",
        label: contextProfile?.connected ? "打开连接" : connectingId === contextProfile?.id ? "正在连接…" : "连接",
        icon: connectingId === contextProfile?.id ? <Icon name="loader" size={15} spin /> : <Icon name="link" size={15} />,
        disabled: connectingId === contextProfile?.id,
      },
      { key: "edit", label: "编辑连接…", icon: <Icon name="edit" size={15} /> },
      {
        key: "new-connection",
        label: "新建连接",
        icon: <Icon name="plus" size={15} />,
        children: [
          { key: "new-postgres", label: "PostgreSQL" },
          { key: "new-mysql", label: "MySQL / MariaDB" },
          { key: "new-sqlserver", label: "SQL Server" },
          { key: "new-sqlite", label: "SQLite" },
        ],
      },
      { key: "delete", label: "删除连接", icon: <Icon name="trash" size={15} />, danger: true, disabled: profiles.length <= 1 },
      { key: "duplicate", label: "复制连接…", icon: <Icon name="copy" size={15} /> },
      { key: "connection-divider-1", type: "divider" },
      { key: "new-query", label: "新建查询", icon: <Icon name="code" size={15} /> },
      { key: "command-line", label: "命令行界面…", icon: <Icon name="code" size={15} /> },
      { key: "run-sql-file", label: "运行 SQL 文件…", icon: <Icon name="file" size={15} />, disabled: true },
      { key: "connection-divider-2", type: "divider" },
      { key: "refresh", label: "刷新", icon: <Icon name="refresh" size={15} /> },
    ];
  }, [connectingId, contextProfile?.connected, contextProfile?.connectionMode, contextProfile?.id, contextProfile?.kind, profiles.length, treeContext.type]);

  const nodes = useMemo<TreeNode[]>(() => {
    const normalized = query.trim().toLowerCase();
    return profiles.flatMap((profile) => {
      const schema = schemas[profile.id];
      const userSnapshot = users[profile.id];
      const connectionMatches = profile.name.toLowerCase().includes(normalized);
      const databaseListLoaded = Boolean(schema?.databasesLoaded);
      const databaseNodes: TreeNode[] = (schema?.databases ?? []).map((database) => {
        const favoriteKey = databaseFavoriteKey(profile.id, database.name);
        const favorite = favoriteKeys.has(favoriteKey);
        const objectNodes = prefixObjectNodes(database.nodes, profile.id, database.name, favoriteKeys, toggleFavorite);
        const children = database.loaded
          ? database.error
            ? [placeholderNode(`database-error:${profile.id}:${database.name}`, `加载失败：${database.error}`)]
            : objectNodes.length ? objectNodes : [placeholderNode(`database-empty:${profile.id}:${database.name}`)]
          : undefined;
        return {
          key: `database:${profile.id}:${database.name}`,
          title: (
            <span className="connection-database-title">
              <span>{database.name}</span>
              {database.name === schema?.database ? <Tag status="processing">默认</Tag> : null}
            </span>
          ),
          prefix: (
            <FavoriteButton
              favorite={favorite}
              label={`数据库 ${database.name}`}
              onClick={() => toggleFavorite(favoriteKey)}
            />
          ),
          favoriteKey,
          selectable: false,
          isLeaf: false,
          loaded: database.loaded,
          icon: <Icon name="database" size={16} style={{ color: "#0f9f8f" }} />,
          profileId: profile.id,
          databaseName: database.name,
          nodeType: "database",
          loadingText: "正在加载数据库对象…",
          searchText: database.name,
          rowProps: {
            "data-node-context": "database",
            "data-profile-id": profile.id,
            "data-database-name": database.name,
          },
          children,
        } satisfies TreeNode;
      }).sort((first, second) => Number(favoriteKeys.has(String(second.favoriteKey)))
        - Number(favoriteKeys.has(String(first.favoriteKey))));
      const userNodes: TreeNode[] | undefined = userSnapshot?.loading
        ? [placeholderNode(`users-loading:${profile.id}`, "正在加载用户…")]
        : userSnapshot?.error
          ? [placeholderNode(`users-error:${profile.id}`, `加载失败：${userSnapshot.error}`)]
          : userSnapshot?.loaded
            ? userSnapshot.users.length
              ? userSnapshot.users.map((user) => ({
                key: `user:${profile.id}:${encodeURIComponent(user.name)}:${encodeURIComponent(user.host ?? "")}`,
                title: user.host ? `${user.name}@${user.host}` : user.name,
                selectable: false,
                isLeaf: true,
                icon: <Icon name="user" size={16} style={{ color: "#0f9f8f" }} />,
                extra: (
                  <span className="connection-user-tags">
                    {user.type ? <Tag>{user.type}</Tag> : null}
                    {user.status ? <Tag status={user.status === "正常" ? "success" : "warning"}>{user.status}</Tag> : null}
                  </span>
                ),
                profileId: profile.id,
                nodeType: "user",
                userName: user.name,
                userHost: user.host,
                searchText: `${user.name} ${user.host ?? ""} ${user.type ?? ""} ${user.status ?? ""}`,
                rowProps: {
                  "data-node-context": "user",
                  "data-profile-id": profile.id,
                  "data-user-name": user.name,
                  ...(user.host ? { "data-user-host": user.host } : {}),
                },
              } satisfies TreeNode))
              : [placeholderNode(`users-empty:${profile.id}`, profile.kind === "sqlite" ? "SQLite 不支持数据库用户" : "暂无可见用户")]
            : undefined;
      const sourceNodes: TreeNode[] = schema ? [
        {
          key: `databases:${profile.id}`,
          title: `数据库 (${schema.databaseCount ?? schema.databases.length})`,
          selectable: false,
          isLeaf: false,
          loaded: databaseListLoaded,
          icon: <Icon name="database" size={17} style={{ color: "#0f9f8f" }} />,
          profileId: profile.id,
          nodeType: "databases",
          loadingText: "正在加载数据库列表…",
          children: databaseListLoaded
            ? databaseNodes.length ? databaseNodes : [placeholderNode(`databases-empty:${profile.id}`)]
            : undefined,
        },
        {
          key: `users:${profile.id}`,
          title: `用户 (${userSnapshot?.count ?? userSnapshot?.users.length ?? 0})`,
          selectable: false,
          isLeaf: false,
          loaded: Boolean(userSnapshot?.loaded),
          icon: <Icon name="users" size={17} style={{ color: "#0f9f8f" }} />,
          profileId: profile.id,
          nodeType: "users",
          loadingText: "正在加载用户…",
          rowProps: {
            "data-node-context": "users",
            "data-profile-id": profile.id,
          },
          children: userNodes,
        },
      ] : [];
      const objectNodes = normalized && !connectionMatches ? filterObjectNodes(sourceNodes, normalized) : sourceNodes;
      if (normalized && !connectionMatches && !objectNodes.length) return [];
      const children: TreeNode[] = connectingId === profile.id
        ? [{ key: `state:${profile.id}`, title: "正在连接…", selectable: false, isLeaf: true, icon: <Icon name="loader" size={14} spin /> }]
        : profile.connected
        ? objectNodes.length ? objectNodes : [{ key: `state:${profile.id}`, title: loadingId === profile.id ? "正在加载对象…" : "暂无数据库对象", selectable: false, isLeaf: true }]
        : [{ key: `state:${profile.id}`, title: "未连接", selectable: false, isLeaf: true }];
      return {
        key: connectionKey(profile.id),
        title: (
          <span className="connection-tree-title">
            <span>{profile.name}</span>
            {profile.connectionMode === "mcp" ? <Tag status="processing">MCP</Tag> : null}
            {connectingId === profile.id
              ? <Icon name="loader" size={14} spin label="正在连接" />
              : <i className={`connection-dot${profile.connected ? " is-online" : ""}`} title={profile.connected ? "已连接" : "未连接"} />}
          </span>
        ),
        icon: <Icon name={profile.kind === "sqlite" ? "file" : "database"} size={16} style={{ color: KIND_COLORS[profile.kind] }} />,
        loaded: Boolean(schema && userSnapshot),
        profileId: profile.id,
        rowProps: {
          "data-node-context": "connection",
          "data-profile-id": profile.id,
          className: "connection-tree-row",
        },
        children,
      } satisfies TreeNode;
    });
  }, [connectingId, favoriteKeys, loadingId, profiles, query, schemas, toggleFavorite, users]);

  async function handleExpand(
    nextKeys: TreeKey[],
    info: { expanded: boolean; node: TreeNode },
  ) {
    if (!info.expanded) {
      setExpandedKeys(nextKeys);
      return;
    }
    const profileId = typeof info.node.profileId === "string" ? info.node.profileId : "";
    const isConnectionNode = info.node.key === connectionKey(profileId);
    if (!isConnectionNode) {
      setExpandedKeys(nextKeys);
      return;
    }
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile || profile.connected) {
      setExpandedKeys(nextKeys);
      return;
    }
    if (pendingConnectionIds.current.has(profileId)) return;
    pendingConnectionIds.current.add(profileId);
    onSelect(profileId);
    try {
      const connected = await onConnect(profile);
      if (connected) {
        setExpandedKeys((current) => current.includes(info.node.key)
          ? current
          : [...current, info.node.key]);
      } else {
        setExpandedKeys((current) => current.filter((key) => key !== info.node.key));
      }
    } finally {
      pendingConnectionIds.current.delete(profileId);
    }
  }

  return (
    <aside className="connection-rail">
      <div className="rail-heading">
        <h2>连接与对象</h2>
        <div className="rail-heading__actions">
          <Button variant="text" size="small" loading={loadingId === activeId} icon={<Icon name="refresh" size={15} />} aria-label="刷新当前连接对象" onClick={onRefresh} />
          <Button variant="text" size="small" icon={<Icon name="plus" size={16} />} aria-label="新建连接" onClick={onNew} />
        </div>
      </div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} allowClear prefix={<Icon name="search" size={15} />} placeholder="搜索连接或对象" />
      <Dropdown
        className="connection-context-trigger"
        trigger={["contextMenu"]}
        popupClassName="connection-context-menu"
        menu={{
          items: contextMenuItems,
          selectable: false,
          onClick: ({ key }) => {
            if (treeContext.type === "users") {
              onUserMenuAction(key as UserMenuAction, { profileId: treeContext.profileId });
            } else if (treeContext.type === "user" && contextUser) {
              onUserMenuAction(key as UserMenuAction, { profileId: treeContext.profileId, user: contextUser });
            } else if (treeContext.type === "database") {
              onDatabaseMenuAction(key as DatabaseMenuAction, treeContext.profileId, treeContext.databaseName);
            } else if (treeContext.type === "table") {
              onTableMenuAction(key as TableMenuAction, treeContext);
            } else if (contextProfile) {
              onMenuAction(key as ConnectionMenuAction, contextProfile);
            }
          },
        }}
        onContextMenu={(event) => {
          const row = (event.target as HTMLElement).closest<HTMLElement>("[data-node-context]");
          const type = row?.dataset.nodeContext;
          const profileId = row?.dataset.profileId;
          if (!row || !profileId || !type) {
            event.preventDefault();
            return;
          }
          if (type === "database" && row.dataset.databaseName) {
            setTreeContext({ type, profileId, databaseName: row.dataset.databaseName });
          } else if (type === "users") {
            setTreeContext({ type, profileId });
          } else if (type === "user" && row.dataset.userName) {
            setTreeContext({
              type,
              profileId,
              userName: row.dataset.userName,
              userHost: row.dataset.userHost,
            });
          } else if (type === "table" && row.dataset.databaseName && row.dataset.tableName) {
            setTreeContext({
              type,
              profileId,
              databaseName: row.dataset.databaseName,
              tableName: row.dataset.tableName,
              schemaName: row.dataset.schemaName,
            });
          } else {
            setTreeContext({ type: "connection", profileId });
          }
          onSelect(profileId);
        }}
      >
        {/* Tree 自身作为滚动视口，节点数量很大时可自动计算并启用虚拟滚动。 */}
        <Tree
          className="connection-tree-scroll"
          treeData={nodes}
          selectedKeys={[connectionKey(activeId)]}
          expandedKeys={query.trim() ? collectBranchKeys(nodes) : expandedKeys}
          loadingKeys={[...databaseLoadingKeys]}
          onExpand={(keys, info) => {
            void handleExpand(keys, info);
          }}
          loadData={(node) => {
            const profileId = typeof node.profileId === "string" ? node.profileId : "";
            const databaseName = typeof node.databaseName === "string" ? node.databaseName : "";
            if (node.key === connectionKey(profileId) && profileId) return onLoadConnection(profileId);
            if (node.nodeType === "databases" && profileId) return onLoadDatabases(profileId);
            if (node.nodeType === "users" && profileId) return onLoadUsers(profileId);
            if (node.nodeType === "database" && profileId && databaseName) {
              return onLoadDatabase(profileId, databaseName);
            }
            if (node.nodeType === "category" && profileId && databaseName && typeof node.category === "string") {
              return onLoadDatabaseCategory(profileId, databaseName, node.category as DatabaseObjectCategory);
            }
            if ((node.nodeType === "table" || node.nodeType === "view")
              && profileId
              && databaseName
              && typeof node.tableName === "string") {
              return onLoadDatabaseObject(
                profileId,
                databaseName,
                node.tableName,
                typeof node.schemaName === "string" ? node.schemaName : undefined,
              );
            }
            return Promise.resolve();
          }}
          onSelect={(_keys, info) => {
            const profileId = info.node.profileId;
            if (typeof profileId === "string") onSelect(profileId);
          }}
          showIcon
          showLine
          blockNode
          indentSize={12}
          switcherWidth={18}
          stickyAncestors
          stickyRowHeight={30}
        />
      </Dropdown>
    </aside>
  );
}
