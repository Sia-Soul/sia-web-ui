const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 主题容器必须分别声明表格边框，确保局部明暗主题嵌套时不会继承错误颜色。
const css = fs.readFileSync(path.join(__dirname, "../packages/react/src/styles.css"), "utf8");
for (const [mode, expected] of [["light", "#EFF2F6"], ["dark", "#363636"]]) {
  const block = css.match(new RegExp(`\\[data-sia-theme="${mode}"\\]\\s*\\{([^}]+)\\}`));
  assert.ok(block, `${mode} 主题应存在`);
  assert.match(block[1], new RegExp(`--sia-table-border-color:\\s*${expected};`, "i"), `${mode} 表格应使用独立主题边框`);
}
console.log("PASS 表格浅色与深色边框主题");
