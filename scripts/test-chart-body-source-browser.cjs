const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {chromium}=require(path.join(process.argv[2],'playwright'));
const compiled=ts.transpileModule(fs.readFileSync('packages/react/src/components/svgMapSource.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const option=require('../apps/docs/src/pages/chartBodyMapSource.json')[0].option;
(async()=>{
 const {execFileSync}=require('node:child_process');const current=JSON.parse(execFileSync(process.execPath,['scripts/inspect-chart-references.mjs','--options','--match=^map16$'],{encoding:'utf8'}));assert.deepEqual(current[0].option,option,'原页完整配置与本地快照一致');
 for(const sex of ['male','female']){const response=await fetch('http://static.dtws110.com/echarts-2.2.7/doc/example/svg/body-'+sex+'.svg');assert.equal(response.status,200);assert.equal((await response.text()).trim(),fs.readFileSync('apps/docs/src/pages/chartBody'+sex[0].toUpperCase()+sex.slice(1)+'.svg','utf8').trim(),'原SVG内容一致');}
 const browser=await chromium.launch({headless:true,executablePath:process.argv[3]});try{
 const page=await browser.newPage();await page.goto('about:blank');
 for(const [index,sex] of ['Male','Female'].entries()){
  const svg=fs.readFileSync('apps/docs/src/pages/chartBody'+sex+'.svg','utf8');
  const result=await page.evaluate(({compiled,svg})=>{const module={exports:{}};new Function('module','exports',compiled)(module,module.exports);const parsed=module.exports.parseSvgMapPaths(svg),original=new DOMParser().parseFromString(svg,'image/svg+xml');return {parsed,originalPaths:[...original.querySelectorAll('path')].map(p=>({name:p.getAttribute('name'),d:p.getAttribute('d')}))};},{compiled,svg});
  assert.equal(result.parsed.width,240);assert.equal(result.parsed.height,450);assert.equal(result.parsed.paths.length,7);assert.deepEqual(result.parsed.paths,result.originalPaths,'曲线路径和名称逐字符保留，不继承分组透明度');assert.deepEqual(result.parsed.paths.map(p=>p.name).sort(),option.series[index].data.map(d=>d.name).sort());
 }
 const safety=await page.evaluate(compiled=>{const module={exports:{}};new Function('module','exports',compiled)(module,module.exports);const parse=module.exports.parseSvgMapPaths,invalid=[];for(const s of ['<svg>','<svg width="0" height="1"><path d="M0 0"/></svg>','<svg width="1" height="1"/>']){try{parse(s);invalid.push(false);}catch{invalid.push(true);}}const result=parse('<svg width="10" height="20"><script>window.svgMapExecuted=true</script><path name="测试" d="M0 0 L1 1" fill="red" opacity="0.4" onclick="window.svgMapExecuted=true"/></svg>');return {invalid,result,executed:window.svgMapExecuted===true};},compiled);
 assert.deepEqual(safety.invalid,[true,true,true]);assert.equal(safety.executed,false);assert.deepEqual(safety.result.paths,[{name:'测试',d:'M0 0 L1 1',fill:'red',opacity:.4}]);
 console.log('map16源数据：原页完整配置、线上两SVG、14原始路径与部位名、直接属性及不执行源脚本测试通过。');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
