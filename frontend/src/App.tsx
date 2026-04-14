import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PortalCodeLogin } from './pages/portal/PortalCodeLogin';
import { PortalDashboard } from './pages/portal/PortalDashboard';
import { PortalAttendees } from './pages/portal/PortalAttendees';
import { PortalPayment } from './pages/portal/PortalPayment';
import { PortalMap } from './pages/portal/PortalMap';
import { StaffLogin } from './pages/staff/StaffLogin';
import { StaffDashboard } from './pages/staff/StaffDashboard';
import { StaffPayments } from './pages/staff/StaffPayments';
import { StaffImport } from './pages/staff/StaffImport';
import { StaffPolicies } from './pages/staff/StaffPolicies';
import { StaffMap } from './pages/staff/StaffMap';
import { StaffEventWizard } from './pages/staff/StaffEventWizard';

function ThemeSelector() {
  const [theme, setTheme] = useState('theme-neon-green');

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const themes = [
    { id: 'theme-neon-green', name: 'Verde Neón', color: '#39ff14' },
    { id: 'theme-neon-orange', name: 'Naranja Neón', color: '#ff5e00' },
    { id: 'theme-vibrant-blue', name: 'Azul Vibrante', color: '#00d4ff' },
    { id: 'theme-purple-neon', name: 'Púrpura', color: '#b500ff' },
  ];

  return (
    <div className="glass-panel" style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', gap: '8px', zIndex: 1000, padding: '8px', borderRadius: 'var(--radius-full)' }}>
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.name}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: t.color,
            border: theme === t.id ? '2px solid white' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        />
      ))}
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
        
        <Route path="/portal" element={<Navigate to="/portal/demo-event/login" />} />
        
        {/* Portal Comprador */}
        <Route path="/portal/:eventId/*" element={
          <PortalLayout>
            <Routes>
              <Route path="login" element={<PortalCodeLogin />} />
              <Route path="dashboard" element={<PortalDashboard />} />
              <Route path="attendees" element={<PortalAttendees />} />
              <Route path="payment" element={<PortalPayment />} />
              <Route path="map" element={<PortalMap />} />
              <Route path="" element={<Navigate to="login" />} />
            </Routes>
          </PortalLayout>
        } />
        
        {/* Staff Comité */}
        <Route path="/staff/*" element={
          <StaffLayout>
            <Routes>
              <Route path="login" element={<StaffLogin />} />
              <Route path="dashboard" element={<StaffDashboard />} />
              <Route path="events/:eventId/payments" element={<StaffPayments />} />
              <Route path="events/new" element={<StaffEventWizard />} />
              <Route path="events/:eventId/import" element={<StaffImport />} />
              <Route path="events/:eventId/policies" element={<StaffPolicies />} />
              <Route path="events/:eventId/map" element={<StaffMap />} />
              <Route path="" element={<Navigate to="login" />} />
            </Routes>
          </StaffLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
