import {useState} from 'react';
import {Button, XYChart} from '@sia-ui/react';
import {createLineTimeData, lineTimeSymbolRadius} from './chartLineTimeData';
import source from './chartLineTimeSource.json';

export function LineTimeReferencePreview() {
  const [data, setData] = useState(() => createLineTimeData());
  const [replay, setReplay] = useState(0);
  const option = source[0]!.option;
  return <>
    <div className="chart-parity__controls"><Button onClick={() => setReplay(value => value + 1)}>重播入场动画</Button><Button onClick={() => {setData(createLineTimeData()); setReplay(value => value + 1);}}>重新生成原站随机数据</Button></div>
    <div className="chart-parity__viewport">
      <XYChart key={replay} title={option.title.text} description={option.title.subtext}
        ariaLabel="line8 时间坐标折线图" width={663} height={379} xAxisType="time"
        series={[{name: 'series1', data, curve: 'straight', symbolRadius: lineTimeSymbolRadius}]}
        dataZoom defaultZoom={[70, 100]} animationDuration={2000}
        xFormatter={value => {const date = new Date(value); return `${date.getFullYear()}-${date.getMonth()+1}`;}}
        tooltipFormatter={point => {const date = new Date(point[0]); return <>{`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`}<br/>{point[1]}, {point[2]}</>;}}
        toolbox={{features: ['mark', 'dataView', 'restore', 'saveAsImage'], dataViewReadOnly: false}}/>
    </div>
    <p className="chart-parity__status">开发中：保留 200 个时间/数值/大小三元组及原站随机生成规则，默认显示后 30% 时间范围，支持变尺寸符号、提示、缩放、数据编辑和还原。待核对：时间轴智能格式、缩放边界、工具箱细节及逐帧入场动画；不计入完整一致性通过数量。</p>
  </>;
}
