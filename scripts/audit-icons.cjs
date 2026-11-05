// 输出完整图标对照图和真实 SVG 几何；--write-bounds 仅用于修改轮廓后的显式边界更新。
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { createRequire } = require('node:module'), { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const ui = createRequire(path.resolve('packages/react/package.json'));
const { buildSync } = createRequire(ui.resolve('tsup'))('esbuild');
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.resolve(process.argv.find(arg => arg.startsWith('--output='))?.slice(9) ?? 'logs/icon-audit');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const result = buildSync({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{Icon,ICON_NAMES,FILLED_ICON_NAMES}from'./packages/react/src/components/Icon';import './packages/react/src/styles.css';
  const entries=[...ICON_NAMES.map(name=>({name,variant:'outline'})),...FILLED_ICON_NAMES.map(name=>({name,variant:'filled'}))];
  createRoot(document.getElementById('root')).render(<>{Array.from({length:Math.ceil(entries.length/54)},(_,page)=><section className="sheet" key={page}><h2>Sia 图标 · {page+1} / {Math.ceil(entries.length/54)} · 32 / 16px</h2><div className="grid">{entries.slice(page*54,(page+1)*54).map(({name,variant})=><div className="tile" key={variant+name}><div className="icons"><span className="icon-tile"><Icon name={name} variant={variant} size={32}/><span className="icon-tile__label" hidden>{name}</span></span><Icon name={name} variant={variant} size={16}/></div><div>{name}</div><small>{variant}</small></div>)}</div></section>)}</>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, nodePaths: [path.resolve('packages/react/node_modules')], format: 'iife', jsx: 'automatic', write: false, outdir: 'out' });
  const js = result.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
  const html = `<meta charset="utf-8"><style>${css}*{box-sizing:border-box}body{margin:0;font:12px system-ui;color:var(--sia-color-text);background:var(--sia-color-surface)}.sheet{padding:20px;width:1080px;background:var(--sia-color-surface)}h2{font-size:18px;margin:0 0 16px}.grid{display:grid;grid-template-columns:repeat(6,1fr)}.tile{height:104px;border:1px solid var(--sia-color-border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px}.icons{display:flex;align-items:center;justify-content:center;gap:16px;height:38px}.tile small{color:var(--sia-color-text-secondary)}</style><div id="root"></div><script>${js}</script>`;
  const server = http.createServer((_, res) => { res.setHeader('Content-Type', 'text/html;charset=utf-8'); res.end(html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1100 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('.icon-tile').first().waitFor();
    const expression = execFileSync(process.execPath, ['scripts/check-icon-geometry.cjs', '--expression'], { encoding: 'utf8' });
    const measurements = await page.evaluate(expression);
    // 整体居中不能发现内部符号偏移，独立检查典型组合图标的内容区中心。
    const composition = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.icon-tile')];
      const icon = name => nodes.find(node => node.querySelector('.icon-tile__label').textContent === name && node.querySelector('.sia-icon').dataset.variant === 'outline');
      const cases = [['folder-plus',12,13],['tab-plus',12,14.5],['file-plus',12,14],['file-check',12,14],['square-check',12,12],['circle-check',12,12],['clipboard-check',12,13.5],['shield-check',12,12]];
      const details = cases.map(([name,x,y]) => { const box = icon(name).querySelector('svg > g').lastElementChild.getBBox(); return {name,x,y,actualX:box.x+box.width/2,actualY:box.y+box.height/2}; });
      const speaker = name => { const svg=icon(name).querySelector('svg');const group=svg.firstElementChild;return {path:group.firstElementChild.getAttribute('d'),matrix:group.getAttribute('transform')}; };
      return {details, speakers:['volume-up','volume-off','speaker-wave','speaker-muted'].map(speaker)};
    });
    for (const item of composition.details) {
      assert.ok(Math.abs(item.actualX-item.x)<.35 && Math.abs(item.actualY-item.y)<.35, `${item.name} 内部符号偏离内容区中心：${item.actualX}, ${item.actualY}`);
    }
    if (!process.argv.includes('--write-bounds')) for (const speaker of composition.speakers) assert.deepEqual(speaker, composition.speakers[0], '音量状态切换应保持扬声器主体与位置一致');
    fs.writeFileSync(path.join(output, 'geometry.json'), JSON.stringify(measurements, null, 2), 'utf8');
    if (process.argv.includes('--write-bounds')) {
      // 原始边界不受外层旧归一化矩阵影响；先更新静态数据，再重新运行本脚本验证最终尺寸。
      const declarations = ['outline', 'filled'].map(variant => `export const ${variant}IconBounds = {\n${measurements.filter(item => item.variant === variant).sort((a,b)=>a.name.localeCompare(b.name)).map(item => `  ${JSON.stringify(item.name)}: [${item.raw.map(value => Number(value.toFixed(6))).join(', ')}],`).join('\n')}\n} as const;`);
      fs.writeFileSync('packages/react/src/components/iconBounds.ts', '// SVG 原始几何边界（不含描边）；由 scripts/audit-icons.cjs --write-bounds 测量后生成。\n// 静态数据避免运行时测量，保持 SSR 与首帧一致。修改路径后须重新测量并检查视觉对照。\n' + declarations.join('\n') + '\n', 'utf8');
    } else {
      console.log(execFileSync(process.execPath, ['scripts/check-icon-geometry.cjs', path.join(output, 'geometry.json')], { encoding: 'utf8' }).trim());
      console.log('PASS 组合图标内部符号居中与音量状态主体一致');
    }
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.siaTheme = theme, theme);
      for (let index = 0; index < await page.locator('.sheet').count(); index++) await page.locator('.sheet').nth(index).screenshot({ path: path.join(output, `${theme}-${index+1}.png`) });
    }
    console.log(`图标对照已保存：${output}`);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
