import ts from 'typescript';
// Static extraction only: downloaded code is never evaluated.
function literal(node){
 if(ts.isStringLiteralLike(node))return node.text;
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(node.kind===ts.SyntaxKind.NullKeyword)return null;
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken)return -literal(node.operand);
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.text??p.name.getText(),literal(p.initializer)]));
 return {$expression:node.getText()};
}
const output=[];
for(const id of ['BMap','example']){
 const url=`http://static.dtws110.com/echarts-2.2.7/extension/BMap/doc/${id}.html`;
 const page=await fetch(url);if(!page.ok)throw Error(`${url}: ${page.status}`);
 const html=await page.text();const response=await fetch(url.replace('.html','.js'));if(!response.ok)throw Error(response.status);
 const script=await response.text();
 const editor=html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i)?.[1]?.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
 const result={id,url,bindings:{},calls:[]};
 for(const code of [editor,script].filter(Boolean)){
  const ast=ts.createSourceFile('reference.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  function visit(node){
   if(ts.isVariableDeclaration(node)&&['option','startPoint'].includes(node.name.getText())&&node.initializer)result.bindings[node.name.getText()]=literal(node.initializer);
   if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&node.left.getText()==='option')result.bindings.option=literal(node.right);
   if(ts.isCallExpression(node)&&/\.(setMapStyle|centerAndZoom|enableScrollWheelZoom)$/.test(node.expression.getText()))result.calls.push({method:node.expression.getText(),arguments:node.arguments.map(literal)});
   ts.forEachChild(node,visit);
  }visit(ast);
 }
 if(!result.bindings.option)throw Error(`Missing option: ${id}`);
 output.push(result);
}
console.log(JSON.stringify(output));
