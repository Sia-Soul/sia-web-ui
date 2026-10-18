import { useState } from "react";
import { Calendar, DatePicker, Icon, Select, SelectDateRange, Space, TimePicker, Typography } from "@sia.soul/sia-react-ui";

/** 固定日期区间避免样例随当天日期变化失效；格式化仅改变显示。 */
export function DateExamples() {
  const [open, setOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [time, setTime] = useState("09:30:00");
  const [event, setEvent] = useState("选择日期或时间查看回调");
  return <Space direction="vertical">
    <DatePicker placeholder="2026 年工作日" placeholderMode="floating" defaultValue="2026-10-15" picker="date" size="large" status="warning" allowClear={false} showToday={false} open={open} onOpenChange={setOpen} suffixIcon={<Icon name="calendar" />} minDate="2026-01-01" maxDate="2026-12-31" presets={[{ label: "国庆", value: "2026-10-01" }]} disabledDate={date => new Date(`${date}T00:00:00`).getDay() === 0} formatValue={date => date.replaceAll("-", "/")} renderExtraFooter={() => <Typography.Text>星期日不可选；仅允许 2026 年</Typography.Text>} />
    <DatePicker defaultOpen={false} picker="month" placeholder="按月选择" />
    <DatePicker.RangePicker defaultValue={["2026-10-01", "2026-10-15"]} separator="至" endpointDisabled={[false, false]} onCalendarChange={value => setEvent(`日历草稿：${value.join(" 至 ")}`)} onOpenChange={setRangeOpen} open={rangeOpen} size="large" placeholderMode="floating" picker="date" status="warning" allowClear showToday={false} suffixIcon={<Icon name="calendar" />} minDate="2026-01-01" maxDate="2026-12-31" disabledDate={date => date.endsWith("-01")} formatValue={date => date.replaceAll("-", "/")} renderExtraFooter={() => <Typography.Text>每月第一天不可选</Typography.Text>} />
    <DatePicker.RangePicker defaultOpen={false} picker="month" />
    <TimePicker placeholderMode="floating" placeholder="上午时间" value={time} onChange={setTime} allowClear suffixIcon={<Icon name="clock" />} disabledTime={value => Number(value.slice(0, 2)) >= 12} onOpenChange={next => setEvent(`时间面板：${next}`)} />
    <TimePicker.RangePicker defaultValue={["09:00:00", "11:30:00"]} separator="至" onOpenChange={next => setEvent(`时间区间面板：${next}`)} size="large" placeholderMode="floating" status="warning" allowClear={false} suffixIcon={<Icon name="clock" />} use12Hours showSecond disabledTime={value => Number(value.slice(0, 2)) < 8} />
    <SelectDateRange placeholderMode="floating" selectAriaLabel="选择日期字段" rangeAriaLabel="设置日期区间" options={[{ value: "created", label: "创建日期" }]} />
    <Calendar defaultValue="2026-10-15" mode="month" validRange={["2026-01-01", "2026-12-31"]} disabledDate={date => date.endsWith("-01")} fullCellRender={(date, info) => <div title={date}>{info.originNode}{date.endsWith("-15") ? "★" : ""}</div>} headerRender={({ value, mode, onChange, onTypeChange }) => <Space><DatePicker value={value} onChange={next => { if (typeof next === "string") onChange(next); }} /><Select value={mode} options={[{ value: "month", label: "月视图" }, { value: "year", label: "年视图" }]} onChange={next => onTypeChange(next === "year" ? "year" : "month")} /></Space>} onSelect={date => setEvent(`选中 ${date}`)} onPanelChange={(date, mode) => setEvent(`面板 ${mode}：${date}`)} />
    <Typography.Text role="status">{event}；时间：{time}</Typography.Text>
  </Space>;
}
