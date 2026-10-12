// 使用 Monaco 的真实 Monarch 分词器检查 T-SQL 着色，避免只核对词表字符串。
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const requireUi = createRequire(resolve('packages/react/package.json'));
const esbuild = createRequire(requireUi.resolve('tsup'))('esbuild');
const source = `
import assert from 'node:assert/strict';
import { registerSqlLanguages } from './packages/react/src/components/sqlLanguages';
import { compile } from './packages/react/node_modules/monaco-editor/esm/vs/editor/standalone/common/monarch/monarchCompile';
import { MonarchTokenizer } from './packages/react/node_modules/monaco-editor/esm/vs/editor/standalone/common/monarch/monarchLexer';
import { TokenTheme } from './packages/react/node_modules/monaco-editor/esm/vs/editor/common/languages/supports/tokenization';
import { vs, vs_dark } from './packages/react/node_modules/monaco-editor/esm/vs/editor/standalone/common/themes';
const definitions = {};
registerSqlLanguages({languages:{register(){},setLanguageConfiguration(){},setMonarchTokensProvider(id, value){definitions[id]=value;}}});
const language='sql-sqlserver';
const tokenizer = new MonarchTokenizer({}, {}, language, compile(language, definitions[language]), {getValue:()=>20000,onDidChangeConfiguration:()=>({dispose(){}})});
const tokenize = text => tokenizer.tokenize(text, true, tokenizer.getInitialState()).tokens;
for (const text of ['COUNT(1)', 'count_big(*)', 'ISNULL(x,0)', 'GETDATE()', 'DATEADD(day,1,x)', 'ROW_NUMBER()']) {
  assert.equal(tokenize(text)[0].type, 'predefined.sql.sql-sqlserver', text);
}
for (const text of ['DECLARE', 'SELECT', 'WHILE', 'NOLOCK', 'TOP']) assert.equal(tokenize(text)[0].type, 'keyword.sql-sqlserver', text);
assert.equal(tokenize('nvarchar')[0].type, 'type.sql-sqlserver');
for (const text of ['@id','@@ROWCOUNT','@0']) assert.equal(tokenize(text)[0].type, 'variable.sql-sqlserver');
assert.equal(tokenize("N'中文'")[0].type, 'string.quote.sql-sqlserver');
assert.equal(tokenize('0xAB12')[0].type, 'number.hex.sql-sqlserver');
assert.equal(tokenize('my_count')[0].type, 'identifier.sql-sqlserver');
assert.equal(tokenize('-- COUNT(1)')[0].type, 'comment.sql-sqlserver');
assert.ok(tokenize('[COUNT] SELECT').some(t=>t.type==='keyword.sql-sqlserver'));
// 分词正确还不够：明暗主题下函数必须有实际颜色，不能与普通标识符同色。
for (const themeData of [vs, vs_dark]) {
  const theme=TokenTheme.createFromRawTokenTheme(themeData.rules, []);
  assert.notEqual(theme.match(1, 'predefined.sql.sql-sqlserver'), theme.match(1, 'identifier.sql-sqlserver'));
}
tokenizer.dispose();
console.log('PASS SQL Server: functions, keywords, types, variables, Unicode strings, hex, comments and quoted identifiers');
`;
const code = esbuild.buildSync({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'sql-highlight-test.ts'},bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text;
const Module = require('node:module');
const testModule = new Module(__filename, module);
testModule._compile(code, __filename);
