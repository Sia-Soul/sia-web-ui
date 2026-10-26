import type { TableColumn } from "./types";

// TSV 按 Excel 的引号转义解析，保留单元格内换行、制表符和前导零。
export function parseWorksheetText(text: string): string[][] {
  const rows: string[][] = [[]];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && (quoted || value === "")) {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (char === "\t" || char === "\n" || char === "\r")) {
      rows[rows.length - 1].push(value);
      value = "";
      if (char !== "\t") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        rows.push([]);
      }
    } else value += char;
  }
  rows[rows.length - 1].push(value);
  if (
    /\r?\n$/.test(text) &&
    rows.length > 1 &&
    rows.at(-1)?.length === 1 &&
    rows.at(-1)?.[0] === ""
  )
    rows.pop();
  return rows;
}

export function worksheetText(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[\t\r\n"]/.test(text)
            ? `"${text.replaceAll('"', '""')}"`
            : text;
        })
        .join("\t")
    )
    .join("\n");
}

// 不更改原记录或嵌套对象，拒绝危险路径，避免外部列配置污染对象原型。
export function setWorksheetValue<T>(
  record: T,
  column: TableColumn<T>,
  value: unknown
): T {
  const path = Array.isArray(column.dataIndex)
    ? column.dataIndex
    : String(column.dataIndex ?? column.code ?? column.key).split(".");
  if (
    !path.length ||
    path.some((key) => ["__proto__", "prototype", "constructor"].includes(key))
  )
    return record;
  const update = (source: unknown, index: number): unknown => {
    const copy = (
      Array.isArray(source)
        ? [...source]
        : { ...(source && typeof source === "object" ? source : {}) }
    ) as Record<string, unknown>;
    copy[path[index]] =
      index === path.length - 1 ? value : update(copy[path[index]], index + 1);
    return copy;
  };
  return update(record, 0) as T;
}

// 与款式导入一致：按末尾数字递增，保留字符串前缀、后缀、前导零和小数位。
export function incrementWorksheetValue(
  value: unknown,
  offset: number
): unknown {
  if (typeof value === "number")
    return Number.isFinite(value) ? value + offset : value;
  if (typeof value !== "string") return value;
  const match = value.match(/^(.*?)(\d+(?:\.\d+)?)([^\d]*)$/);
  if (!match) return value;
  const [, prefix, number, suffix] = match;
  const [integer, decimal = ""] = number.split(".");
  const next = Number(number) + offset;
  if (!Number.isFinite(next)) return value;
  const result = decimal
    ? next.toFixed(decimal.length)
    : String(Math.trunc(next));
  const [whole, fraction] = result.split(".");
  const signed = whole.startsWith("-");
  const digits = signed ? whole.slice(1) : whole;
  const padded =
    integer.length > 1 && integer.startsWith("0")
      ? digits.padStart(integer.length, "0")
      : digits;
  return `${prefix}${signed ? "-" : ""}${padded}${
    fraction === undefined ? "" : `.${fraction}`
  }${suffix}`;
}
