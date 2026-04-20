import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../../components/ui/GlassCard';
import { apiClient } from '../../api/client';
import { ArrowLeft, Search, AlertTriangle } from 'lucide-react';

interface AuditEntry {
  id: string;
  occurredAt: string;
  actorType: string;
  entityType: string;
  entityId: string | null;
  action: string;
  payloadJson?: Record<string, unknown> | null;
}

export const StaffAudit = () => {
  const { session } = useAuthStaff();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState<'ALL' | 'BUYER' | 'STAFF' | 'SYSTEM'>('ALL');

  const load = useCallback(async () => {
    if (!session || !eventId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<AuditEntry[]>(
        `/events/${eventId}/audit-log`,
        { token: session.accessToken, isBearer: true },
      );
      setRows(res || []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo cargar la auditoría';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [session, eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (actorFilter !== 'ALL' && r.actorType !== actorFilter) return false;
      if (!term) return true;
      const haystack = [
        r.action,
        r.entityType,
        r.entityId || '',
        JSON.stringify(r.payloadJson || {}),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, actorFilter, search]);

  if (!session) return null;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/staff/dashboard')}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Auditoría del evento</h2>
      </div>

      {error && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertTriangle color="var(--error)" />
            <span style={{ color: 'var(--text-secondary)' }}>{error}</span>
          </div>
        </GlassCard>
      )}

      <GlassCard style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1 1 260px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            border: '1px solid var(--border-light)',
          }}
        >
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Buscar acción, entidad, payload…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              padding: '10px 0',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Actor</label>
          <select
            className="glass-input"
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value as typeof actorFilter)}
          >
            <option value="ALL">Todos</option>
            <option value="BUYER">Comprador</option>
            <option value="STAFF">Comité</option>
            <option value="SYSTEM">Sistema</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Fecha</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Actor</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Entidad</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Acción</th>
                <th style={{ padding: '10px 12px', fontWeight: 500 }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Sin registros con los filtros actuales.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                    {new Date(r.occurredAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 12px' }}>{r.actorType}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{r.entityType}</div>
                    {r.entityId && (
                      <small style={{ color: 'var(--text-muted)' }}>{r.entityId.slice(0, 8)}…</small>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <code style={{ color: 'var(--accent-primary)' }}>{r.action}</code>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {r.payloadJson ? JSON.stringify(r.payloadJson).slice(0, 140) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
