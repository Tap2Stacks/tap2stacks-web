import { customClient } from "./custom-client";

export interface PaymasterTokenResponse {
  token: string;
  expiresAt: number;
}

/**
 * Request a short-lived paymaster URL token from the authenticated backend so
 * EIP-7677 wallets can call the paymaster endpoint without a JWT header.
 */
export async function fetchPaymasterToken(): Promise<PaymasterTokenResponse> {
  const raw = await customClient<unknown>({
    url: "/api/paymaster/token",
    method: "POST",
  });
  const data = raw as Partial<PaymasterTokenResponse> | null;
  if (
    !data ||
    typeof data.token !== "string" ||
    data.token.length === 0 ||
    typeof data.expiresAt !== "number" ||
    !Number.isFinite(data.expiresAt)
  ) {
    throw new Error("Invalid paymaster token response");
  }
  return { token: data.token, expiresAt: data.expiresAt };
}
