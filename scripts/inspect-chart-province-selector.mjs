import ts from 'typescript';
const url='http://static.dtws110.com/echarts-2.2.7/doc/example/mix5.html';
const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
const html=await response.text(),code=html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)?.[1];
if(!code)throw new Error('Missing source editor');
const ast=ts.createSourceFile('mix5.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let names;
function visit(node){
 if(ts.isBinaryExpression(node)&&node.left.getText(ast)==='option.series[1]'&&ts.isObjectLiteralExpression(node.right)){
  const data=node.right.properties.find(p=>p.name?.text==='data')?.initializer;
  if(!data||!ts.isArrayLiteralExpression(data))throw new Error('Missing city data');
  names=data.elements.map(item=>{
   if(!ts.isObjectLiteralExpression(item))throw new Error('Non-literal city');
   const name=item.properties.find(p=>p.name?.text==='name')?.initializer;
   const value=item.properties.find(p=>p.name?.text==='value')?.initializer;
   if(!name||!ts.isStringLiteral(name)||value?.getText(ast).replace(/\s/g,'')!=='Math.round(Math.random()*1000)')throw new Error('Unexpected source formula');
   return name.text;
  });
 }
 ts.forEachChild(node,visit);
}
visit(ast);if(!names?.length)throw new Error('No province selection data');
console.log(JSON.stringify({source:url,valueRule:'Math.round(Math.random()*1000)',names}));
