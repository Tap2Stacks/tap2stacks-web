import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WinBanner } from "../fx/WinBanner";
import { useFxStore } from "../fx/fxStore";
import { OpenTapsList } from "../pages/OpenTapsList";
import { TickerRow } from "../pages/TickerRow";
import { useGameStore } from "../store";
import { AssetLogo, getAssetMonogram, resolveAssetLogo } from "./AssetLogo";

afterEach(cleanup);

describe("AssetLogo lookup and rendering", () => {
  it("resolves all supported stock tickers, tokens, and networks case-insensitively", () => {
    expect(resolveAssetLogo("NVDA")?.label).toBe("NVIDIA");
    expect(resolveAssetLogo(" nvda ")?.label).toBe("NVIDIA");
    expect(resolveAssetLogo("TSLA")?.label).toBe("Tesla");
    expect(resolveAssetLogo("USDC")?.label).toBe("USDC");
    expect(resolveAssetLogo("tUSDC")?.label).toBe("USDC");
    expect(resolveAssetLogo("ETH")?.label).toBe("Ethereum");
    expect(resolveAssetLogo("Base")?.label).toBe("Base");
    expect(resolveAssetLogo("Base Sepolia")?.label).toBe("Base");
    expect(resolveAssetLogo("UNKNOWN")).toBeNull();
  });

  it("derives up to two-character uppercase monograms for unknown symbols", () => {
    expect(getAssetMonogram("AAPL")).toBe("AA");
    expect(getAssetMonogram("btc-usdt")).toBe("BT");
    expect(getAssetMonogram("x")).toBe("X");
    expect(getAssetMonogram("   ")).toBe("?");
  });

  it("renders a bundled local image for known symbols and a monogram fallback for unknown ones", () => {
    const { container, rerender } = render(<AssetLogo symbol="NVDA" size={18} decorative={false} />);
    const img = screen.getByRole("img", { name: "NVIDIA" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBeTruthy();
    expect(img.getAttribute("src")).not.toMatch(/^https?:\/\//i);
    expect(img.style.width).toBe("18px");

    rerender(<AssetLogo symbol="AAPL" size={20} decorative={false} />);
    expect(container.querySelector("img")).toBeNull();
    const fallback = screen.getByLabelText("AAPL");
    expect(fallback.textContent).toBe("AA");
    expect(fallback.getAttribute("data-fallback")).toBe("monogram");
  });

  it("appears in TickerRow, OpenTapsList, and WinBanner", () => {
    useGameStore.setState({
      ticker: "NVDA",
      currentPrice: 155,
      stacks: {
        "NVDA:1000:6000:154.00:154.03": {
          cellId: "NVDA:1000:6000:154.00:154.03",
          ticker: "NVDA",
          coins: [{ clientTapId: "c1", amount: 5, rate: 3.5, status: "open", placedAt: 0 }],
        },
      },
    });
    useFxStore.setState({
      current: {
        cellId: "a",
        ticker: "TSLA",
        stake: 10,
        payout: 42,
        rate: 4.2,
        tier: "medium",
        atMs: 0,
      },
    });

    const { container } = render(
      <>
        <TickerRow />
        <OpenTapsList />
        <WinBanner />
      </>,
    );
    expect(container.querySelector('img[data-symbol="NVDA"]')).toBeTruthy();
    expect(container.querySelectorAll('img[data-symbol="NVDA"]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('img[data-symbol="TSLA"]').length).toBeGreaterThanOrEqual(2);
  });
});
