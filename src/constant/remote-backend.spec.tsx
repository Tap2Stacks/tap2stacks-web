import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REMOTE_BACKEND = "https://example-backend.fly.dev";

describe("remote backend configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_BACKEND_URL", REMOTE_BACKEND);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("BACKEND_URL and AXIOS_INSTANCE resolve all REST URLs to VITE_BACKEND_URL", async () => {
    const { BACKEND_URL } = await import("./index");
    const { AXIOS_INSTANCE } = await import("../services/custom-client");

    expect(BACKEND_URL).toBe(REMOTE_BACKEND);
    expect(AXIOS_INSTANCE.defaults.baseURL).toBe(`${REMOTE_BACKEND}/`);
    expect(AXIOS_INSTANCE.getUri({ url: "/api/orders/user" })).toBe(
      `${REMOTE_BACKEND}/api/orders/user`,
    );
  });

  it("fetchRecentPrices and getRecentFeed call VITE_BACKEND_URL", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ points: [] }), { status: 200 }));

    const { fetchRecentPrices } = await import("../api/prices");
    const { getRecentFeed } = await import("../api/feed");

    await fetchRecentPrices("NVDA");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/example-backend\.fly\.dev\/api\/prices\/recent\?ticker=NVDA/),
    );

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    await getRecentFeed(10);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      `${REMOTE_BACKEND}/api/feed/recent?limit=10`,
    );
  });

  it("useRealtime connects socket.io client to VITE_BACKEND_URL", async () => {
    const ioMock = vi.fn(() => ({
      on: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    }));
    vi.doMock("socket.io-client", () => ({ io: ioMock }));
    vi.doMock("wagmi", () => ({
      useAccount: () => ({ address: undefined, isConnected: false }),
    }));

    const { useRealtime } = await import("../realtime/useRealtime");
    const qc = new QueryClient();
    renderHook(() => useRealtime(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      ),
    });

    expect(ioMock).toHaveBeenCalledWith(REMOTE_BACKEND);
  });

  it("useSponsoredCalls sends paymasterService URL on VITE_BACKEND_URL", async () => {
    const sendCallsAsync = vi.fn(async () => ({ id: "0xcall" }));
    vi.doMock("@wagmi/core", () => ({
      waitForCallsStatus: vi.fn(async () => ({})),
      waitForTransactionReceipt: vi.fn(async () => ({})),
    }));
    vi.doMock("wagmi", () => ({
      useAccount: () => ({ address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
      useConfig: () => ({ chains: [{ id: 84532 }] }),
      useCapabilities: () => ({ data: { 84532: { paymasterService: { supported: true } } } }),
      useSendCalls: () => ({ sendCallsAsync }),
      useWriteContract: () => ({ writeContractAsync: vi.fn() }),
      useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
    }));
    vi.doMock("../services/paymaster", () => ({
      fetchPaymasterToken: vi.fn(async () => ({
        token: "pm-tok",
        expiresAt: Date.now() + 300_000,
      })),
    }));

    const { useSponsoredCalls, clearPaymasterTokenCache } = await import(
      "../hooks/useSponsoredCalls"
    );
    clearPaymasterTokenCache();
    const { result } = renderHook(() => useSponsoredCalls());
    await act(async () => {
      await result.current.send([
        { to: "0x1111111111111111111111111111111111111111", data: "0xde5f72fd" },
      ]);
    });

    expect(sendCallsAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilities: {
          paymasterService: {
            url: `${REMOTE_BACKEND}/api/paymaster/t/pm-tok`,
          },
        },
      }),
    );
  });

  it("useProofs and ProofsView use VITE_BACKEND_URL for API and price-log download links", async () => {
    const axiosGet = vi.fn(async () => ({
      data: [
        {
          index: 7,
          fromMs: 1000,
          toMs: 2000,
          tapsRoot: "0x1234",
          priceLogHash: "0x5678",
          txHash: "0xabcd",
        },
      ],
    }));
    vi.doMock("axios", () => ({
      default: {
        get: axiosGet,
        create: vi.fn(() => ({
          interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
        })),
        isAxiosError: vi.fn(() => false),
      },
    }));

    const { ProofsView } = await import("../ProofsView");
    const { container } = render(
      <MemoryRouter>
        <ProofsView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(axiosGet).toHaveBeenCalledWith(
        `${REMOTE_BACKEND}/api/proofs?limit=20&offset=0`,
      );
    });
    const link = container.querySelector(
      `a[href="${REMOTE_BACKEND}/api/proofs/7/price-log"]`,
    );
    expect(link).toBeTruthy();
  });

  it("vercel.json keeps SPA rewrite, caches /assets/*, and sets popup-safe COOP header", () => {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    const cfg = JSON.parse(raw) as {
      rewrites?: Array<{ source: string; destination: string }>;
      headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    };

    expect(cfg.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });

    const assetsRule = cfg.headers?.find((h) => h.source === "/assets/(.*)");
    expect(assetsRule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });

    const allHeaders = cfg.headers?.flatMap((h) => h.headers) ?? [];
    expect(allHeaders).toContainEqual({
      key: "Cross-Origin-Opener-Policy",
      value: "same-origin-allow-popups",
    });
    expect(
      allHeaders.some(
        (h) =>
          h.key.toLowerCase() === "cross-origin-opener-policy" &&
          h.value === "same-origin",
      ),
    ).toBe(false);
  });
});
