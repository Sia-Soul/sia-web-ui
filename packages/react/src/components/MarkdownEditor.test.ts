import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node 的类型剥离测试直接加载 TypeScript 扩展名。
import { isLikelyMarkdown } from "./markdownPaste.ts";

test("识别应自动解析的 Markdown 内容", () => {
  for (const markdown of [
    "# 标题\n\n正文",
    "1. 第一项\n2. 第二项",
    "- [x] 已完成",
    "```ts\nconst ready = true;\n```",
    "[链接](https://example.com)",
    "| 名称 | 状态 |\n| --- | --- |\n| DevFlow | 正常 |",
  ]) {
    assert.equal(isLikelyMarkdown(markdown), true, markdown);
  }
});

test("普通文本不会被误判为 Markdown", () => {
  for (const text of [
    "这是一段普通文字",
    "项目在 2026.08.13 正常运行",
    "张三 - 李四",
    "访问 https://example.com 查看详情",
  ]) {
    assert.equal(isLikelyMarkdown(text), false, text);
  }
});
