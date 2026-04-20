import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuthPortal, useAuthStaff } from '../contexts/AuthContext';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isExpired(payload: Record<string, unknown> | null): boolean {
  const exp = payload && typeof payload === 'object' ? payload.exp : undefined;
  if (typeof exp !== 'number') return false;
  return exp * 1000 < Date.now();
}

interface GuardProps {
  children: ReactNode;
}

/**
 * Protects `/portal/:eventId/*` routes. Redirects to `/portal/:eventId/login`
 * when there's no buyer session. Also rejects tokens bound to a different
 * `eventId` so deep links from another event cannot leak data.
 */
export const RequireBuyerAuth = ({ children }: GuardProps) => {
  const { session } = useAuthPortal();
  const { eventId } = useParams();

  if (!session) {
    return <Navigate to={`/portal/${eventId || ''}/login`} replace />;
  }

  const payload = decodeJwtPayload(session.sessionToken);
  if (isExpired(payload)) {
    return <Navigate to={`/portal/${eventId || ''}/login`} replace />;
  }

  const tokenEventId =
    (payload && typeof payload.event_id === 'string' && payload.event_id) ||
    undefined;
  if (eventId && tokenEventId && tokenEventId !== eventId) {
    return <Navigate to={`/portal/${tokenEventId}/dashboard`} replace />;
  }

  if (eventId && session.eventId !== eventId) {
    return <Navigate to={`/portal/${session.eventId}/dashboard`} replace />;
  }

  return <>{children}</>;
};

/**
 * Protects `/staff/*` routes. Redirects to `/staff/login` when the staff
 * session is missing or expired.
 */
export const RequireStaffAuth = ({ children }: GuardProps) => {
  const { session } = useAuthStaff();

  if (!session) {
    return <Navigate to="/staff/login" replace />;
  }

  const payload = decodeJwtPayload(session.accessToken);
  if (isExpired(payload)) {
    return <Navigate to="/staff/login" replace />;
  }

  return <>{children}</>;
};
