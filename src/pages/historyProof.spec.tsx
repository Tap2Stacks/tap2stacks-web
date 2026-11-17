import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryView } from "../HistoryView";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    isAxiosError: (err: unknown) =>
      Boolean(err && typeof err === "object" && "isAxiosError" in err),
  },
}));

const mockedGet = vi.mocked(axios.get);

function sha256Hex(data: string | Buffer): `0x${string}` {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

describe("History & HistoryProofDialog", () => {
  beforeEach(() => {
    localStorage.setItem("token", "test-jwt");
    mockedGet.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("contains no HCS, Legacy, Topic, or Hashscan text in History files", () => {
    const files = [
      "src/HistoryView.tsx",
      "src/pages/HistoryProofDialog.tsx",
      "src/pages/useHistory.ts",
      "src/pages/historyUtils.ts",
    ];
    for (const file of files) {
      const content = readFileSync(`${process.cwd()}/${file}`, "utf8");
      expect(content).not.toMatch(/\b(HCS|Legacy|Hashscan)\b/i);
      expect(content).not.toMatch(/Topic \/ Sequence|topicId/i);
    }
  });

  it("shows PROOF_PENDING message when proof endpoint returns 404 PROOF_PENDING", async () => {
    mockedGet
      .mockResolvedValueOnce({
        data: [
          {
            orderId: "ord-pending",
            marketId: "NVDA",
            amount: "5",
            rewardRate: "2.1",
            settledAt: "2026-11-17T12:00:00.000Z",
            settledWin: true,
            status: "SETTLED",
          },
        ],
      })
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 404, data: { code: "PROOF_PENDING" } },
      });

    render(<HistoryView />);
    const proofBtn = await screen.findByRole("button", { name: /Proof/i });
    fireEvent.click(proofBtn);

    expect(
      await screen.findByText("Proof will be anchored within about 5 minutes"),
    ).toBeTruthy();
  });

  it("shows VOIDED status in History rows and verifies Merkle + price log in dialog", async () => {
    const tap = {
      schema: "tap2stacks.settledOrder.v1" as const,
      orderId: "ord-void-1",
      userId: "0x1111111111111111111111111111111111111111",
      marketId: "NVDA",
      ticker: "NVDA",
      status: "VOIDED" as const,
      amount: "10",
      rewardRate: "3.2000",
      settledAt: 1_700_000_001_000,
      settledWin: null,
      cellTimeStart: 1_700_000_000_000,
      cellTimeEnd: 1_700_000_005_000,
      lowerPrice: "154.00",
      upperPrice: "154.03",
    };
    const leafHash = sha256Hex(JSON.stringify(tap));
    const logBytes = new TextEncoder().encode(
      '{"ticker":"NVDA","tsMs":1700000000100,"price":"154.01"}\n',
    );
    const priceLogHash = sha256Hex(Buffer.from(logBytes));

    mockedGet
      .mockResolvedValueOnce({
        data: [
          {
            orderId: "ord-void-1",
            marketId: "NVDA",
            amount: "10",
            rewardRate: "3.2",
            settledAt: "2026-11-17T12:00:00.000Z",
            settledWin: null,
            status: "VOIDED",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          orderId: "ord-void-1",
          batch: {
            index: 7,
            fromMs: 1_700_000_000_000,
            toMs: 1_700_000_060_000,
            tapsRoot: leafHash,
            priceLogHash,
            txHash: "0xabcdef123456",
          },
          tap: { ...tap, leafHash, proof: [] },
          priceLogIndexes: [7],
        },
      })
      .mockResolvedValueOnce({
        data: logBytes.buffer,
      });

    render(<HistoryView />);
    expect(await screen.findByText(/Voided/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Proof/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Merkle proof matches the anchored root"),
      ).toBeTruthy();
      expect(
        screen.getByText("Price log matches the anchored hash"),
      ).toBeTruthy();
    });
    expect(screen.getAllByText(/Voided/i).length).toBeGreaterThanOrEqual(2);
    const txLink = screen.getByRole("link", { name: /Basescan/i });
    expect(txLink.getAttribute("href")).toBe(
      "https://sepolia.basescan.org/tx/0xabcdef123456",
    );
  });
});
