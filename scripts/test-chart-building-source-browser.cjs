const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const source=require('../apps/docs/src/pages/chartBuildingMapSource.json')[0],svg=fs.readFileSync('apps/docs/src/pages/chartBuilding.svg','utf8');
(async()=>{
 const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^map18$'],{encoding:'utf8'}));assert.deepEqual(current[0].option,source.option);const response=await fetch('http://static.dtws110.com/echarts-2.2.7/doc/example/svg/baidu-building.svg');assert.equal(response.status,200);assert.equal((await response.text()).trim(),svg.trim());
 const module={exports:{}};new Function('module','exports',compile('apps/docs/src/pages/chartBuildingMapData.ts'))(module,module.exports);const groups=module.exports.createBuildingMapData(source.option.series,source.option.color);
 assert.deepEqual(groups.map(group=>group.points.length),[39,0,0,4,1,1]);assert.deepEqual(groups.map(group=>group.lines.length),[3,4,10,0,0,0]);assert.equal(groups[0].points.filter(p=>p.name==='佳璐').length,2,'原重复点不能去重');
 for(const [i,group] of groups.entries()){
  for(const [j,point] of group.points.entries()){const original=source.option.series[i].markPoint.data[j];assert.equal(point.name,original.name);assert.deepEqual(point.coordinate,original.geoCoord??source.option.series[0].geoCoord[original.name]);}
  for(const [j,line] of group.lines.entries()){const pair=source.option.series[i].markLine.data[j];assert.deepEqual(line.source,pair[0].geoCoord??source.option.series[0].geoCoord[pair[0].name]);assert.deepEqual(line.target,pair[1].geoCoord??source.option.series[0].geoCoord[pair[1].name]);}
 }
 assert.throws(()=>module.exports.createBuildingMapData([{markPoint:{data:[{name:'不存在'}]}}],['red']),/缺少坐标/);
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{const page=await browser.newPage();await page.goto('about:blank');
 const result=await page.evaluate(({svg,code})=>{const module={exports:{}};new Function('module','exports',code)(module,module.exports);const parsed=module.exports.parseSvgMapPaths(svg),doc=new DOMParser().parseFromString(svg,'image/svg+xml'),ns='http://www.w3.org/2000/svg',host=document.createElementNS(ns,'svg');document.body.appendChild(host);try{return {width:parsed.width,height:parsed.height,names:parsed.paths.map(p=>p.name),checks:[...doc.querySelectorAll('path,rect,circle,line,polygon,polyline,ellipse')].map((node,index)=>{const a=document.createElementNS(ns,node.localName),b=document.createElementNS(ns,'path');for(const key of ['d','x','y','width','height','cx','cy','r','rx','ry','x1','x2','y1','y2','points'])if(node.hasAttribute(key))a.setAttribute(key,node.getAttribute(key));b.setAttribute('d',parsed.paths[index].d);host.append(a,b);const x=a.getBBox(),y=b.getBBox();return {name:node.getAttribute('name')??'',original:[x.x,x.y,x.width,x.height],converted:[y.x,y.y,y.width,y.height]};})};}finally{host.remove();}},{svg,code:compile('packages/react/src/components/svgMapSource.ts')});
 assert.equal(result.width,750);assert.equal(result.height,232);assert.equal(result.checks.length,57);assert.deepEqual(result.names.filter(Boolean),['C区','A区','B区','西湖春','得胜令','五福']);
 for(const check of result.checks)assert.ok(check.original.every((value,i)=>Math.abs(value-check.converted[i])<.001),JSON.stringify(check));
 console.log('map18源数据：线上配置/SVG、57图形几何、45原点位含重复、17原线路、缺失坐标拒绝通过。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
