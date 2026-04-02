import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────

export type AppRole = "admin" | "operator" | "viewer" | "auditor";

export interface KeycloakUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roles: AppRole[];
  realm: string;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  avatar?: string;
  lastLogin?: string;
}

interface AuthState {
  user: KeycloakUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mfaPending: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; mfaRequired?: boolean; error?: string }>;
  verifyMfa: (totp: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
}

// ── Mock users (simula Keycloak realm "disph") ────────────────────

const MOCK_USERS: Record<string, { password: string; user: KeycloakUser; totpSecret: string }> = {
  admin: {
    password: "admin123",
    totpSecret: "JBSWY3DPEHPK3PXP",
    user: {
      id: "kc-001-admin",
      username: "admin",
      displayName: "Carlos Administrador",
      email: "admin@disph.gov.br",
      roles: ["admin", "operator"],
      realm: "disph",
      mfaEnabled: true,
      mfaVerified: false,
    },
  },
  operator: {
    password: "operator123",
    totpSecret: "JBSWY3DPEHPK3PXP",
    user: {
      id: "kc-002-operator",
      username: "operator",
      displayName: "Ana Operadora",
      email: "ana.operadora@disph.gov.br",
      roles: ["operator"],
      realm: "disph",
      mfaEnabled: true,
      mfaVerified: false,
    },
  },
  viewer: {
    password: "viewer123",
    totpSecret: "JBSWY3DPEHPK3PXP",
    user: {
      id: "kc-003-viewer",
      username: "viewer",
      displayName: "João Auditor",
      email: "joao.auditor@disph.gov.br",
      roles: ["viewer", "auditor"],
      realm: "disph",
      mfaEnabled: true,
      mfaVerified: false,
    },
  },
};

// ── TOTP mock (aceita qualquer 6 dígitos no mock) ─────────────────

function validateMockTotp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// ── Context ───────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const stored = localStorage.getItem("disph_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.user?.mfaVerified) {
          return { user: parsed.user, isAuthenticated: true, isLoading: false, mfaPending: false };
        }
      } catch { /* ignore */ }
    }
    return { user: null, isAuthenticated: false, isLoading: false, mfaPending: false };
  });

  // Persist session
  useEffect(() => {
    if (state.isAuthenticated && state.user) {
      localStorage.setItem("disph_auth", JSON.stringify({ user: state.user }));
    } else if (!state.mfaPending) {
      localStorage.removeItem("disph_auth");
    }
  }, [state.isAuthenticated, state.user, state.mfaPending]);

  const login = useCallback(async (username: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));

    // Simula latência de rede Keycloak
    await new Promise(r => setTimeout(r, 800));

    const entry = MOCK_USERS[username.toLowerCase()];
    if (!entry || entry.password !== password) {
      setState(s => ({ ...s, isLoading: false }));
      return { success: false, error: "Credenciais inválidas. Verifique usuário e senha." };
    }

    const user = { ...entry.user, lastLogin: new Date().toISOString() };

    if (user.mfaEnabled) {
      setState({ user, isAuthenticated: false, isLoading: false, mfaPending: true });
      return { success: true, mfaRequired: true };
    }

    setState({ user: { ...user, mfaVerified: true }, isAuthenticated: true, isLoading: false, mfaPending: false });
    return { success: true };
  }, []);

  const verifyMfa = useCallback(async (totp: string) => {
    setState(s => ({ ...s, isLoading: true }));
    await new Promise(r => setTimeout(r, 600));

    if (!validateMockTotp(totp)) {
      setState(s => ({ ...s, isLoading: false }));
      return { success: false, error: "Código TOTP inválido. Insira 6 dígitos." };
    }

    setState(s => ({
      ...s,
      user: s.user ? { ...s.user, mfaVerified: true } : null,
      isAuthenticated: true,
      isLoading: false,
      mfaPending: false,
    }));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("disph_auth");
    setState({ user: null, isAuthenticated: false, isLoading: false, mfaPending: false });
  }, []);

  const hasRole = useCallback((role: AppRole) => {
    return state.user?.roles.includes(role) ?? false;
  }, [state.user]);

  const hasAnyRole = useCallback((roles: AppRole[]) => {
    return roles.some(r => state.user?.roles.includes(r)) ?? false;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, verifyMfa, logout, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
