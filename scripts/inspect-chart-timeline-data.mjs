import ts from 'typescript';
import assert from 'node:assert/strict';

// Parse literal data only. Never execute the remote source or its formatter functions.
const url='http://static.dtws110.com/echarts-2.2.7/doc/example/timelineOption.js';
const response=await fetch(url);
if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
const source=await response.text();
const file=ts.createSourceFile('timelineOption.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function literal(node){
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(ts.isStringLiteral(node))return node.text;
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(property=>{
  if(!ts.isPropertyAssignment(property))throw new Error('Expected literal property');
  return [property.name.getText(file).replace(/^['"]|['"]$/g,''),literal(property.initializer)];
 }));
 throw new Error(`Non-literal data rejected: ${node.getText(file).slice(0,80)}`);
}
const tables={};let provinces;
function visit(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(file)==='pList'&&node.initializer)provinces=literal(node.initializer);
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(node.left)&&node.left.expression.getText(file)==='dataMap'&&ts.isCallExpression(node.right)&&node.right.expression.getText(file)==='dataFormatter'){
  tables[node.left.name.text]=literal(node.right.arguments[0]);
 }
 ts.forEachChild(node,visit);
}
visit(file);
assert.equal(provinces.length,31);
for(const name of ['dataGDP','dataPI','dataSI','dataTI','dataEstate','dataFinancial']){
 assert.ok(tables[name],name);
 for(let year=2002;year<=2011;year++){
  assert.equal(tables[name][year].length,31,`${name}/${year}`);
  assert.ok(tables[name][year].every(Number.isFinite));
 }
}
const mixes=[...source.matchAll(/dataMap\.(\w+)\s*=\s*dataMix\(\[([^\]]+)\]\)/g)].map(match=>({name:match[1],tables:match[2].split(',').map(part=>part.trim().replace(/^dataMap\./,''))}));
process.stdout.write(JSON.stringify({url,provinces,tables,mixes}));
