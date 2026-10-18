import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Table, createSummaryPlugin } from '@sia.soul/sia-react-ui';
import '@sia.soul/sia-react-ui/styles.css';

/** 验证空数据、重新加载及改变容器高度时，空态不覆盖合计。 */
function Fixture() {
  const [count, setCount] = useState(0);
  return <><button onClick={() => setCount(count ? 0 : 2)}>切换数据</button>
    <div id="container" style={{ height: 420 }}><Table id="table" height="100%" showIndex={false}
      columns={[{ key: 'name', name: '名称', flex: 1 }, { key: 'value', name: '数值', flex: 1 }]}
      dataSource={Array.from({ length: count }, (_, id) => ({ id, name: `记录${id}`, value: 2 }))}
      plugins={[createSummaryPlugin({ subTotalLabel: '合计', subTotal: { value: count * 2 }, total: { value: count * 2 } })]} />
    </div></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
