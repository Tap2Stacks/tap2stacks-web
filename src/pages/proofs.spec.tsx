import { cleanup, render, screen } from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProofsView } from "../ProofsView";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(axios.get);

describe("ProofsView", () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("renders a Basescan tx link and price log download link for each batch", async () => {
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "");
    mockedGet.mockResolvedValueOnce({
      data: [
        {
          index: 12,
          fromMs: 1_700_000_000_000,
          toMs: 1_700_000_060_000,
          tapsRoot: "0x123400000000000000000000000000000000abcd",
          priceLogHash: "0x567800000000000000000000000000000000ef01",
          txHash: "0xdeadbeef0001",
        },
        {
          index: 11,
          fromMs: 1_699_999_940_000,
          toMs: 1_700_000_000_000,
          tapsRoot: "0x999900000000000000000000000000000000aaaa",
          priceLogHash: "0xbbbb00000000000000000000000000000000cccc",
          txHash: "0xdeadbeef0002",
        },
      ],
    });

    render(<ProofsView />);

    expect(await screen.findByText(/Batch #12/i)).toBeTruthy();
    expect(screen.getByText(/Batch #11/i)).toBeTruthy();

    const links = screen.getAllByRole("link", { name: /Basescan/i });
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute("href")).toBe(
      "https://sepolia.basescan.org/tx/0xdeadbeef0001",
    );
    expect(links[1].getAttribute("href")).toBe(
      "https://sepolia.basescan.org/tx/0xdeadbeef0002",
    );

    const downloadLinks = screen.getAllByRole("link", {
      name: /Download price log/i,
    });
    expect(downloadLinks[0].getAttribute("href")).toMatch(
      /\/api\/proofs\/12\/price-log$/,
    );
  });
});
