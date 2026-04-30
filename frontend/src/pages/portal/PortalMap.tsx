import { useState, useEffect, useMemo } from 'react';
import { useAuthPortal } from '../../contexts/AuthContext';
import { GlassCard } from '../../components/ui/GlassCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../api/client';
import { ArrowLeft, CheckCircle2, Minus, Plus, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EventMap } from '../../components/ui/EventMap';
import { LegalMarkdownBlock } from '../../components/ui/LegalMarkdownBlock';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { MapTable } from '../../api/types';

interface LegalDoc {
  id: string;
  documentType: 'DATA_POLICY' | 'EVENT_TERMS' | string;
  versionLabel: string;
  title: string;
  contentMarkdown?: string;
  status: string;
  publishedAt?: string | null;
}

// MapTable imported from types

interface MyGroup {
  groupId: string;
  eventId: string;
  approvedTicketCount: number;
  reservationStatus: string;
  currentPaymentId?: string | null;
  latestApprovedPaymentId?: string | null;
}

type ReservedCode = { participantId: string; code: string };
type ReservedAlloc = { layoutTableId: string; spotsReserved: number; code?: string };

interface ReservationConfirmation {
  reservationId: string;
  status: string;
  reservationCodes: ReservedCode[];
  allocations: ReservedAlloc[];
}

function pickLatest(docs: LegalDoc[], type: string): LegalDoc | undefined {
  return docs
    .filter((d) => d.documentType === type && d.status === 'PUBLISHED')
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))[0];
}

function tableId(t: MapTable): string {
  return t.id || t.layoutTableId || '';
}

