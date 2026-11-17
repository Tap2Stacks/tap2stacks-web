import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store";

const mockSwitchChainAsync = vi.fn();
const mockSendCallsAsync = vi.fn();
const mockWriteContractAsync = vi.fn();
const mockSendTransactionAsync = vi.fn();
const mockRefetchReads = vi.fn();
const mockRefetchBalance = vi.fn();
const mockRequestWithdrawal = vi.fn();
const mockFetchPaymasterToken = vi.fn();
const { mockToast } = vi.hoisted(() => ({
  mockToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

let mockAccountState: {
  address?: `0x${string}`;
  isConnected: boolean;
  chain?: { id: number; name: string };
} = {
  address: "0x1111111111111111111111111111111111111111",
  isConnected: true,
  chain: { id: 84532, name: "Base Sepolia" },
};
let mockCapabilitiesData: unknown = undefined;
let mockReadsData: Array<{ status: string; result?: bigint }> = [
  { status: "success", result: 50_000_000n },
  { status: "success", result: 0n },
];
let mockOffChainBalance = { free: "25" };

vi.mock("react-hot-toast", () => ({
  default: mockToast,
  toast: mockToast,
}));

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
  useConfig: () => ({ chains: [{ id: 84532 }] }),
  useSwitchChain: () => ({
    switchChainAsync: mockSwitchChainAsync,
    isPending: false,
  }),
  useReadContracts: () => ({
    data: mockReadsData,
    refetch: mockRefetchReads,
  }),
  useCapabilities: () => ({ data: mockCapabilitiesData }),
  useSendCalls: () => ({ sendCallsAsync: mockSendCallsAsync }),
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
  useSendTransaction: () => ({
    sendTransactionAsync: mockSendTransactionAsync,
  }),
}));

vi.mock("@wagmi/core", () => ({
  waitForCallsStatus: vi.fn(async () => ({ status: "success" })),
  waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
}));

vi.mock("../services/paymaster", () => ({
  fetchPaymasterToken: (...args: unknown[]) =>
    mockFetchPaymasterToken(...args),
}));

vi.mock("../services/queries", () => ({
  useAccountControllerGetBalance: () => ({
    data: mockOffChainBalance,
    refetch: mockRefetchBalance,
  }),
  paymentControllerRequestWithdrawal: (...args: unknown[]) =>
    mockRequestWithdrawal(...args),
}));

import { WalletView } from "../WalletView";

const TUSDC = "0x1111111111111111111111111111111111111111";
const VAULT = "0x2222222222222222222222222222222222222222";
const ANCHOR = "0x3333333333333333333333333333333333333333";

