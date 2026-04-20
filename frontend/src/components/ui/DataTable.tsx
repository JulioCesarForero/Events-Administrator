import type { ReactNode } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  keyFn: (row: T) => string;
  emptyMessage?: ReactNode;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  keyFn,
  emptyMessage = 'Sin registros.',
  loading = false,
}: DataTableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  padding: '10px 12px',
                  fontWeight: 500,
                  width: c.width,
                  textAlign: c.align || 'left',
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                Cargando…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={keyFn(r)} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{ padding: '10px 12px', textAlign: c.align || 'left' }}
                >
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
