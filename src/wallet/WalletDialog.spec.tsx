import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletDialog } from "./WalletDialog";
const connectAsync = vi.fn(async () => ({}));
vi.mock("wagmi", () => ({ useConnect: () => ({ connectors: [
  { uid: "base", id: "baseAccount", name: "Base Account" },
  { uid: "mm", id: "io.metamask", type: "injected", name: "MetaMask" },
], connectAsync, isPending: false }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
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
});
