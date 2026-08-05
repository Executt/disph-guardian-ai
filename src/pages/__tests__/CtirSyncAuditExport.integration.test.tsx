import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

(globalThis as any).ResizeObserver = class {
  observe() {} unobserve() {} disconnect() {}
};

const iso = (d: Date) => d.toISOString();
const now = new Date();

// 25 execuções → 2 páginas (PAGE_SIZE = 20)
const auditFixture = Array.from({ length: 25 }, (_, i) => ({
  id: `run-${i}`,
  created_at: iso(new Date(now.getTime() - i * 3600_000)),
  action: "sync_ctir_advisories",
  details: {
    feeds_checked: 6,
    inserted: i,
    updated: 0,
    retries: i % 3,
    errors: i % 5 === 0 ? 1 : 0,
    duration_ms: 1000 + i * 100,
    trigger_source: i % 2 ? "manual" : "cron",
    failures: i % 5 === 0 ? [{ feed_url: `u${i}`, reason: "HTTP 503 após esgotar retentativas", attempts: 3 }] : [],
  },
}));

const alertsFixture = [
  { id: "al-1", source: "ctir", kind: "feed_error", severity: "error", message: "Falha no feed", details: { feed_url: "u0" }, created_at: iso(now), resolved_at: null },
  { id: "al-2", source: "ctir", kind: "retry", severity: "warning", message: "Tentativa 1 falhou", details: {}, created_at: iso(now), resolved_at: iso(now) },
];

vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: any[]) => {
    const p: any = Promise.resolve({ data: rows, error: null });
    p.select = () => p; p.eq = () => p; p.gte = () => p; p.gt = () => p;
    p.order = () => p; p.limit = () => p;
    return p;
  };
  return {
    supabase: {
      from: (table: string) =>
        chain(table === "audit_logs" ? auditFixture : table === "sync_alerts" ? alertsFixture : []),
      functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "auditor", roles: ["auditor"], mfaVerified: true },
    isAuthenticated: true,
    isLoading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

const ex = vi.hoisted(() => ({ csv: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/ctirAuditExport", () => ({
  exportCsv: ex.csv,
  exportPdf: ex.pdf,
}));

import CtirSyncAuditPage from "@/pages/CtirSyncAuditPage";

const renderPage = () => render(<MemoryRouter><CtirSyncAuditPage /></MemoryRouter>);

describe("Auditoria CTIR — exportação CSV/PDF", () => {
  beforeEach(() => { ex.csv.mockClear(); ex.pdf.mockClear(); });

  it("exporta todas as execuções filtradas em CSV com metadados dos filtros", async () => {
    renderPage();
    await screen.findByText("Execuções (25)");

    fireEvent.click(screen.getByRole("button", { name: /CSV/i }));

    await waitFor(() => expect(ex.csv).toHaveBeenCalled());
    const [headers, rows, meta] = ex.csv.mock.calls[0];
    expect(headers[0]).toBe("Data");
    expect(rows).toHaveLength(25);
    expect(meta).toMatchObject({ scope: "all", tab: "runs", year: "all", month: "all" });
  });

  it("respeita o escopo 'página atual' (paginação) na exportação PDF", async () => {
    renderPage();
    await screen.findByText("Execuções (25)");

    const scope = screen.getByLabelText("Escopo da exportação");
    await userEvent.click(scope);
    await userEvent.click(await screen.findByRole("option", { name: "Página atual" }));

    fireEvent.click(screen.getByRole("button", { name: /PDF/i }));

    await waitFor(() => expect(ex.pdf).toHaveBeenCalled());
    const [, rows, meta] = ex.pdf.mock.calls[0];
    expect(rows).toHaveLength(20);
    expect(meta).toMatchObject({ scope: "page", tab: "runs" });
  });

  it("exporta a aba de alertas aplicando o filtro de severidade", async () => {
    renderPage();
    const tab = await screen.findByRole("tab", { name: /Alertas \(2\)/ });
    await userEvent.click(tab);

    const sev = screen.getByLabelText("Severidade");
    await userEvent.click(sev);
    await userEvent.click(await screen.findByRole("option", { name: "error" }));

    fireEvent.click(screen.getByRole("button", { name: /CSV/i }));

    await waitFor(() => expect(ex.csv).toHaveBeenCalled());
    const [, rows, meta] = ex.csv.mock.calls[0];
    expect(meta).toMatchObject({ tab: "alerts", severity: "error" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("feed_error");
  });

  it("exibe KPIs de tempo médio, taxa de falhas e distribuição de motivos", async () => {
    renderPage();
    await screen.findByText("Execuções (25)");
    expect(screen.getByTestId("kpi-avg-duration")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-failure-rate")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-reason-dist")).toHaveTextContent("HTTP");
  });
});
