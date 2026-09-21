const assert = require("node:assert/strict");
const { chromium } = require(process.argv[2] || "playwright");

// 检查真实绘制顺序而非只比较 z-index 数字，覆盖父级错误、子级错误和子弹框关闭恢复。
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto("http://127.0.0.1:4189/tests/floating-overlay-layer.html");
    assert.equal(await page.getByRole("tooltip").evaluate(node => node.parentElement === document.body), true);
    for (const type of ["弹框", "抽屉"]) {
      await page.getByRole("button", { name: `打开父${type}`, exact: true }).click();
      const parent = page.getByRole("dialog", { name: `父${type}`, exact: true });
      const error = page.getByRole("alert").filter({ hasText: "请输入吊牌编码" });
      await error.waitFor({ state: "visible" });
      assert.equal(await error.evaluate(node => !!node.parentElement.matches(".sia-modal-root, .sia-drawer-root")), true);
      for (let i = 0; i < 3; i++) {
        await parent.getByRole("button", { name: "打开子弹框", exact: true }).click();
        const child = page.getByRole("dialog", { name: "子弹框", exact: true });
        await child.waitFor();
        await page.waitForTimeout(300);
        const errorCovered = await error.evaluate(node => {
          const r = node.getBoundingClientRect();
          // 校验气泡默认不接收指针，临时启用命中以避免穿透造成层级断言假阳性。
          node.style.pointerEvents = "auto";
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          node.style.removeProperty("pointer-events");
          return hit?.closest('[role="dialog"]')?.getAttribute("aria-labelledby") === document.querySelectorAll('[role="dialog"]')[1].getAttribute("aria-labelledby");
        });
        assert.equal(errorCovered, true, "父级气泡位置应命中子弹框");
        const childError = page.getByRole("alert").filter({ hasText: "子级必填提示" });
        await childError.waitFor({ state: "visible" });
        assert.equal(await childError.evaluate(node => {
          const r = node.getBoundingClientRect();
          node.style.pointerEvents = "auto";
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          node.style.removeProperty("pointer-events");
          return node.contains(hit);
        }), true, "子级校验气泡应绘制在子弹框上方");
        assert.equal(await childError.evaluate(node => node.parentElement.querySelector('[role="dialog"]')?.textContent.includes("子弹框")), true);
        await child.getByRole("button", { name: "取消", exact: true }).click();
        await child.waitFor({ state: "detached" });
        await error.waitFor({ state: "visible" });
      }
      await parent.getByRole("button", { name: type === "弹框" ? "取消" : "关闭抽屉", exact: true }).click();
      await parent.waitFor({ state: "detached" });
      assert.equal(await error.count(), 0);
    }
    console.log("父子弹框/抽屉气泡层级、连续开关、父表单错误保留及页面级提示回归通过");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
