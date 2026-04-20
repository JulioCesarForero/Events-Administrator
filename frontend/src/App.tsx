import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Palette } from 'lucide-react';
import { PortalCodeLogin } from './pages/portal/PortalCodeLogin';
import { PortalDashboard } from './pages/portal/PortalDashboard';
import { PortalAttendees } from './pages/portal/PortalAttendees';
import { PortalPayment } from './pages/portal/PortalPayment';
import { PortalMap } from './pages/portal/PortalMap';
import { PortalPaymentStatus } from './pages/portal/PortalPaymentStatus';
import { PortalLanding } from './pages/portal/PortalLanding';
import { StaffLogin } from './pages/staff/StaffLogin';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { StaffPayments } from './pages/staff/StaffPayments';
import { StaffStudents } from './pages/staff/StaffStudents';
import { StaffPolicies } from './pages/staff/StaffPolicies';
import { StaffMap } from './pages/staff/StaffMap';
import { StaffEventWizard } from './pages/staff/StaffEventWizard';
import { StaffManualAdjustments } from './pages/staff/StaffManualAdjustments';
import { StaffAudit } from './pages/staff/StaffAudit';
import { RequireBuyerAuth, RequireStaffAuth } from './router/guards';

function ThemeSelector() {
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('app_theme') || 'theme-neon-green';
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  const themes = [
    { id: 'theme-neon-green', name: 'Verde Neón', color: '#39ff14' },
    { id: 'theme-neon-orange', name: 'Naranja Neón', color: '#ff5e00' },
    { id: 'theme-vibrant-blue', name: 'Azul Vibrante', color: '#00d4ff' },
    { id: 'theme-purple-neon', name: 'Púrpura', color: '#b500ff' },
  ];

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      <button
        aria-label="Cambiar tema visual"
        title="Cambiar tema"
        onClick={() => setOpen((v) => !v)}
        className="glass-panel"
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          padding: 0,
        }}
      >
        <Palette size={20} />
      </button>
      {open && (
        <div
          className="glass-panel animate-slide-up"
          style={{
            position: 'absolute',
            bottom: '52px',
            right: 0,
            padding: '10px',
            display: 'flex',
            gap: '8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {themes.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              title={t.name}
              aria-label={`Tema ${t.name}`}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: t.color,
                border: theme === t.id ? '2px solid white' : '2px solid transparent',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Pantallas placeholder de Layouts
const PortalLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-grid animate-fade-in" style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="glow-orb" style={{ top: '10%', left: '20%' }} />
      <div className="glow-orb" style={{ bottom: '20%', right: '10%', animationDelay: '2s' }} />
      <header className="glass-panel" style={{ padding: '20px', margin: '20px', borderRadius: 'var(--radius-lg)' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-primary)' }}>Portal de Eventos</h2>
      </header>
      <main style={{ padding: '0 20px 40px' }}>
        {children}
      </main>
    </div>
  );
};


const StaffLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="animate-fade-in" style={{ minHeight: '100vh', display: 'flex' }}>
    <aside className="glass-panel" style={{ width: '250px', borderRight: '1px solid var(--border-light)', borderRadius: 0 }}>
      <div style={{ padding: '24px' }}>
        <h3 style={{ color: 'var(--accent-primary)' }}>Events Staff</h3>
      </div>
    </aside>
    <main style={{ flex: 1, padding: '24px' }}>
      {children}
    </main>
  </div>
);

// App.tsx main definition

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSelector />
      <Routes>
        <Route path="/" element={<Navigate to="/portal" />} />
        
        <Route path="/portal" element={<PortalLayout><PortalLanding /></PortalLayout>} />
        
        {/* Portal Comprador */}
        <Route path="/portal/:eventId/*" element={
          <PortalLayout>
            <Routes>
              <Route path="login" element={<PortalCodeLogin />} />
              <Route path="dashboard" element={<RequireBuyerAuth><PortalDashboard /></RequireBuyerAuth>} />
              <Route path="attendees" element={<RequireBuyerAuth><PortalAttendees /></RequireBuyerAuth>} />
              <Route path="payment" element={<RequireBuyerAuth><PortalPayment /></RequireBuyerAuth>} />
              <Route path="payment-status" element={<RequireBuyerAuth><PortalPaymentStatus /></RequireBuyerAuth>} />
              <Route path="map" element={<RequireBuyerAuth><PortalMap /></RequireBuyerAuth>} />
              <Route path="" element={<Navigate to="login" />} />
            </Routes>
          </PortalLayout>
        } />
        
        {/* Staff Comité */}
        <Route path="/staff/*" element={
          <StaffLayout>
            <Routes>
              <Route path="login" element={<StaffLogin />} />
              <Route path="dashboard" element={<RequireStaffAuth><StaffDashboard /></RequireStaffAuth>} />
              <Route path="events/new" element={<RequireStaffAuth><StaffEventWizard /></RequireStaffAuth>} />
              <Route path="events/:eventId/payments" element={<RequireStaffAuth><StaffPayments /></RequireStaffAuth>} />
              <Route path="events/:eventId/students" element={<RequireStaffAuth><StaffStudents /></RequireStaffAuth>} />
              <Route path="events/:eventId/policies" element={<RequireStaffAuth><StaffPolicies /></RequireStaffAuth>} />
              <Route path="events/:eventId/map" element={<RequireStaffAuth><StaffMap /></RequireStaffAuth>} />
              <Route path="events/:eventId/manual-adjustments" element={<RequireStaffAuth><StaffManualAdjustments /></RequireStaffAuth>} />
              <Route path="events/:eventId/audit" element={<RequireStaffAuth><StaffAudit /></RequireStaffAuth>} />
              <Route path="" element={<Navigate to="login" />} />
            </Routes>
          </StaffLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
