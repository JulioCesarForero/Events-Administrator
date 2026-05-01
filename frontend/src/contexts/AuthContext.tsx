import { createContext, useContext, useState } from 'react';

// --- PORTAL AUTH (Comprador) ---
export interface PortalSession {
  sessionToken: string;
  eventId: string;
  groupId: string;
  studentCode: string;
}

interface AuthPortalContextType {
  session: PortalSession | null;
  setSession: (session: PortalSession | null) => void;
  logout: () => void;
}

const AuthPortalContext = createContext<AuthPortalContextType | undefined>(undefined);

export const AuthPortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<PortalSession | null>(() => {
    const s = localStorage.getItem('portal_session');
    return s ? JSON.parse(s) : null;
  });

  const setSession = (s: PortalSession | null) => {
    setSessionState(s);
    if (s) {
      localStorage.setItem('portal_session', JSON.stringify(s));
    } else {
      localStorage.removeItem('portal_session');
    }
  };

  const logout = () => setSession(null);

  return (
    <AuthPortalContext.Provider value={{ session, setSession, logout }}>
      {children}
    </AuthPortalContext.Provider>
  );
};

export const useAuthPortal = () => {
  const ctx = useContext(AuthPortalContext);
  if (!ctx) throw new Error('useAuthPortal must be used within AuthPortalProvider');
  return ctx;
};

// --- STAFF AUTH (Comité) ---
export interface StaffSession {
  accessToken: string;
  userId: string;
  email: string;
  tenantId?: string;
  /**
   * Role of the user on their primary tenant membership.
   * `ADMIN` / `OWNER` unlock the tenant-admin CRUD for StaffUsers and
   * per-event assignments.
   */
  role?: string;
  eventAssignments?: Array<{ eventId: string; eventName: string; role: string }>;
}

interface AuthStaffContextType {
  session: StaffSession | null;
  setSession: (session: StaffSession | null) => void;
  logout: () => void;
}

const AuthStaffContext = createContext<AuthStaffContextType | undefined>(undefined);

export const AuthStaffProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSessionState] = useState<StaffSession | null>(() => {
    const s = localStorage.getItem('staff_session');
    return s ? JSON.parse(s) : null;
  });

  const setSession = (s: StaffSession | null) => {
    setSessionState(s);
    if (s) {
      localStorage.setItem('staff_session', JSON.stringify(s));
    } else {
      localStorage.removeItem('staff_session');
    }
  };

  const logout = () => setSession(null);

  return (
    <AuthStaffContext.Provider value={{ session, setSession, logout }}>
      {children}
    </AuthStaffContext.Provider>
  );
};

export const useAuthStaff = () => {
  const ctx = useContext(AuthStaffContext);
  if (!ctx) throw new Error('useAuthStaff must be used within AuthStaffProvider');
  return ctx;
};
