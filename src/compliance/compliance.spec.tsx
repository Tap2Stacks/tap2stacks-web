import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ComplianceBoundary } from "./ComplianceBoundary";
import { useComplianceStore } from "./store";
import { Header } from "../shell/Header";
import { authControllerLogin } from "../services/queries";
import { installApiRegionMonitor } from "./regionMonitor";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234", isConnected: true, chain: { id: 84532 } }),
  useConnect: () => ({ connect: vi.fn(), connectors: [] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "signature") }),
  useSwitchChain: () => ({}),
}));
vi.mock("../services/queries", () => ({
  authControllerGetChallenge: vi.fn(async () => ({ challenge: "challenge" })),
  authControllerLogin: vi.fn(async () => ({ accessToken: "token" })),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({ refetch: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  useComplianceStore.setState({ attested: false, gateOpen: true, blocked: false });
  vi.clearAllMocks();
});
afterEach(() => cleanup());

function confirm() {
  fireEvent.click(screen.getByLabelText("I am 18 or older"));
  fireEvent.click(screen.getByLabelText("I am not a US person and not in the US"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

it("sign-in stays disabled until both 18+ and not-US boxes are ticked", () => {
  render(<ComplianceBoundary><p>App</p></ComplianceBoundary>);
  const button = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("I am 18 or older"));
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("I am not a US person and not in the US"));
  expect(button.disabled).toBe(false);
});

it("login sends age18 and notUS after the gate", async () => {
  render(<MemoryRouter><ComplianceBoundary><Header /></ComplianceBoundary></MemoryRouter>);
  expect(authControllerLogin).not.toHaveBeenCalled();
  confirm();
  await waitFor(() => expect(authControllerLogin).toHaveBeenCalledTimes(1));
  const options = vi.mocked(authControllerLogin).mock.calls[0][0];
  expect(JSON.parse(options?.body as string)).toMatchObject({ age18: true, notUS: true });
});

it("ATTESTATION_REQUIRED reopens the gate", async () => {
  vi.mocked(authControllerLogin).mockRejectedValueOnce({
    response: { status: 403, data: { error: "ATTESTATION_REQUIRED" } },
  });
  render(<MemoryRouter><ComplianceBoundary><Header /></ComplianceBoundary></MemoryRouter>);
  confirm();
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy());
  confirm();
  await waitFor(() => expect(authControllerLogin).toHaveBeenCalledTimes(2));
});

it("API 451 response renders BlockedView", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => new Response(null, { status: 451 }));
  const uninstall = installApiRegionMonitor();
  render(<ComplianceBoundary><p>App</p></ComplianceBoundary>);
  await fetch("/api/prices/recent");
  await waitFor(() => expect(screen.getByText("tap2stacks is not available in your region.")).toBeTruthy());
  uninstall();
  globalThis.fetch = original;
});

it("blocks API retries after a regional response", async () => {
  const original = globalThis.fetch;
  const network = vi.fn(async () => new Response(null, { status: 451 }));
  globalThis.fetch = network;
  const uninstall = installApiRegionMonitor();
  try {
    await fetch("/api/prices/recent");
    const second = await fetch("/api/prices/recent");
    expect(second.status).toBe(451);
    expect(network).toHaveBeenCalledTimes(1);
  } finally {
    uninstall();
    globalThis.fetch = original;
  }
});

it("blocks on a 451 from the generated Axios client and does not send subsequent requests", async () => {
  const { AxiosError } = await import("axios");
  const { AXIOS_INSTANCE } = await import("../services/custom-client");
  const adapter = vi.fn(async (config) => {
    throw new AxiosError("blocked", "ERR_BAD_RESPONSE", config, undefined, {
      data: { error: "UNAVAILABLE_IN_REGION" }, status: 451, statusText: "Unavailable",
      headers: {}, config,
    });
  });
  const uninstall = installApiRegionMonitor();
  try {
    await expect(AXIOS_INSTANCE.get("/api/test", { adapter })).rejects.toBeTruthy();
    expect(useComplianceStore.getState().blocked).toBe(true);
    await expect(AXIOS_INSTANCE.get("/api/test", { adapter })).rejects.toBeTruthy();
    expect(adapter).toHaveBeenCalledTimes(1);
  } finally {
    uninstall();
  }
});

it("does not retry more than once when attestation is rejected again", async () => {
  const rejected = { response: { status: 403, data: { error: "ATTESTATION_REQUIRED" } } };
  vi.mocked(authControllerLogin).mockRejectedValueOnce(rejected).mockRejectedValueOnce(rejected);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  render(<MemoryRouter><ComplianceBoundary><Header /></ComplianceBoundary></MemoryRouter>);
  confirm();
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy());
  confirm();
  await waitFor(() => expect(authControllerLogin).toHaveBeenCalledTimes(2));
  expect(useComplianceStore.getState().gateOpen).toBe(false);
  consoleError.mockRestore();
});
