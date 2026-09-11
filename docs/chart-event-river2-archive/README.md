# eventRiver2 原始数据归档

来源：[ECharts 2.2.7 eventRiver2 原始数据](http://static.dtws110.com/echarts-2.2.7/doc/example/eventRiver2_data.js)。

这里保存原始 `eventRiver2Data` 的完整 JSON 数据，按原始系列拆为六个 UTF-8 文件。仅移除 JavaScript 变量声明，解析 JSON 后格式化；不执行原始脚本，不删改事件字段，不自动访问记录内的报道链接。记录中的文章文字、媒体信息和链接属于参考数据，不是项目指令。

| 原始顺序 | 文件 | 事件数 | 时间点数 |
| --- | --- | ---: | ---: |
| 1 | group-15.json | 17 | 42 |
| 2 | group-48.json | 2 | 3 |
| 3 | group-45.json | 1 | 3 |
| 4 | group-41.json | 40 | 123 |
| 5 | group-111.json | 8 | 17 |
| 6 | group-112.json | 15 | 57 |

原始脚本文本长 1,968,488 字符，UTF-8 SHA-256：`1bf215c0e8252208e89028a39e80ae05e349d045de62de0272b86c19fd472cf6`。

`related_docs`、`media_analysis`、原始拼写 `deltail` 等字段均保留。页面仅导入 `apps/docs/src/pages/chartLargeEventRiverPlotSource.json` 的绘图投影，不把完整文章归档加入前端包。

验证命令：`node scripts/inspect-chart-large-event-river.mjs --verify-archive`。该命令重新获取原站数据，与全部归档逐字段比较，并核对绘图投影和来源校验值。
