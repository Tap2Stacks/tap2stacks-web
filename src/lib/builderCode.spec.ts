import { describe, expect, it, vi } from "vitest";
import type { EIP1193Provider } from "viem";
import {
  appendBuilderCodeSuffix,
  builderCodeSuffix,
  withBuilderCodeProvider,
} from "./builderCode";

const CODE = "bc_ymo2v08a";
const EXPECTED_SUFFIX =
  "0x62635f796d6f32763038610b0080218021802180218021802180218021";

describe("builderCode", () => {
  it("encodes a valid Base Builder Code as an ERC-8021 dataSuffix", () => {
    expect(builderCodeSuffix(undefined)).toBeUndefined();
    expect(builderCodeSuffix("  ")).toBeUndefined();
    expect(builderCodeSuffix(CODE)).toBe(EXPECTED_SUFFIX);
    expect(() => builderCodeSuffix("bad-code")).toThrow();
  });

  it("appends the suffix once and avoids double-appending", () => {
    const once = appendBuilderCodeSuffix("0xdeadbeef", CODE);
    expect(once).toBe(`0xdeadbeef${EXPECTED_SUFFIX.slice(2)}`);
    expect(appendBuilderCodeSuffix(once, CODE)).toBe(once);
  });

  it("wraps EIP-1193 eth_sendTransaction and wallet_sendCalls without double-suffixing", async () => {
    const request = vi.fn(async () => "0xhash");
    const base = {
      request,
      on: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as EIP1193Provider;
    const wrapped = withBuilderCodeProvider(base, () => CODE);

    await wrapped.request({
      method: "eth_sendTransaction",
      params: [{ to: "0x1111111111111111111111111111111111111111", data: "0xde5f72fd" }],
    } as never);
    expect(request).toHaveBeenLastCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          to: "0x1111111111111111111111111111111111111111",
          data: `0xde5f72fd${EXPECTED_SUFFIX.slice(2)}`,
        },
      ],
    });

    await wrapped.request({
      method: "eth_sendTransaction",
      params: [
        {
          to: "0x1111111111111111111111111111111111111111",
          data: `0xde5f72fd${EXPECTED_SUFFIX.slice(2)}`,
        },
      ],
    } as never);
    expect(request).toHaveBeenLastCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          to: "0x1111111111111111111111111111111111111111",
          data: `0xde5f72fd${EXPECTED_SUFFIX.slice(2)}`,
        },
      ],
    });

    await wrapped.request({
      method: "wallet_sendCalls",
      params: [{ calls: [{ to: "0x1111111111111111111111111111111111111111", data: "0xde5f72fd" }] }],
    } as never);
    expect(request).toHaveBeenLastCalledWith({
      method: "wallet_sendCalls",
      params: [
        {
          calls: [{ to: "0x1111111111111111111111111111111111111111", data: "0xde5f72fd" }],
          capabilities: {
            dataSuffix: { value: EXPECTED_SUFFIX, optional: true },
          },
        },
      ],
    });
  });
});
