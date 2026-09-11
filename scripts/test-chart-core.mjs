import ts from 'typescript';
import fs from 'node:fs';

// Run pure chart-core tests on the workspace Node 18 runtime without extra dependencies.
// Match the package ES2022 target so Set iteration retains its actual semantics.
for (const name of ['cartesianTransfer', 'chartMotion', 'barLayout', 'chartScales', 'pieLayout', 'arcPath', 'funnelLayout', 'gaugeGeometry', 'treemapLayout', 'treeLayout', 'chartRoam', 'treeStyles', 'vennGeometry', 'wordCloudLayout', 'scatterBatch', 'scatterStatistics', 'scatterCategoryWindow', 'visualPiece', 'scatterValueWindow', 'chartTimeTicks', 'heatmapRaster', 'chordMatrixLayout', 'graphLayout', 'forceFrameBudget', 'radarScale', 'radarTransfer']) {
  const options = { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } };
  const source = ts.transpileModule(fs.readFileSync(`packages/react/src/components/${name}.ts`, 'utf8'), options).outputText;
  const uri = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
  const test = ts.transpileModule(fs.readFileSync(`packages/react/src/components/${name}.test.ts`, 'utf8'), options).outputText.replace(`./${name}.ts`, uri);
  await import('data:text/javascript;base64,' + Buffer.from(test).toString('base64'));
}
