/** 检查所有发布入口可达的自有 API 类型，防止新增属性忘记添加 JSDoc。 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../packages/react/src');
const configPath = path.resolve(root, '../tsconfig.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const declarations = new Set();
const queue = [];
const missing = [];
let members = 0;
const inside = file => path.relative(root, file).split(path.sep)[0] !== '..' && !path.isAbsolute(path.relative(root,file));
function add(declaration) {
  if (!declaration || !inside(declaration.getSourceFile().fileName)) return;
  if (ts.isVariableDeclaration(declaration)) declaration = declaration.parent.parent;
  if (!ts.isInterfaceDeclaration(declaration) && !ts.isTypeAliasDeclaration(declaration) && !ts.isFunctionDeclaration(declaration) && !ts.isVariableStatement(declaration) && !ts.isModuleDeclaration(declaration)) return;
  if (declarations.has(declaration)) return;
  declarations.add(declaration); queue.push(declaration);
}
function check(node, label) {
  if (!node.jsDoc?.some(doc => typeof doc.comment === 'string' ? doc.comment.trim() : doc.comment?.length)) {
    const sf = node.getSourceFile();
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    missing.push(`${path.relative(root,sf.fileName)}:${line} ${label}`);
  }
}
// 依据发布清单发现入口，新增子路径时自动纳入覆盖检查。
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, '../package.json'), 'utf8'));
const entries = [...new Set(Object.values(manifest.exports).filter(value => typeof value === 'object' && value.types).map(value => path.basename(value.types).replace(/\.d\.(?:ts|cts|mts)$/, '.ts')))];
if (!entries.length) throw new Error('发布清单中未找到类型入口');
for (const entry of entries) {
  const sf = program.getSourceFile(path.join(root,entry));
  if (!sf) throw new Error(`发布入口 ${entry} 缺少对应源码，必须更新注释检查配置`);
  for (let symbol of checker.getExportsOfModule(checker.getSymbolAtLocation(sf))) {
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    symbol.declarations?.forEach(add);
  }
}
for (let i=0;i<queue.length;i++) {
  const d=queue[i];
  if (ts.isModuleDeclaration(d)) {
    if(d.body&&ts.isModuleBlock(d.body))d.body.statements.forEach(add);
    continue;
  }
  const owner=d.name?.getText()??d.declarationList?.declarations[0].name.getText();
  check(d,owner);
  if (ts.isInterfaceDeclaration(d)||ts.isTypeAliasDeclaration(d)||ts.isFunctionDeclaration(d)) {
    const visit=n=>{
      if(ts.isPropertySignature(n)||ts.isMethodSignature(n)){members++;check(n,`${owner}.${n.name.getText()}`);}
      if(ts.isTypeReferenceNode(n)||ts.isExpressionWithTypeArguments(n)){
        let s=checker.getSymbolAtLocation(n.typeName??n.expression);
        if(s?.flags&ts.SymbolFlags.Alias)s=checker.getAliasedSymbol(s);
        s?.declarations?.forEach(add);
      }
      ts.forEachChild(n,visit);
    };
    if (ts.isFunctionDeclaration(d)) {
      d.parameters.forEach(p => { if(p.type)visit(p.type); });
      if(d.type)visit(d.type);
    } else visit(d);
  }
  if(ts.isVariableStatement(d))for(const v of d.declarationList.declarations){
    let init=v.initializer;if(init&&ts.isAsExpression(init))init=init.expression;
    const objects=init&&ts.isObjectLiteralExpression(init)?[init]:init&&ts.isCallExpression(init)&&init.expression.getText()==='Object.assign'?init.arguments.filter(ts.isObjectLiteralExpression):[];
    for(const object of objects)for(const prop of object.properties){members++;check(prop,`${owner}.${prop.name?.getText()}`);}
  }
}
if(missing.length){console.error(`Missing JSDoc (${missing.length}):\n${missing.join('\n')}`);process.exitCode=1;}
else console.log(`PASS public API JSDoc: ${declarations.size} declarations, ${members} members across all ${entries.length} package entries.`);
