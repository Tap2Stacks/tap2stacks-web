import { afterEach, describe, expect, it, vi } from "vitest";
import { ADDRESSES, getAddresses } from "./addresses";

const VALID_TUSDC = "0x1111111111111111111111111111111111111111";
const VALID_VAULT = "0x2222222222222222222222222222222222222222";
const VALID_PROOF = "0x3333333333333333333333333333333333333333";

describe("addresses", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ADDRESSES throws when VITE_VAULT_ADDRESS is missing", () => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", VALID_TUSDC);
    vi.stubEnv("VITE_VAULT_ADDRESS", "");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", VALID_PROOF);

    expect(() => ADDRESSES.vault).toThrow(/VITE_VAULT_ADDRESS/);
  });

  it("getAddresses throws a clear Error naming the missing env var", () => {
    expect(() =>
      getAddresses({
        VITE_TUSDC_ADDRESS: VALID_TUSDC,
        VITE_PROOF_ANCHOR_ADDRESS: VALID_PROOF,
      }),
    ).toThrow(/VITE_VAULT_ADDRESS/);

    expect(() =>
      getAddresses({
        VITE_VAULT_ADDRESS: VALID_VAULT,
        VITE_PROOF_ANCHOR_ADDRESS: VALID_PROOF,
      }),
    ).toThrow(/VITE_TUSDC_ADDRESS/);

    expect(() =>
      getAddresses({
        VITE_TUSDC_ADDRESS: VALID_TUSDC,
        VITE_VAULT_ADDRESS: VALID_VAULT,
      }),
    ).toThrow(/VITE_PROOF_ANCHOR_ADDRESS/);
  });

  it("getAddresses rejects invalid or bad-checksum addresses", () => {
    expect(() =>
      getAddresses({
        VITE_TUSDC_ADDRESS: "not-an-address",
        VITE_VAULT_ADDRESS: VALID_VAULT,
        VITE_PROOF_ANCHOR_ADDRESS: VALID_PROOF,
      }),
    ).toThrow(/VITE_TUSDC_ADDRESS/);

    expect(() =>
      getAddresses({
        VITE_TUSDC_ADDRESS: VALID_TUSDC,
        VITE_VAULT_ADDRESS: "0xd5cB4c9E796D8FCCb2C9B865aDCeBd2F02aE948D",
        VITE_PROOF_ANCHOR_ADDRESS: VALID_PROOF,
      }),
    ).toThrow(/VITE_VAULT_ADDRESS/);
  });

  it("getAddresses returns checksummed addresses when valid", () => {
    const lowerMixed = "0xd5cb4c9e796d8fccb2c9b865adcebd2f02ae948d";
    const result = getAddresses({
      VITE_TUSDC_ADDRESS: lowerMixed,
      VITE_VAULT_ADDRESS: VALID_VAULT,
      VITE_PROOF_ANCHOR_ADDRESS: VALID_PROOF,
    });

    expect(result).toEqual({
      tUSDC: "0xd5cB4c9E796D8FCCb2C9B865aDCeBd2F02aE948d",
      vault: VALID_VAULT,
      proofAnchor: VALID_PROOF,
    });
  });

  it("ADDRESSES reads checksummed addresses from import.meta.env", () => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", VALID_TUSDC);
    vi.stubEnv("VITE_VAULT_ADDRESS", VALID_VAULT);
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", VALID_PROOF);

    expect(ADDRESSES.tUSDC).toBe(VALID_TUSDC);
    expect(ADDRESSES.vault).toBe(VALID_VAULT);
    expect(ADDRESSES.proofAnchor).toBe(VALID_PROOF);
  });
});
