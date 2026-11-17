import { getAddress, isAddress, type Address } from "viem";

export interface ContractAddresses {
  tUSDC: Address;
  vault: Address;
  proofAnchor: Address;
}

type AddressEnvKey =
  | "VITE_TUSDC_ADDRESS"
  | "VITE_VAULT_ADDRESS"
  | "VITE_PROOF_ANCHOR_ADDRESS";

export type AddressEnv = Partial<Record<AddressEnvKey, string | undefined>>;

function requireAddress(key: AddressEnvKey, env: AddressEnv): Address {
  const raw = env[key]?.trim();
  if (!raw) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  if (!isAddress(raw)) {
    throw new Error(`Invalid address in environment variable ${key}: ${raw}`);
  }
  return getAddress(raw);
}

/** Read and checksum-validate all contract addresses from the given env object. */
export function getAddresses(
  env: AddressEnv = import.meta.env,
): ContractAddresses {
  return {
    tUSDC: requireAddress("VITE_TUSDC_ADDRESS", env),
    vault: requireAddress("VITE_VAULT_ADDRESS", env),
    proofAnchor: requireAddress("VITE_PROOF_ANCHOR_ADDRESS", env),
  };
}

/** Lazy-evaluated contract addresses so tests can import the module without env vars set. */
export const ADDRESSES: ContractAddresses = {
  get tUSDC(): Address {
    return requireAddress("VITE_TUSDC_ADDRESS", import.meta.env);
  },
  get vault(): Address {
    return requireAddress("VITE_VAULT_ADDRESS", import.meta.env);
  },
  get proofAnchor(): Address {
    return requireAddress("VITE_PROOF_ANCHOR_ADDRESS", import.meta.env);
  },
};
