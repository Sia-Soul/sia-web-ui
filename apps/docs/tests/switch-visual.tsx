import React from 'react';
import { createRoot } from 'react-dom/client';
import { Switch } from '@sia.soul/sia-react-ui';
import '@sia.soul/sia-react-ui/styles.css';
/** 检查标准开关各尺寸、开关状态及禁用状态的圆点边缘和留白。 */
createRoot(document.getElementById('root')!).render(<div style={{padding:24,display:'grid',gap:20}}>{(['small','medium','large'] as const).map(size=><div key={size} style={{display:'flex',gap:24,alignItems:'center'}}>{size}<Switch size={size}/><Switch size={size} defaultChecked/><Switch size={size} defaultChecked disabled/></div>)}</div>);