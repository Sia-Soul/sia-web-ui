/** 对照公开组件的自有属性检查文档 JSX；不把 API 表或代码字符串当作运行样例。 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'apps/docs/tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'packages/react/package.json'), 'utf8'));
// 与发布清单同步发现子路径，新增入口缺少源码时立即报错。
const entries = [...new Set(Object.values(manifest.exports).filter(value => typeof value === 'object' && value.types).map(value => path.join(root, 'packages/react/src', path.basename(value.types).replace(/\.d\.(?:ts|cts|mts)$/, '.ts'))))];
for (const entry of entries) if (!fs.existsSync(entry)) throw new Error(`发布入口缺少源码：${entry}`);
const program = ts.createProgram([...parsed.fileNames, ...entries], parsed.options);
const checker = program.getTypeChecker();
const components = new Map();
const sourceRoot = path.join(root, 'packages/react/src').replaceAll('\\', '/');
/** 只认可显式对象值，不能因为 Partial<Props> 的类型声明就误报全部属性已有样例。 */
function spreadKeys(expression, seen = new Set()) {
  if (!expression || seen.has(expression)) return [];
  seen.add(expression);
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) return spreadKeys(expression.expression, seen);
  if (ts.isObjectLiteralExpression(expression)) return expression.properties.flatMap(p => ts.isSpreadAssignment(p) ? spreadKeys(p.expression, seen) : p.name ? [p.name.getText().replace(/^['"]|['"]$/g, '')] : []);
  if (ts.isIdentifier(expression)) {
    let symbol = checker.getSymbolAtLocation(expression);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.declarations?.flatMap(d => ts.isVariableDeclaration(d) ? spreadKeys(d.initializer, seen) : []) ?? [];
  }
  return [];
}
/** 只追踪框架声明；React 和 DOM 继承属性不重复计为组件专属 API。 */
function local(symbol) {
  return symbol.declarations?.some(d => d.getSourceFile().fileName.replaceAll('\\', '/').startsWith(sourceRoot + '/'));
}
/** 递归发现 Form.Item、Upload.Dragger 等静态子组件。 */
function collect(name, type, depth = 0) {
  if (depth > 2) return;
  const signature = type.getCallSignatures()[0];
  if (signature?.parameters[0]) {
    const parameter = signature.parameters[0];
    const props = checker.getTypeOfSymbolAtLocation(parameter, parameter.valueDeclaration);
    const own = props.getProperties().filter(local);
    if (own.length && !components.has(name)) components.set(name, { props: own.map(p => p.name), examples: {} });
  }
  for (const member of type.getProperties()) {
    if (/^[A-Z]/.test(member.name) && local(member)) collect(`${name}.${member.name}`, checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration ?? member.declarations[0]), depth + 1);
  }
}
for (const filename of entries) for (let symbol of checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(filename)))) {
  const name = symbol.name;
  if (!/^[A-Z]/.test(name)) continue;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  if (symbol.flags & ts.SymbolFlags.Value) collect(name, checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration ?? symbol.declarations[0]));
}
/** 记录真实 JSX 的行号，字符串里的伪样例不会消除缺项。 */
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.replaceAll('\\', '/').includes('/apps/docs/src/pages/')) continue;
  // 文档外壳、目录和属性索引自身不是业务样例，不能用于填补覆盖缺口。
  if (['DemoCard.tsx', 'PageHeader.tsx', 'DocsTabs.tsx', 'ApiTable.tsx', 'PropertyExamplesPage.tsx', 'ComponentDocPage.tsx'].includes(path.basename(sf.fileName))) continue;
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const component = components.get(node.tagName.getText(sf));
      if (component) {
        const properties = node.attributes.properties.filter(ts.isJsxAttribute).map(a => a.name.getText(sf));
        // 展开对象按实际推断出的字段统计；不把不确定的泛型或 any 当作全覆盖。
        for (const spread of node.attributes.properties.filter(ts.isJsxSpreadAttribute)) {
          properties.push(...spreadKeys(spread.expression));
        }
        if (ts.isJsxOpeningElement(node) && node.parent.children.some(c => !ts.isJsxText(c) || c.text.trim())) properties.push('children');
        for (const prop of properties) (component.examples[prop] ??= []).push(`${path.relative(root, sf.fileName).replaceAll('\\', '/')}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
const report = [...components].map(([name, c]) => ({ name, ...c, missing: c.props.filter(p => !c.examples[p]) }));
// 优先定位组件自己的文档页，其次补充样例，最后引用其他组件页中的实际用法。
for (const c of report) for (const locations of Object.values(c.examples)) locations.sort((a, b) => {
  const score = location => location.includes(`/${c.name.split('.')[0]}Page.tsx:`) ? 0 : location.includes('/pages/examples/') ? 1 : 2;
  return score(a) - score(b);
});
const catalog = JSON.stringify(report.map(c => ({ name: c.name, props: c.props.map(name => ({ name, example: c.examples[name]?.[0] ?? null, supplement: c.examples[name]?.find(location => location.includes('/pages/examples/')) ?? null })) })), null, 2) + '\n';
const catalogPath = path.join(root, 'apps/docs/src/pages/examples/coverage.json');
if (process.argv.includes('--write')) fs.writeFileSync(catalogPath, catalog, 'utf8');
else if (!process.argv.includes('--json') && (!fs.existsSync(catalogPath) || fs.readFileSync(catalogPath, 'utf8') !== catalog)) {
  console.error('属性样例索引已过期，请运行 pnpm generate:component-examples 更新。');
  process.exitCode = 1;
}
if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  for (const c of report) if (c.missing.length) console.log(`${c.name}: ${c.missing.join(', ')}`);
  const missing = report.reduce((sum, c) => sum + c.missing.length, 0);
  console.log(`${report.length} 个组件，${report.reduce((sum, c) => sum + c.props.length, 0)} 个自有属性，${missing} 个缺少 JSX 样例。`);
  if (missing) process.exitCode = 1;
}
