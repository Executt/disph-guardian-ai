import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ---- Fixtures ----
const advisoriesFixture = [
  {
    id: "adv-1",
    code: "CTIR-AL-2026-054",
    title: "Vulnerabilidade crítica no OpenSSH",
    kind: "alert",
    severity: "critical",
    category: "SSH",
    cves: ["CVE-2026-0001"],
    source: "CTIR Gov",
    source_url: "https://www.gov.br/ctir/x",
    published_at: "2026-06-01T10:00:00-03:00",
    description: "Falha crítica",
    synced_at: "2026-07-01T00:00:00Z",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    external_id: null,
  },
];

const h = vi.hoisted(() => ({
  currentAdvisories: [] as any[],
  invokeMock: vi.fn(),
}));

// ---- Supabase client mock ----
vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: any[]) => {
    const p: any = Promise.resolve({ data: rows, error: null });
    p.select = () => p;
    p.order = () => p;
    p.eq = () => p;
    p.gte = () => p;
    p.limit = () => p;
    p.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    return p;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "ctir_advisories") return chain(h.currentAdvisories);
        if (table === "monitored_environments") return chain([{ id: "env-1", name: "Prod", total_assets: 10 }]);
        if (table === "advisory_environment_assessments") return chain([]);
        if (table === "ctir_sync_state") return chain([]);
        return chain([]);
      },
      functions: { invoke: h.invokeMock },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
      removeChannel: () => {},
    },
  };
});

// ---- Auth mock (authenticated session) ----
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", username: "admin", roles: ["admin"], mfaVerified: true },
    isAuthenticated: true,
    isLoading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

import ARPage from "@/pages/ARPage";

function renderPage() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ARPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ARPage integration (autenticado)", () => {
  beforeEach(() => {
    h.currentAdvisories = advisoriesFixture;
    h.invokeMock.mockClear();
  });

  it("persiste e exibe advisories do Supabase", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/OpenSSH/i)).toBeInTheDocument();
    });
  });

  it("botão Sincronizar chama a edge function sync-ctir-advisories", async () => {
    renderPage();
    const btn = await screen.findByRole("button", { name: /Sincronizar com CTIR/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(h.invokeMock).toHaveBeenCalledWith("sync-ctir-advisories", expect.any(Object));
    });
  });

  it("exibe estado adequado quando não há advisories", async () => {
    h.currentAdvisories = [];
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText(/OpenSSH/i)).not.toBeInTheDocument();
    });
  });

  it("exibe toast em falha de invoke", async () => {
    const { toast } = await import("@/hooks/use-toast");
    h.invokeMock.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    renderPage();
    const btn = await screen.findByRole("button", { name: /Sincronizar com CTIR/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect((toast as any)).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    });
  });
});
