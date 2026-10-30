import { createRoot } from 'react-dom/client';
import { Badge } from '../../packages/react/src/components/DataDisplay';
import { Button } from '../../packages/react/src/components/Button';
import '../../packages/react/src/styles.css';
import '../../packages/react/src/components-extra.css';

// 同一页面加载独立框架副本，复现热更新或多个发布入口重复初始化全局提示服务的场景。
const host = document.createElement('div');
host.style.cssText = 'padding:60px';
document.body.append(host);
createRoot(host).render(<Badge count={1} title="共 1 条"><Button>已启用</Button></Badge>);
