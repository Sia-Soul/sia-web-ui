const assert = require("node:assert/strict");
const { chromium } = require(process.argv[2] || "playwright");

// 浏览器验证真实样式、点击命中层级以及关闭过程，不用固定截图代替交互断言。
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await page.goto("http://127.0.0.1:4189/tests/modal-motion.html");
    await page.getByRole("button", { name: "打开父弹框", exact: true }).click();
    const parent = page.getByRole("dialog", { name: "父弹框", exact: true });
    await parent.waitFor();
    const styles = await parent.evaluate(panel => {
      const root = panel.parentElement;
      const mask = getComputedStyle(root, "::before");
      return { maskZ: mask.zIndex, panelZ: getComputedStyle(panel).zIndex, isolation: getComputedStyle(root).isolation,
        animation: mask.animationName, duration: mask.animationDuration, willChange: mask.willChange,
        frames: root.getAnimations({ subtree: true }).filter(animation => animation.animationName === "sia-modal-mask-in")
          .flatMap(animation => animation.effect.getKeyframes()).map(frame => frame.opacity) };
    });
    assert.deepEqual(styles, { maskZ: "0", panelZ: "1", isolation: "isolate", animation: "sia-modal-mask-in", duration: "0.22s", willChange: "opacity", frames: ["0", "1"] });
    for (let i = 0; i < 5; i++) {
      await parent.getByRole("button", { name: "打开子弹框" }).click();
      const child = page.getByRole("dialog", { name: "子弹框", exact: true });
      await child.waitFor();
      // elementFromPoint 确认真正接收点击的是子弹框，而非上方遮罩。
      assert.equal(await child.evaluate(panel => { const r = panel.getBoundingClientRect(); return panel.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
      await child.getByRole("button", { name: "取消", exact: true }).click();
      await child.waitFor({ state: "detached" });
      await parent.getByRole("button", { name: "快速重开" }).click();
      await page.waitForTimeout(350);
      assert.equal(await parent.count(), 1);
      assert.equal(await page.locator("#closed").textContent(), "0");
    }
    await page.mouse.click(10, 800);
    await parent.waitFor({ state: "detached" });
    assert.equal(await page.locator("#closed").textContent(), "1");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "打开父弹框", exact: true }).click();
    await parent.waitFor();
    assert.equal(await parent.evaluate(panel => getComputedStyle(panel.parentElement, "::before").animationName), "none");
    await parent.getByRole("button", { name: "取消", exact: true }).click();
    await parent.waitFor({ state: "detached" });
    console.log("弹框遮罩透明度动画、嵌套层级、快速重开、遮罩关闭、减少动态效果回归通过");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
