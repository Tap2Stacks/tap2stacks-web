import { describe, expect, it } from "vitest";
import { BASE_SQUARE_SRC, walletIconSource } from "./walletIconSource";

describe("walletIconSource", () => {
  it("uses Base's official Square for Base Account", () => {
    expect(walletIconSource({ id: "baseAccount" })).toEqual({ kind: "img", src: BASE_SQUARE_SRC });
    expect(BASE_SQUARE_SRC).toBe("/brand/wallets/base-square.svg");
  });

  it("uses the icon a wallet announces about itself (data URI or https)", () => {
    const svg = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(walletIconSource({ id: "io.metamask", icon: svg })).toEqual({ kind: "img", src: svg });
    expect(walletIconSource({ id: "io.rabby", icon: "https://rabby.io/icon.png" })).toEqual({ kind: "img", src: "https://rabby.io/icon.png" });
  });

  it("ignores icons that are not images", () => {
    expect(walletIconSource({ id: "x", icon: "javascript:alert(1)" })).toEqual({ kind: "wallet" });
    expect(walletIconSource({ id: "x", icon: "data:text/html;base64,PGI+" })).toEqual({ kind: "wallet" });
    expect(walletIconSource({ id: "x", icon: "http://plain.example/icon.png" })).toEqual({ kind: "wallet" });
  });

  it("draws a mail icon for email and a wallet icon for a plain browser wallet", () => {
    expect(walletIconSource({ id: "cdpEmail" })).toEqual({ kind: "mail" });
    expect(walletIconSource({ id: "injected" })).toEqual({ kind: "wallet" });
  });
});
