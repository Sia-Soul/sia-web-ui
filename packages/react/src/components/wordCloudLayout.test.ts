import assert from 'node:assert/strict';
import test from 'node:test';
import {rotatedWordBounds,layoutCloudWords,cloudWordsOverlap} from './wordCloudLayout.ts';
test('45 度文字占用范围同时包含横向和纵向分量',()=>{
 const box=rotatedWordBounds(100,20,45);assert.ok(Math.abs(box.width-120/Math.sqrt(2))<1e-9);assert.ok(Math.abs(box.height-box.width)<1e-9);
});
test('排布不越界、不重叠并保留原始索引',()=>{
 const data=[{name:'small',value:1},{name:'large',value:100},{name:'middle',value:40}];
 const bounds={x:20,y:30,width:500,height:300};
 const p=layoutCloudWords(data,{bounds,minFontSize:14,maxFontSize:48,padding:0,rotations:[0,45,90],spiralStep:9,shape:'square',autoFit:true});
 assert.equal(p.length,3);assert.equal(p[0]!.index,1);
 for(let i=0;i<p.length;i++){const a=p[i]!;assert.ok(a.x-a.width/2>=20&&a.x+a.width/2<=520);assert.ok(a.y-a.height/2>=30&&a.y+a.height/2<=330);for(const b of p.slice(i+1))assert.equal(cloudWordsOverlap({...a,width:a.rawWidth,height:a.rawHeight},{...b,width:b.rawWidth,height:b.rawHeight}),false);}
});
