export type DocumentStorageBackend = "sqlite" | "localStorage";

export interface WorkbenchDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  status: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditableDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  status: string;
  projectId: string | null;
}

export interface LoadedDocument {
  document: WorkbenchDocument;
  storageBackend: DocumentStorageBackend;
}

interface LegacyDraft {
  version: 1;
  title: string;
  content: string;
}

const LEGACY_DRAFT_KEY = "sia-workbench.document-draft.v1";

export const DEFAULT_DOCUMENT: EditableDocument = {
  id: "workspace-product-requirements",
  title: "工作台产品需求文档",
  documentType: "prd",
  status: "draft",
  projectId: null,
  content: `# 工作台产品需求文档

> 这是一份保存在当前客户端中的 Markdown 草稿。

## 产品目标

把日程、公司、项目、任务 / BUG、待办、日常记录和产品资料集中到同一个工作台中，减少在不同工具之间切换的成本。

## 第一阶段范围

- [x] 搭建 Tauri 客户端外壳
- [x] 复用 Sia WebUI 组件
- [x] 建立本地 SQLite 数据层
- [x] 完成项目与任务模块
- [ ] 接入统一搜索

## 文档能力

编辑器使用 Markdown 作为可迁移的源格式，同时提供接近 IDE 的编辑体验：

1. 实时预览与大纲导航
2. 表格、任务清单和代码块
3. 自动保存 SQLite 草稿
4. 后续支持附件、版本记录和文档关联

### 数据结构示例

\`\`\`json
{
  "type": "prd",
  "status": "draft",
  "relatedProject": "Sia Workbench"
}
\`\`\`

## 后续计划

下一步建立文档列表、项目、需求和任务之间的关联关系。
`,
};

function isDesktopRuntime() {
  return Boolean(window.__TAURI__?.core.invoke);
}

function readLegacyDraft(): LegacyDraft | null {
  try {
    const value = window.localStorage.getItem(LEGACY_DRAFT_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<LegacyDraft>;
    if (parsed.version !== 1 || typeof parsed.title !== "string" || typeof parsed.content !== "string") {
      return null;
    }
    return parsed as LegacyDraft;
  } catch {
    return null;
  }
}

function browserDocument(input: EditableDocument): WorkbenchDocument {
  const timestamp = new Date().toISOString();
  return { ...input, createdAt: timestamp, updatedAt: timestamp };
}

function legacyOrDefault(defaultDocument: EditableDocument): EditableDocument {
  const legacyDraft = readLegacyDraft();
  return legacyDraft
    ? { ...defaultDocument, title: legacyDraft.title, content: legacyDraft.content }
    : defaultDocument;
}

function saveBrowserDraft(input: EditableDocument): WorkbenchDocument {
  const draft: LegacyDraft = {
    version: 1,
    title: input.title,
    content: input.content,
  };
  window.localStorage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(draft));
  return browserDocument(input);
}

export async function loadWorkbenchDocument(
  defaultDocument: EditableDocument = DEFAULT_DOCUMENT,
): Promise<LoadedDocument> {
  const seed = legacyOrDefault(defaultDocument);
  if (!isDesktopRuntime()) {
    return { document: browserDocument(seed), storageBackend: "localStorage" };
  }

  const existing = await window.__TAURI__!.core.invoke<WorkbenchDocument | null>("get_document", {
    documentId: defaultDocument.id,
  });
  if (existing) return { document: existing, storageBackend: "sqlite" };

  const migrated = await window.__TAURI__!.core.invoke<WorkbenchDocument>("save_document", {
    input: seed,
  });
  window.localStorage.removeItem(LEGACY_DRAFT_KEY);
  return { document: migrated, storageBackend: "sqlite" };
}

export async function saveWorkbenchDocument(input: EditableDocument): Promise<LoadedDocument> {
  if (!isDesktopRuntime()) {
    return { document: saveBrowserDraft(input), storageBackend: "localStorage" };
  }

  const document = await window.__TAURI__!.core.invoke<WorkbenchDocument>("save_document", { input });
  return { document, storageBackend: "sqlite" };
}