describe("WalletView", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", TUSDC);
    vi.stubEnv("VITE_VAULT_ADDRESS", VAULT);
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", ANCHOR);
    localStorage.setItem("token", "test-jwt");
    useGameStore.setState({ balance: 25, serverBalance: 25 });
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: true,
      chain: { id: 84532, name: "Base Sepolia" },
    };
    mockCapabilitiesData = undefined;
    mockReadsData = [
      { status: "success", result: 50_000_000n },
      { status: "success", result: 0n },
    ];
    mockOffChainBalance = { free: "25" };
    mockSwitchChainAsync.mockReset().mockResolvedValue(undefined);
    mockSendCallsAsync.mockReset();
    mockWriteContractAsync.mockReset();
    mockSendTransactionAsync.mockReset();
    mockRefetchReads.mockReset();
    mockRefetchBalance.mockReset();
    mockRequestWithdrawal.mockReset();
    mockFetchPaymasterToken.mockReset().mockResolvedValue({
      token: "tok-wallet",
      expiresAt: Date.now() + 900_000,
    });
    mockToast.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("shows 'On-chain wallet not set up yet' and does not crash when contracts are missing", () => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", "");
    vi.stubEnv("VITE_VAULT_ADDRESS", "");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "");

    render(<WalletView />);
    expect(screen.getByText("On-chain wallet not set up yet")).toBeTruthy();
  });

  it("renders 'Switch to Base Sepolia' on wallet action buttons when on the wrong chain", async () => {
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: true,
      chain: { id: 1, name: "Ethereum" },
    };

    render(<WalletView />);
    const switchButtons = screen.getAllByRole("button", {
      name: /Switch to Base Sepolia/i,
    });
    expect(switchButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(switchButtons[0]);
    await waitFor(() => {
      expect(mockSwitchChainAsync).toHaveBeenCalledWith({ chainId: 84532 });
    });
  });

  it("shows 'You pay gas' note when wallet lacks paymasterService capability", () => {
    mockCapabilitiesData = undefined;
    render(<WalletView />);
    expect(screen.getAllByText(/You pay gas/i).length).toBeGreaterThanOrEqual(1);
  });

  it("executes approve then deposit when wallet lacks sponsorship", async () => {
    mockCapabilitiesData = undefined;
    mockWriteContractAsync
      .mockResolvedValueOnce("0xapprove")
      .mockResolvedValueOnce("0xdeposit");

    render(<WalletView />);
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Deposit tUSDC/i }));

    await waitFor(() => {
      expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);
      expect(mockToast.success).toHaveBeenCalledWith("Deposit confirmed");
      expect(mockRefetchReads).toHaveBeenCalled();
      expect(mockRefetchBalance).toHaveBeenCalled();
    });
  });

  it("shows 'Withdrawal is being prepared, try again in a moment' when withdraw returns 409", async () => {
    mockRequestWithdrawal.mockRejectedValue({ response: { status: 409 } });

    render(<WalletView />);
    fireEvent.click(screen.getByRole("button", { name: /Switch swap direction/i }));
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw tUSDC/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Withdrawal is being prepared, try again in a moment",
      );
    });
  });

  it("fetches permit and calls vault.withdraw on withdraw", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockRequestWithdrawal.mockResolvedValue({
      sessionId: "s-1",
      amountBase: "5000000",
      deadline: 1_800_000_000,
      signature: "0xdeadbeef",
      vault: VAULT,
    });
    mockSendCallsAsync.mockResolvedValue({ id: "bundle-w1" });

    render(<WalletView />);
    fireEvent.click(screen.getByRole("button", { name: /Switch swap direction/i }));
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw tUSDC/i }));

    await waitFor(() => {
      expect(mockRequestWithdrawal).toHaveBeenCalledWith({ amount: "5" });
      expect(mockSendCallsAsync).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Withdrawal confirmed");
    });
  });

  it("rejects deposit of '1.1234567' (more than 6 decimals)", () => {
    render(<WalletView />);
    const input = screen.getByPlaceholderText("0");
    fireEvent.change(input, { target: { value: "1.1234567" } });

    expect(screen.getByText(/6 decimals/i)).toBeTruthy();
    const depositBtn = screen.getByRole("button", { name: /Deposit tUSDC/i });
    expect((depositBtn as HTMLButtonElement).disabled).toBe(true);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("shows 'Withdrawals open soon' when withdraw returns 503", async () => {
    mockRequestWithdrawal.mockRejectedValue({ response: { status: 503 } });

    render(<WalletView />);
    fireEvent.click(screen.getByRole("button", { name: /Switch swap direction/i }));
    const input = screen.getByPlaceholderText("0");
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Withdraw tUSDC/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Withdrawals open soon");
    });
  });

  it("shows neutral 'Cancelled' toast when user rejects wallet confirmation", async () => {
    mockWriteContractAsync.mockRejectedValue({
      name: "UserRejectedRequestError",
      code: 4001,
    });

    render(<WalletView />);
    const input = screen.getByPlaceholderText("0");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Deposit tUSDC/i }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Cancelled");
      expect(mockToast.error).not.toHaveBeenCalled();
    });
  });

  it("disables faucet button with countdown while nextClaimAt is in the future", () => {
    const futureSec = Math.floor(Date.now() / 1000) + 3665;
    mockReadsData = [
      { status: "success", result: 50_000_000n },
      { status: "success", result: BigInt(futureSec) },
    ];

    render(<WalletView />);
    const faucetBtn = screen.getByRole("button", { name: /1h 1m/i });
    expect((faucetBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
