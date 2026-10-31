import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  ClipboardList,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStaff } from '../../contexts/AuthContext';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { getEventPermissions } from '../../utils/staffPermissions';
import { getRememberedEventName } from '../../utils/eventNames';
import { Drawer } from '../ui/Drawer';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Rutas sin sesión operativa: se muestran centradas y sin navegación. */
const BARE_ROUTES = ['/staff/login', '/staff/no-tenant'];

const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-3)',
  minHeight: 'var(--target-min)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-sm)',
  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
  background: isActive ? 'var(--accent-primary-dim)' : 'transparent',
  fontWeight: isActive ? 600 : 500,
  fontSize: 'var(--text-sm)',
  textDecoration: 'none',
});

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  padding: 'var(--space-4) var(--space-3) var(--space-2)',
};

function useNavSections() {
  const { session } = useAuthStaff();
  const { pathname } = useLocation();
  const eventId = /^\/staff\/events\/([^/]+)\//.exec(pathname)?.[1];
  const currentEvent = eventId && eventId !== 'new' ? eventId : undefined;
  const perms = getEventPermissions(session, currentEvent);

  const general: NavItem[] = [{ to: '/staff/dashboard', label: 'Mis eventos', icon: LayoutDashboard }];
  if (perms.isAdmin) general.push({ to: '/staff/admin/staff-users', label: 'Gestión de staff', icon: UserCog });
  if (perms.isSuperAdmin) general.push({ to: '/staff/admin/system-users', label: 'Gestión de sistema', icon: ShieldCheck });

  const event: NavItem[] = [];
  if (currentEvent) {
    const base = `/staff/events/${currentEvent}`;
    if (perms.canViewOperations) {
      event.push(
        { to: `${base}/payments`, label: 'Revisión de pagos', icon: CreditCard },
        { to: `${base}/students`, label: 'Estudiantes', icon: Users },
        { to: `${base}/student-reservations`, label: 'Reservas', icon: ClipboardList },
      );
    }
    if (perms.canEditMap) event.push({ to: `${base}/map`, label: 'Diseño de plano', icon: LayoutTemplate });
    if (perms.canManageEvent) {
      event.push(
        { to: `${base}/policies`, label: 'Políticas', icon: FileText },
        { to: `${base}/manual-adjustments`, label: 'Ajustes', icon: Settings2 },
        { to: `${base}/audit`, label: 'Auditoría', icon: History },
        { to: `${base}/staff`, label: 'Staff del evento', icon: UserCog },
      );
    }
  }
  const eventName = currentEvent
    ? session?.eventAssignments?.find((a) => a.eventId === currentEvent)?.eventName ||
      getRememberedEventName(currentEvent)
    : undefined;
  return { general, event, eventName };
}

const StaffNav = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { session, logout } = useAuthStaff();
  const { general, event, eventName } = useNavSections();

  return (
    <nav aria-label="Navegación del staff" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        {general.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end style={navLinkStyle} onClick={onNavigate}>
              <item.icon size={18} aria-hidden="true" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {event.length > 0 && (
        <>
          <div style={sectionTitleStyle}>{eventName || 'Evento actual'}</div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {event.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} style={navLinkStyle} onClick={onNavigate}>
                  <item.icon size={18} aria-hidden="true" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-light)' }}>
        {session?.email && (
          <div
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              padding: '0 var(--space-3) var(--space-2)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={session.email}
          >
            {session.email}
          </div>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%', justifyContent: 'flex-start' }}>
          <LogOut size={16} aria-hidden="true" />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
};

const Brand = () => (
  <span style={{ color: 'var(--accent-text)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>Events Staff</span>
);

/**
 * Layout de la consola de staff.
 * - Login y "sin tenant": contenido centrado, sin navegación.
 * - Escritorio: barra lateral fija con navegación general y del evento actual.
 * - Celular (<= 768px): barra superior con menú que abre la navegación en un Drawer.
 */
export const StaffShell = ({ children }: { children: ReactNode }) => {
  const { session } = useAuthStaff();
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const bare = !session || BARE_ROUTES.some((r) => pathname.startsWith(r));

  if (bare) {
    return (
      <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: 'var(--space-5) var(--space-6)' }}>
          <Brand />
        </header>
        <main style={{ flex: 1, padding: '0 var(--space-4) var(--space-10)' }}>{children}</main>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header
          className="glass-panel"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 0,
            borderWidth: '0 0 1px 0',
          }}
        >
          <button
            type="button"
            className="icon-btn"
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <Brand />
        </header>
        <main style={{ flex: 1, padding: 'var(--space-4)', minWidth: 0 }}>{children}</main>
        <Drawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Menú" side="left" width={300}>
          <StaffNav onNavigate={() => setMenuOpen(false)} />
        </Drawer>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex' }}>
      <aside
        className="glass-panel"
        style={{
          width: '240px',
          flexShrink: 0,
          borderRadius: 0,
          borderWidth: '0 1px 0 0',
          padding: 'var(--space-5) var(--space-3)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ padding: '0 var(--space-3)' }}>
          <Brand />
        </div>
        <StaffNav />
      </aside>
      <main style={{ flex: 1, padding: 'var(--space-6)', minWidth: 0 }}>{children}</main>
    </div>
  );
};
