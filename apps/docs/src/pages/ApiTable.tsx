type ApiRow = {
  property: string;
  description: string;
  type: string;
  defaultValue: string;
};

type ApiTableProps = {
  name: string;
  rows: readonly ApiRow[];
};

export function ApiTable({ name, rows }: ApiTableProps) {
  return (
    <section className="api-panel">
      <h2>{name} API</h2>
      <div className="api-table" role="table" aria-label={`${name} API`}>
        <div className="api-table__head" role="row"><span>属性</span><span>说明</span><span>类型</span><span>默认值</span></div>
        {rows.map((row) => <div className="api-table__row" role="row" key={row.property}>
          <code>{row.property}</code><span>{row.description}</span><code>{row.type}</code><code>{row.defaultValue}</code>
        </div>)}
      </div>
    </section>
  );
}
