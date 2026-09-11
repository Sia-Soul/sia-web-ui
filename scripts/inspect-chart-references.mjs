// Read-only source inspection. No downloaded JavaScript is executed.
import ts from 'typescript';
const root = 'http://static.dtws110.com/echarts-2.2.7/doc/';
const page = await (await fetch(root + 'example.html')).text();
const match = process.argv.find(arg => arg.startsWith('--match='))?.slice(8);
const bindingNames=process.argv.find(arg=>arg.startsWith('--bindings='))?.slice(11).split(',')??[];
const links = [...new Set([...page.matchAll(/href\s*=\s*["']([^"']+\.html(?:[^"']*)?)["']/g)].map(m => new URL(m[1], root + 'example.html').href))]
  .filter(url => url.includes('/doc/example/') || /themeDesigner|topic|extension/.test(url));
if (match) links.splice(0, links.length, ...links.filter(url => new RegExp(match).test(new URL(url).pathname.split('/').at(-1).replace('.html', ''))));
const seen = new Set(links);
function literal(node) {
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.text ?? p.name.getText(), literal(p.initializer)]));
  return { $expression: node.getText() };
}
const output = [];
let cursor = 0;
await Promise.all(Array.from({length: 6}, async () => {
  while (cursor < links.length) {
    const url = links[cursor++];
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(20000)});
      const html = await response.text();
      if (process.argv.includes('--nested') && new URL(url).host === new URL(root).host) {
        for (const anchor of html.matchAll(/href\s*=\s*["']([^"']+\.html(?:[^"']*)?)["']/g)) {
          const nested = new URL(anchor[1],url); nested.hash='';
          if (nested.host !== new URL(root).host || !/\/doc\/example\/|\/extension\/BMap\//.test(nested.pathname) || seen.has(nested.href)) continue;
          seen.add(nested.href);links.push(nested.href);
        }
      }
      const code = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)?.[1]?.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
      let option;
      const bindings={};
      if (code) {
        const source = ts.createSourceFile('reference.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        function visit(node) {
          if (ts.isBinaryExpression(node) && node.left.getText(source) === 'option' && ts.isObjectLiteralExpression(node.right)) option = literal(node.right);
          if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&bindingNames.includes(node.left.getText(source)))bindings[node.left.getText(source)]=literal(node.right);
          if(ts.isVariableDeclaration(node)&&bindingNames.includes(node.name.getText(source)))bindings[node.name.getText(source)]=literal(node.initializer);
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
      output.push({id:new URL(url).pathname.split('/').at(-1).replace('.html',''), url, status:response.status, hasEditor:!!code, option,...(bindingNames.length?{bindings}:{})});
    } catch (error) { output.push({url,error:String(error)}); }
  }
}));
const sorted = output.sort((a,b)=>a.url.localeCompare(b.url));
console.log(JSON.stringify(process.argv.includes('--options') ? sorted : sorted.map(({option,...entry}) => ({...entry, seriesTypes:[...new Set((Array.isArray(option?.series) ? option.series : []).map(s=>s.type))], features: Object.keys(option?.toolbox?.feature ?? {})}))));
