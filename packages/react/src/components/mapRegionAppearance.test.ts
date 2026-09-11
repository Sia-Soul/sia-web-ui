import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveMapRegionAppearance} from './mapRegionAppearance.ts';

const base={regionStyle:{fill:'orange',stroke:'lightgreen',strokeWidth:2},emphasisRegionStyle:{fill:'#32cd32',stroke:'#fff',strokeWidth:2},showLabels:false,showEmphasisLabels:true,emphasisLabelStyle:{fill:'#fff'}};
const guangdong={regionStyle:{fill:'#32cd32'},emphasisRegionStyle:{fill:'#cd5c5c',stroke:'yellow',strokeWidth:5},showLabels:true,showEmphasisLabels:false,labelStyle:{fill:'#fff',fontSize:15},emphasisLabelStyle:{fill:'blue'}};

test('个性化地图：广东普通态覆写颜色，保留全局边框和独立标签',()=>{
  const actual=resolveMapRegionAppearance(base,guangdong,false);
  assert.deepEqual(actual.regionStyle,{fill:'#32cd32',stroke:'lightgreen',strokeWidth:2});
  assert.deepEqual(actual.labelStyle,{fill:'#fff',fontSize:15});
  assert.equal(actual.showLabel,true);
});
test('个性化地图：广东高亮态五像素黄边，显式 false 隐藏标签',()=>{
  const actual=resolveMapRegionAppearance(base,guangdong,true);
  assert.deepEqual(actual.regionStyle,{fill:'#cd5c5c',stroke:'yellow',strokeWidth:5});
  assert.deepEqual(actual.labelStyle,{fill:'blue',fontSize:15});
  assert.equal(actual.showLabel,false);
});
test('无区域覆写时保留已有地图标签行为；解析不修改输入',()=>{
  const before=JSON.stringify({base,guangdong});
  assert.equal(resolveMapRegionAppearance(base,undefined,false).showLabel,false);
  assert.equal(resolveMapRegionAppearance(base,undefined,true).showLabel,true);
  assert.equal(resolveMapRegionAppearance({showLabels:true,showEmphasisLabels:false},undefined,true).showLabel,true);
  resolveMapRegionAppearance(base,guangdong,true);
  assert.equal(JSON.stringify({base,guangdong}),before);
});