function tableAvailable(t: MapTable): number {
  if (typeof t.availableSpots === 'number') return t.availableSpots;
  if (typeof t.available === 'number') return t.available;
  return Math.max(0, (t.capacity || 0) - (t.occupiedSpots ?? t.occupied ?? 0));
}
export const PortalMap = () => {
  const { session } = useAuthPortal();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [group, setGroup] = useState<MyGroup | null>(null);
  const [mapData, setMapData] = useState<{ tables: MapTable[]; layoutId?: string; backgroundImageUrl?: string | null } | null>(null);
  const [policyDoc, setPolicyDoc] = useState<LegalDoc | undefined>();
  const [termsDoc, setTermsDoc] = useState<LegalDoc | undefined>();
  const [loadError, setLoadError] = useState<string>('');

  const [selectedSpots, setSelectedSpots] = useState<Record<string, number>>({});

  const [showLegal, setShowLegal] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  const [confirmation, setConfirmation] = useState<ReservationConfirmation | null>(null);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const token = { token: session.sessionToken, isBearer: true, signal: controller.signal };

    const loadAll = async () => {
      try {
        const [groupRes, mapRes, legalRes] = await Promise.all([
          apiClient.get<MyGroup>(`/portal/events/${session.eventId}/my-group`, token),
          apiClient.get<{ tables: MapTable[]; layoutId?: string; backgroundImageUrl?: string | null }>(
            `/events/${session.eventId}/map`,
            token,
          ),
          apiClient
            .get<LegalDoc[]>(
              `/portal/events/${session.eventId}/published-legal-documents`,
              { signal: controller.signal },
            )
            .catch(() => [] as LegalDoc[]),
        ]);
        setGroup(groupRes);
        setMapData(mapRes);
        setPolicyDoc(pickLatest(legalRes, 'DATA_POLICY'));
        setTermsDoc(pickLatest(legalRes, 'EVENT_TERMS'));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo cargar el mapa';
        setLoadError(msg);
      }
    };
    loadAll();
    return () => controller.abort();
  }, [session]);

  const totalAssigned = useMemo(
    () => Object.values(selectedSpots).reduce((acc, n) => acc + n, 0),
    [selectedSpots],
  );
  const approved = group?.approvedTicketCount ?? 0;
  const reservationPaymentId =
    group?.latestApprovedPaymentId || group?.currentPaymentId || null;
  const canConfirm =
    totalAssigned > 0 &&
    totalAssigned === approved &&
    approved > 0 &&
    !!reservationPaymentId;

  const setSpots = (tid: string, next: number, maxAvailable: number) => {
    const remainingBudget = approved - totalAssigned + (selectedSpots[tid] || 0);
    const clamped = Math.max(0, Math.min(next, maxAvailable, remainingBudget));
    setSelectedSpots((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) delete copy[tid];
      else copy[tid] = clamped;
      return copy;
    });
  };

  const confirmReservation = async () => {
    if (!session || !reservationPaymentId || !policyDoc || !termsDoc) {
      setSubmitError(
        'Faltan datos para reservar: al menos una boleta aprobada, política y términos del evento.',
      );
      return;
    }
    setSubmitError('');
    setSubmitting(true);
    try {
      const allocations = Object.entries(selectedSpots).map(([tid, spots]) => ({
        layoutTableId: tid,
        spotsReserved: spots,
      }));

      const result = await apiClient.post<ReservationConfirmation & { id?: string }>(
        `/events/${session.eventId}/reservations`,
        {
          groupId: session.groupId,
          paymentId: reservationPaymentId,
          legalAcceptance: {
            accepted: true,
            policyDocumentId: policyDoc.id,
            termsDocumentId: termsDoc.id,
          },
          allocations,
        },
        { token: session.sessionToken, isBearer: true },
      );

      setConfirmation({
        reservationId: result.reservationId || (result.id as string),
        status: result.status,
        reservationCodes: result.reservationCodes || [],
        allocations: result.allocations || [],
      });
      setShowLegal(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo completar la reserva';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) return null;

  const tables = mapData?.tables || [];

  return (
    <div className="animate-slide-up" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate(`/portal/${session.eventId}/dashboard`)}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Selección de Mesa</h2>
      </div>

      {loadError && (
        <GlassCard style={{ marginBottom: '16px', borderLeft: '3px solid var(--error)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <AlertTriangle color="var(--error)" />
            <div>
              <strong>No se pudo cargar el mapa</strong>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{loadError}</div>
            </div>
          </div>
        </GlassCard>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : 'minmax(0, 2fr) minmax(260px, 1fr)',
          gap: '24px',
        }}
      >
        <GlassCard style={{ minHeight: '500px', position: 'relative', overflow: 'hidden' }}>
          <h3 style={{ marginBottom: '12px' }}>Layout del Salón</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 16px' }}>
            Toca una mesa para asignarle cupos. El total debe coincidir con tus {approved} boletas aprobadas.
          </p>

          <div
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '500px',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '0px',
              overflow: 'hidden'
            }}
          >
            {tables.length > 0 ? (
              <EventMap 
                tables={tables}
                isAdmin={false}
                selectedSpots={selectedSpots}
                backgroundImageUrl={mapData?.backgroundImageUrl || ''}
                onTableClick={(t) => {
                  const tid = t.id || t.layoutTableId || '';
                  const avail = Math.max(0, (t.capacity || 0) - (t.occupiedSpots ?? t.occupied ?? 0));
                  // If they click on it, and it's not selected, we select +1. If selected > 0, maybe they want to add more?
                  // To keep UI simple, let's keep the +/- buttons in the list. On Map click, if 0, assign 1 if possible.
                  const currentSelected = selectedSpots[tid] || 0;
                  if (currentSelected === 0 && avail > 0 && totalAssigned < approved) {
                    setSpots(tid, 1, avail);
                  }
                }}
              />
            ) : !loadError ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '120px' }}>
                Cargando mesas...
              </p>
            ) : null}
          </div>
        </GlassCard>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <GlassCard>
            <h3 style={{ marginBottom: '8px' }}>Tu Selección</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Total asignado: <strong>{totalAssigned}</strong> / {approved}
            </p>

            {Object.keys(selectedSpots).length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>
                No has seleccionado ninguna mesa.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '12px' }}>
                {Object.entries(selectedSpots).map(([tid, spots]) => {
                  const table = tables.find((t) => tableId(t) === tid);
                  const avail = tableAvailable(table!);
                  return (
                    <li
                      key={tid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border-light)',
                      }}
                    >
                      <span>Mesa {table?.code || tid.slice(0, 6)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         <button
                            onClick={() => setSpots(tid, spots - 1, avail)}
                            style={{
                              border: '1px solid var(--border-focus)',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              width: 26, height: 26, borderRadius: '50%',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          ><Minus size={14}/></button>
                         <strong style={{ minWidth: '18px', textAlign: 'center' }}>{spots}</strong>
                         <button
                            onClick={() => setSpots(tid, spots + 1, avail)}
                            disabled={avail <= 0 || totalAssigned >= approved}
                            style={{
                              border: 'none',
                              background: avail > 0 && totalAssigned < approved ? 'var(--accent-primary)' : 'var(--border-light)',
                              color: '#000',
                              width: 26, height: 26, borderRadius: '50%',
                              cursor: avail > 0 && totalAssigned < approved ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                          ><Plus size={14}/></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {!reservationPaymentId && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '12px' }}>
                Necesitas al menos una boleta aprobada antes de reservar.
              </p>
            )}
            {(!policyDoc || !termsDoc) && (
              <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '8px' }}>
                El evento aún no tiene política y términos publicados.
              </p>
            )}

            <Button
              style={{ width: '100%', marginTop: '20px' }}
              disabled={!canConfirm || !policyDoc || !termsDoc}
              onClick={() => {
                setLegalAccepted(false);
                setSubmitError('');
                setShowLegal(true);
              }}
            >
              Reservar Mesas
            </Button>
          </GlassCard>

          <GlassCard>
            <h4 style={{ margin: 0 }}>Estado del inventario</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(57,255,20,0.35)', border: '2px solid var(--accent-primary)' }} />
              <span style={{ fontSize: '0.85rem' }}>Disponible</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,193,7,0.35)', border: '2px solid #FFC107' }} />
              <span style={{ fontSize: '0.85rem' }}>Cupos limitados</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(255,0,0,0.35)', border: '2px solid var(--error)' }} />
              <span style={{ fontSize: '0.85rem' }}>Sin cupos</span>
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal isOpen={showLegal} onClose={() => setShowLegal(false)} title="Política y Términos del Evento">
        {policyDoc ? (
          <section style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 4px' }}>{policyDoc.title}</h4>
            <small style={{ color: 'var(--text-secondary)' }}>Versión {policyDoc.versionLabel}</small>
            <LegalMarkdownBlock content={policyDoc.contentMarkdown} />
          </section>
        ) : null}

        {termsDoc ? (
          <section style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 4px' }}>{termsDoc.title}</h4>
            <small style={{ color: 'var(--text-secondary)' }}>Versión {termsDoc.versionLabel}</small>
            <LegalMarkdownBlock content={termsDoc.contentMarkdown} />
          </section>
        ) : null}

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            cursor: 'pointer',
            marginBottom: '16px',
          }}
        >
          <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />
          <span>He leído y acepto la política de tratamiento de datos y los términos del evento.</span>
        </label>

        {submitError && (
          <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '12px' }}>
            {submitError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setShowLegal(false)}>
            Cancelar
          </Button>
          <Button
            onClick={confirmReservation}
            disabled={!legalAccepted || !canConfirm}
            isLoading={submitting}
          >
            Confirmar Reserva
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!confirmation}
        onClose={() => {
          setConfirmation(null);
          navigate(`/portal/${session.eventId}/dashboard`);
        }}
        title="¡Reserva Confirmada!"
      >
        {confirmation && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Estado: <strong>{confirmation.status}</strong>
              </p>
            </div>

            <h4 style={{ margin: '16px 0 8px' }}>Mesas asignadas</h4>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 0 }}>
              {confirmation.allocations.map((a) => {
                const t = tables.find((x) => tableId(x) === a.layoutTableId);
                return (
                  <li key={a.layoutTableId} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                    Mesa <strong>{t?.code || a.layoutTableId.slice(0, 6)}</strong> — {a.spotsReserved} cupo(s)
                  </li>
                );
              })}
            </ul>

            <h4 style={{ margin: '16px 0 8px' }}>Códigos por asistente</h4>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: 0 }}>
              {confirmation.reservationCodes.map((c) => (
                <li
                  key={c.participantId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--border-light)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {c.participantId.slice(0, 8)}…
                  </span>
                  <strong>{c.code}</strong>
                </li>
              ))}
            </ul>

            <Button
              style={{ width: '100%', marginTop: '20px' }}
              onClick={() => {
                setConfirmation(null);
                navigate(`/portal/${session.eventId}/dashboard`);
              }}
            >
              Ir al Dashboard
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
