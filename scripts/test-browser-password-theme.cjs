/** 验证真实密码注入脚本跟随 Sia 主题，测试只使用虚构账号与模拟 WebView 消息。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.argv[2], 'playwright'));
const rust = fs.readFileSync(path.join(__dirname, '../apps/browser/src-tauri/src/passwords.rs'), 'utf8');
const script = rust.match(/pub const PASSWORD_AUTOFILL_SCRIPT: &str = r#"([\s\S]*?)"#;/)?.[1];
assert.ok(script, '必须测试实际注入脚本');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    // 系统保持深色，确认浏览器浅色主题不会被系统偏好覆盖。
    const page = await browser.newPage({ colorScheme: 'dark' });
    await page.route('https://password-theme.example/', route => route.fulfill({
      contentType: 'text/html', body: '<form><input autocomplete="username"><input type="password"></form>',
    }));
    await page.goto('https://password-theme.example/');
    await page.evaluate(() => {
      const attachShadow = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function (options) {
        const root = attachShadow.call(this, options);
        if (this.hasAttribute('data-sia-password-suggestions')) window.testRoot = root;
        return root;
      };
      window.theme = { darkMode: false, colors: {
        surface: '#ffffff', text: '#1f1f1f', secondary: '#666666', border: '#d9d9d9',
        primary: '#1677ff', hover: '#e6f4ff', scrollbar: 'rgba(82,82,82,.68)',
      } };
      window.chrome.webview = {
        addEventListener: (_, handler) => { window.receivePasswordMessage = handler; },
        postMessage: raw => {
          const request = JSON.parse(raw);
          if (request.kind === 'password-options-query') window.receivePasswordMessage({ data: {
            kind: 'sia-password-options', origin: location.origin, theme: window.theme,
            credentials: [{ id: 'fake-id', username: 'demo@example.test', name: '测试账号' }],
          } });
          if (request.kind === 'password-fill-request') window.fillRequest = request.credentialId;
        },
      };
    });
    await page.evaluate(script);
    await page.locator('input[autocomplete=username]').focus();
    await page.waitForFunction(() => window.testRoot?.querySelector('.panel'));
    const colors = () => page.evaluate(() => {
      const style = selector => getComputedStyle(window.testRoot.querySelector(selector));
      return {
        background: style('.panel').backgroundColor, text: style('.username').color,
        border: style('.panel').borderTopColor, mark: style('.mark').backgroundColor,
        scheme: getComputedStyle(window.testRoot.host).colorScheme,
      };
    });
    assert.deepEqual(await colors(), {
      background: 'rgb(255, 255, 255)', text: 'rgb(31, 31, 31)', border: 'rgb(217, 217, 217)',
      mark: 'rgb(22, 119, 255)', scheme: 'light',
    });
    await page.evaluate(() => {
      window.theme = { darkMode: true, colors: {
        surface: '#1f1f1f', text: '#ebebeb', secondary: '#a6a6a6', border: '#424242',
        primary: '#1668dc', hover: '#15345b', scrollbar: 'rgba(174,174,174,.62)',
      } };
      window.dispatchEvent(new CustomEvent('sia-password-theme', { detail: window.theme }));
    });
    assert.deepEqual(await colors(), {
      background: 'rgb(31, 31, 31)', text: 'rgb(235, 235, 235)', border: 'rgb(66, 66, 66)',
      mark: 'rgb(22, 104, 220)', scheme: 'dark',
    });
    // 自定义主色也应立即生效，不局限于内置蓝色。
    await page.evaluate(() => {
      window.theme.colors.primary = '#7c3aed';
      window.dispatchEvent(new CustomEvent('sia-password-theme', { detail: window.theme }));
    });
    assert.equal((await colors()).mark, 'rgb(124, 58, 237)');
    await page.evaluate(() => window.testRoot.querySelector('.option').click());
    assert.equal(await page.evaluate(() => window.fillRequest), 'fake-id');
    assert.equal(await page.evaluate(() => window.testRoot.host.hidden), true);
    console.log('PASS 密码候选主题：系统深色下的 Sia 浅色、实时深色切换、自定义主色与账号选择。');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
