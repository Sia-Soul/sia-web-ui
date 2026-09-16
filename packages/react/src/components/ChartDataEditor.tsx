import { useState } from "react";
import { Button } from "./Button";
import { TextArea } from "./TextArea";

/** 图表数据编辑器的属性配置。 */
export interface ChartDataEditorProps<T extends number|null=number> {
  /** 图表数据系列。 */
  series: readonly {
  /** 名称或字段标识。 */
  name: string;
  /** 用于渲染的数据集合。 */
  data: readonly T[] }[];
  /** 用户应用修改时调用。 */
  onApply: (values: T[][]) => void;
  /**
   * 是否允许空值。
   * @defaultValue false
   */
  allowNull?: boolean;
  /**
   * 是否只读，禁止编辑数据。
   * @defaultValue false
   */
  readOnly?: boolean;
}

/** Numeric data editor. JSON is parsed as data, never evaluated as JavaScript. */
export function ChartDataEditor<T extends number|null=number>({ series, onApply, readOnly = false,allowNull=false }: ChartDataEditorProps<T>) {
  const [draft, setDraft] = useState(() => JSON.stringify(series.map(item => item.data), null, 2));
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  function apply() {
    try {
      const values: unknown = JSON.parse(draft);
      if (!Array.isArray(values) || values.length !== series.length || values.some((row,index) => !Array.isArray(row) || row.length !== series[index]!.data.length || row.some(value=>!(allowNull&&value===null)&&(typeof value !== "number" || !Number.isFinite(value))))) {
        throw new Error(`请保留系列数量和每组数据长度，所有数据必须为有限数字${allowNull?'或 null 空值':''}。`);
      }
      onApply(values as T[][]);
      setError(""); setApplied(true);
    } catch (reason) { setError(reason instanceof SyntaxError ? "JSON 格式不正确，请检查逗号和括号。" : (reason as Error).message); setApplied(false); }
  }
  return <div className="sia-chart-data-editor">
    <p>系列顺序：{series.map(item=>item.name).join("、")}</p>
    <TextArea aria-label="图表数值数据" rows={10} value={draft} readOnly={readOnly} status={error ? "error" : "default"} onChange={event=>{setDraft(event.target.value);setApplied(false);}} />
    {error ? <p role="alert">{error}</p> : null}
    {!readOnly ? <Button onClick={apply}>应用数据</Button> : null}
    {applied ? <p role="status">数据已应用</p> : null}
  </div>;
}
