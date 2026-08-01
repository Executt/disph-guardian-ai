import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

(globalThis as any).ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
};

const now = new Date().toISOString();

const auditFixture = [
  {
    id: "run-1",
    created_at: now,
    action: "sync_ctir_advisories",
    details: {
      feeds_checked: 6, feeds_changed: 2, inserted: 5, updated: 1,
      retries: 2, errors: 0, duration_ms: 1234, trigger_source: "cron",
    },
  },
  {
    id: "run-2",
    created_at: now,
    action: "sync_ctir_advisories",
    details: {
      feeds_checked: 6, inserted: 0, updated: 0, retries: 3, errors: 2,
      duration_ms: 4321, trigger_source: "manual",
      failures: [{ feed_url: "u", reason: "HTTP 503 após esgotar retentativas", attempts: 3 }],
    },
  },
];

const alertsFixture = [
  {
    id: "al-1", source: "ctir", kind: "feed_error", severity: "error",
    message: "Falha ao processar feed 2026", details: {}, created_at: now, resolved_at: null,
  },
  {
    id: "al-2", source: "ctir", kind: "retry", severity: "warning",
    message: "Tentativa 1 falhou", details: {}, created_at: now, resolved_at: now,
  },
];

const h = vi.hoisted(() => ({ invokeMock: vi.fn().mockResolvedValue({ data: { ok: true, inserted: 3, updated: 0, errors: 0, retries: 0, feeds_checked: 6 }, error: null }) }));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: any[]) => {
    const p: any = Promise.resolve({ data: rows, error: null });
    p.select = () => p; p.eq = () => p; p.gte = () => p;
    p.order = () => p; p.limit = () => p;
    return p;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "audit_logs") return chain(auditFixture);
        if (table === "sync_alerts") return chain(alertsFixture);
        return chain([]);
      },
      functions: { invoke: h.invokeMock },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "admin", roles: ["admin"], mfaVerified: true },
    isAuthenticated: true,
    isLoading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

import CtirSyncAuditPage from "@/pages/CtirSyncAuditPage";

const renderPage = () =>
  render(<MemoryRouter><CtirSyncAuditPage /></MemoryRouter>);

describe("CtirSyncAuditPage (sessão autenticada)", () => {
  beforeEach(() => { h.invokeMock.mockClear(); });

  it("renderiza os KPIs de execução", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Execuções")).toBeInTheDocument();
    });
    expect(screen.getByText("Sucesso")).toBeInTheDocument();
    expect(screen.getByText("Com falhas")).toBeInTheDocument();
    expect(screen.getByText("Retentativas")).toBeInTheDocument();
    // 2 execuções carregadas, 1 com erro
    await waitFor(() => expect(screen.getByText("Execuções (2)")).toBeInTheDocument());
  });

  it("renderiza a tabela de execuções com detalhes da run", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("cron")).toBeInTheDocument();
    });
    expect(screen.getByText("1234ms")).toBeInTheDocument();
    expect(screen.getByText("4321ms")).toBeInTheDocument();
  });

  it("renderiza a aba de alertas com tipo e severidade", async () => {
    renderPage();
    const tab = await screen.findByRole("tab", { name: /Alertas \(2\)/ });
    fireEvent.click(tab);
    await waitFor(() => {
      expect(screen.getByText("feed_error")).toBeInTheDocument();
    });
    expect(screen.getByText("Falha ao processar feed 2026")).toBeInTheDocument();
    expect(screen.getByText("resolvido")).toBeInTheDocument();
  });

  it("botão Executar CTIR agora dispara a edge function e mostra progresso", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: /Executar CTIR agora/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(h.invokeMock).toHaveBeenCalledWith(
        "sync-ctir-advisories",
        expect.objectContaining({ body: expect.objectContaining({ trigger_source: "manual" }) }),
      );
    });
    await waitFor(() => expect(screen.getByTestId("run-progress")).toBeInTheDocument());
  });
});
