import assert from 'node:assert/strict';
import test from 'node:test';
import {observeMapOverlayHost} from './mapOverlayHost.ts';
import type {MapOverlayEvent,MapOverlayHost,MapOverlaySnapshot} from './mapOverlayHost.ts';

test('宿主复用可变快照时仍输出新引用，偏移不受后续原地修改影响',()=>{
 const offset:[number,number]=[0,0];const snapshot:MapOverlaySnapshot={width:500,height:500,offset,project:()=>[0,0]};
 const received:MapOverlaySnapshot[]=[];let refresh=()=>{};
 const stop=observeMapOverlayHost({snapshot:()=>snapshot,subscribe:(_e,f)=>{refresh=f;return ()=>{};},destroy:()=>{}},s=>received.push(s));
 offset[0]=20;refresh();assert.notEqual(received[0],received[1]);assert.deepEqual(received[0]?.offset,[0,0]);assert.deepEqual(received[1]?.offset,[20,0]);stop();
});

test('宿主移动、缩放、尺寸改变均刷新，卸载移除全部监听且只销毁一次',()=>{
 const listeners=new Map<MapOverlayEvent,()=>void>();let destroyed=0,step=0;
 const snapshots:MapOverlaySnapshot[]=[];
 const host:MapOverlayHost={snapshot:()=>({width:800+step,height:500,offset:[step,-step],project:()=>[100,200]}),subscribe:(event,fn)=>{listeners.set(event,fn);return ()=>{listeners.delete(event);};},destroy:()=>{destroyed++;}};
 const dispose=observeMapOverlayHost(host,s=>snapshots.push(s));assert.equal(snapshots.length,1);
 const late=listeners.get('moving')!;
 for(const event of ['moving','moveend','zoomend','resize'] as const){step++;listeners.get(event)!();}
 assert.deepEqual(snapshots.map(s=>s.width),[800,801,802,803,804]);
 assert.deepEqual(snapshots.at(-1)?.offset,[4,-4]);
 dispose();dispose();late();assert.equal(listeners.size,0);assert.equal(destroyed,1);assert.equal(snapshots.length,5);
});
test('零尺寸宿主等待 resize；订阅失败清理已注册资源',()=>{
 let width=0,count=0;const events=new Map<MapOverlayEvent,()=>void>();
 const stop=observeMapOverlayHost({snapshot:()=>({width,height:500,project:()=>[0,0]}),subscribe:(e,f)=>{events.set(e,f);return ()=>{events.delete(e);};},destroy:()=>{}},()=>{count++;});
 assert.equal(count,0);width=600;events.get('resize')!();assert.equal(count,1);stop();
 let cleaned=0,destroyed=0;
 assert.throws(()=>observeMapOverlayHost({snapshot:()=>{throw Error('not reached');},subscribe:e=>{if(e==='zoomend')throw Error('subscribe failed');return ()=>{cleaned++;};},destroy:()=>{destroyed++;}},()=>{}),/subscribe failed/);
 assert.equal(cleaned,2);assert.equal(destroyed,1);
});
