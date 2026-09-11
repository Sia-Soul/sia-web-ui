// Extract only a literal geography object. Never execute downloaded code.
import ts from 'typescript';
const url='http://static.dtws110.com/echarts-2.2.7/doc/example/www/js/chart/map.js';
const moduleName=process.argv.find(arg=>arg.startsWith('--module='))?.slice(9)??'china_geo';
const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
const text=await response.text(),ast=ts.createSourceFile('map.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
function literal(node){
 if(ts.isStringLiteralLike(node))return node.text;
 if(ts.isNumericLiteral(node))return Number(node.text);
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.MinusToken)return -literal(node.operand);
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken)return !literal(node.operand);
 if(ts.isArrayLiteralExpression(node))return node.elements.map(literal);
 if(ts.isObjectLiteralExpression(node))return Object.fromEntries(node.properties.map(p=>{if(!ts.isPropertyAssignment(p))throw new Error('Non-literal property');return [p.name.text,literal(p.initializer)];}));
 if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 throw new Error('Unsupported non-literal map value: '+node.getText(ast).slice(0,80));
}
let geography,seaInset;
function visit(node){
 if(ts.isPropertyAssignment(node)&&node.name.text==='南海诸岛'&&ts.isObjectLiteralExpression(node.initializer)){
  const properties=node.initializer.properties;
  const coordinate=properties.find(p=>p.name?.text==='textCoord');
  const path=properties.find(p=>p.name?.text==='getPath');
  if(coordinate&&path){
   let polygons;
   const findArray=n=>{if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isArrayLiteralExpression(n.initializer)&&ts.isArrayLiteralExpression(n.initializer.elements[0]))polygons??=literal(n.initializer);ts.forEachChild(n,findArray);};
   findArray(path.initializer);
   if(polygons)seaInset={name:'南海诸岛',coordinate:literal(coordinate.initializer),polygons,label:[32,83],unitsPerLongitude:10.5};
  }
 }
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='define'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text.endsWith('/geoJson/'+moduleName)){
  const factory=node.arguments.at(-1);
  const result=factory.body.statements.find(ts.isReturnStatement);
  geography=literal(result.expression);
 }
 ts.forEachChild(node,visit);
}
visit(ast);if(!geography)throw new Error('Geography module not found: '+moduleName);
function decode(encoded,offset){
 let x=offset[0],y=offset[1];const points=[];
 for(let i=0;i<encoded.length;i+=2){
  const dx=encoded.charCodeAt(i)-64,dy=encoded.charCodeAt(i+1)-64;
  x+=(dx>>1)^(-(dx&1));y+=(dy>>1)^(-(dy&1));
  points.push([x/1024,y/1024]);
 }
 return points;
}
if(geography.UTF8Encoding){
 for(const feature of geography.features){
  const shape=feature.geometry;
  if(shape.type==='Polygon')shape.coordinates=shape.coordinates.map((ring,i)=>decode(ring,shape.encodeOffsets[i]));
  else if(shape.type==='MultiPolygon')shape.coordinates=shape.coordinates.map((polygon,i)=>polygon.map((ring,j)=>decode(ring,shape.encodeOffsets[i][j])));
  else throw new Error('Unsupported geometry '+shape.type);
  delete shape.encodeOffsets;
 }
 delete geography.UTF8Encoding;
}
const names=geography.features.map(f=>f.properties.name);
if(moduleName==='china_geo'&&!['北京','上海','广东','台湾','香港','澳门'].every(name=>names.includes(name)))throw new Error('Missing regions');
for(const feature of geography.features){
 const coordinates=feature.geometry.type==='Polygon'?feature.geometry.coordinates.flat():feature.geometry.coordinates.flat(2);
 const world=moduleName==='world_geo';
 if(!coordinates.length||coordinates.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)||x<(world?-180:70)||x>(world?180:140)||y<(world?-90:0)||y>(world?90:60)))throw new Error('Invalid decoded region '+feature.properties.name);
}
if(!seaInset)throw new Error('Missing South China Sea inset');
console.log(JSON.stringify({source:url,module:moduleName,geography,...(moduleName==='china_geo'?{seaInset}:{})}));
