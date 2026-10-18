// 使用品牌方端实际压缩目标验证图表转移源码，并执行降级后的数值合并逻辑。
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
// 复用框架构建器已安装的 esbuild，不额外引入测试专用版本。
const esbuild = require(require.resolve('esbuild', {
  paths: [require.resolve('tsup', { paths: [require.resolve('../packages/react/package.json')] })],
}));
function load(file) {
  const source = fs.readFileSync(`packages/react/src/components/${file}.ts`, 'utf8');
  const { code } = esbuild.transformSync(source, {
    loader: 'ts', format: 'cjs', minify: true,
    target: ['chrome67', 'edge79', 'es2015'],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, BigInt });
  return module.exports;
}
const { transferCartesianValue } = load('cartesianTransfer');
const { transferPieValue } = load('pieTransfer');
const from = { series: 0, index: 0 }, to = { series: 0, index: 1 };
for (const [a, b, expected] of [[0.1, 0.2, 0.3], [1e-7, 2e-7, 3e-7], [1e20, 1e20, 2e20], [0, 12.34, 12.34]]) {
  const cart = [{ name: '数值', data: [a, b] }];
  const pie = [{ name: '占比', data: [{ name: '甲', value: a }, { name: '乙', value: b }] }];
  const before = JSON.stringify({ cart, pie });
  assert.equal(transferCartesianValue(cart, from, to, ['甲', '乙']).series[0].data[1], expected);
  assert.equal(transferPieValue(pie, from, to).series[0].data[1].value, expected);
  assert.equal(JSON.stringify({ cart, pie }), before);
}
assert.equal(transferCartesianValue([{ name: '数值', data: [-0.1, 0.3] }], from, to, []).series[0].data[1], 0.2);
assert.throws(() => transferCartesianValue([{ name: '数值', data: [Number.MAX_VALUE, Number.MAX_VALUE] }], from, to, []), /范围/);
assert.throws(() => transferPieValue([{ data: [{ name: '甲', value: Number.MAX_VALUE }, { name: '乙', value: Number.MAX_VALUE }] }], from, to), /范围/);
console.log('PASS 图表转移：业务压缩目标、小数精度、科学计数、零值、负数、溢出及输入不变');
