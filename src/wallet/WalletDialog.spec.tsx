import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletDialog } from "./WalletDialog";
const connectAsync = vi.fn(async () => ({}));
const emailApi = vi.hoisted(() => ({ currentUser: null, sendCode: vi.fn(async () => ({ flowId: "flow1" })), verifyCode: vi.fn(async () => ({})) }));
const startEmailWallet = vi.hoisted(() => vi.fn(async () => emailApi));
vi.mock("./emailRuntime", () => ({ startEmailWallet }));
vi.mock("wagmi", () => ({ useConnect: () => ({ connectors: [
  { uid: "base", id: "baseAccount", name: "Base Account" },
  { uid: "mm", id: "io.metamask", type: "injected", name: "MetaMask" },
  { uid: "email", id: "cdpEmail", type: "cdpEmail", name: "Email" },
], connectAsync, isPending: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe("wallet dialog", () => {
  it("lists wallets and connects the chosen browser wallet", async () => {
    const close = vi.fn();
    render(<WalletDialog open onClose={close} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Base Account/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "MetaMask" }));
    await waitFor(() => expect(connectAsync).toHaveBeenCalledWith({ connector: expect.objectContaining({ id: "io.metamask" }) }));
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
  it("shows account and network and disconnects", () => {
    const disconnect = vi.fn();
    render(<WalletDialog open onClose={vi.fn()} address="0x1234" network="Base Sepolia" onDisconnect={disconnect} />);
    expect(screen.getByText("0x1234")).toBeTruthy();
    expect(screen.getByText("Base Sepolia")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(disconnect).toHaveBeenCalledOnce();
  });
  it("hides email without a project ID, and completes the email code flow when configured", async () => {
    vi.stubEnv("VITE_CDP_PROJECT_ID", "");
    const { rerender } = render(<WalletDialog open onClose={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Continue with email" })).toBeNull();
    expect(startEmailWallet).not.toHaveBeenCalled();
    vi.stubEnv("VITE_CDP_PROJECT_ID", "project-123");
    const close = vi.fn();
    rerender(<WalletDialog open onClose={close} onDisconnect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    fireEvent.change(await screen.findByLabelText("Email address"), { target: { value: "test@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("Code sent to test@example.com"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));
    await waitFor(() => expect(emailApi.verifyCode).toHaveBeenCalledWith("flow1", "123456"));
    await waitFor(() => expect(connectAsync).toHaveBeenCalledWith({ connector: expect.objectContaining({ id: "cdpEmail" }) }));
    expect(startEmailWallet).toHaveBeenCalledWith("project-123");
    await waitFor(() => expect(close).toHaveBeenCalled());
  });
  it("copies the address and links to the current Base explorer", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<WalletDialog open onClose={vi.fn()} address="0x1234" chainId={84532} onDisconnect={vi.fn()} />);
    expect(screen.getByRole("link", { name: "View on explorer" }).getAttribute("href")).toBe("https://sepolia.basescan.org/address/0x1234");
    fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(writeText).toHaveBeenCalledWith("0x1234");
  });

});
