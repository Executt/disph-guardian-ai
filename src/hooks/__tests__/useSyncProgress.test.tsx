import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

type StatusCb = (status: string) => void;

const h = vi.hoisted(() => ({
  subscribers: [] as StatusCb[],
  removed: 0,
  selectRows: [] as any[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = () => {
    const p: any = Promise.resolve({ data: h.selectRows, error: null });
    p.select = () => p; p.eq = () => p; p.gt = () => p; p.order = () => p; p.limit = () => p;
    return p;
  };
  return {
    supabase: {
      from: () => chain(),
      channel: () => {
        const ch: any = {
          on: () => ch,
          subscribe: (cb: StatusCb) => { h.subscribers.push(cb); return ch; },
        };
        return ch;
      },
      removeChannel: () => { h.removed++; },
    },
  };
});

import { useSyncProgress } from "@/hooks/useSyncProgress";

describe("useSyncProgress — WebSocket, reconexão e fallback para polling", () => {
  beforeEach(() => {
    h.subscribers = [];
    h.removed = 0;
    h.selectRows = [];
  });
  afterEach(() => vi.useRealTimers());

  it("usa WebSocket quando o canal conecta", async () => {
    const { result } = renderHook(() => useSyncProgress("ctir"));
    await waitFor(() => expect(h.subscribers.length).toBe(1));
    act(() => h.subscribers[0]("SUBSCRIBED"));
    await waitFor(() => expect(result.current.transport).toBe("websocket"));
  });

  it("cai para polling e tenta reconectar quando o canal falha", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = renderHook(() => useSyncProgress("ctir"));
    await waitFor(() => expect(h.subscribers.length).toBe(1));

    act(() => h.subscribers[0]("CHANNEL_ERROR"));
    await waitFor(() => expect(result.current.transport).toBe("polling"));
    expect(result.current.reconnects).toBe(1);

    // backoff dispara nova tentativa de conexão
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await waitFor(() => expect(h.subscribers.length).toBe(2));

    // reconectou: volta para websocket
    act(() => h.subscribers[1]("SUBSCRIBED"));
    await waitFor(() => expect(result.current.transport).toBe("websocket"));
  });

  it("recebe eventos via polling e deduplica por id", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.selectRows = [{
      id: "ev-1", source: "ctir", kind: "feed_error", severity: "error",
      message: "Falha", details: {}, created_at: new Date().toISOString(),
    }];

    const { result } = renderHook(() => useSyncProgress("ctir"));
    await waitFor(() => expect(h.subscribers.length).toBe(1));
    act(() => h.subscribers[0]("TIMED_OUT"));

    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    await waitFor(() => expect(result.current.events.length).toBe(1));

    await act(async () => { await vi.advanceTimersByTimeAsync(3500); });
    expect(result.current.events.length).toBe(1);
  });
});
