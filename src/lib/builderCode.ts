import { concat, numberToHex, stringToHex, type EIP1193Provider, type Hex } from "viem";

const ERC8021_MARKER = "0080218021802180218021802180218021";

export function builderCodeSuffix(rawCode: string | undefined): Hex | undefined {
  const code = rawCode?.trim();
  if (!code) return undefined;
  if (!/^bc_[a-z0-9]{1,252}$/.test(code)) {
    throw new Error("VITE_BASE_BUILDER_CODE must be a Base Dashboard Builder Code");
  }
  return concat([
    stringToHex(code),
    numberToHex(code.length, { size: 1 }),
    `0x${ERC8021_MARKER}`,
  ]);
}

export function appendBuilderCodeSuffix(
  data: Hex | undefined,
  rawCode: string | undefined,
): Hex | undefined {
  if (!data) return data;
  const suffix = builderCodeSuffix(rawCode);
  if (!suffix) return data;
  const normalized = data.toLowerCase();
  if (normalized.endsWith(ERC8021_MARKER)) return data;
  return concat([data, suffix]);
}

/**
 * Wrap an EIP-1193 provider so direct eth_sendTransaction and wallet_sendCalls
 * requests carry the ERC-8021 Base Builder Code attribution suffix without double-appending.
 */
export function withBuilderCodeProvider(
  provider: EIP1193Provider,
  getCode: () => string | undefined,
): EIP1193Provider {
  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop !== "request") {
        const value = Reflect.get(target, prop, receiver);
        return typeof value === "function" ? value.bind(target) : value;
      }
      return async (args: { method: string; params?: unknown[] }) => {
        const suffix = builderCodeSuffix(getCode());
        if (suffix && Array.isArray(args.params) && args.params[0] && typeof args.params[0] === "object") {
          if (args.method === "eth_sendTransaction") {
            const tx = args.params[0] as { data?: Hex };
            if (tx.data) {
              const nextData = appendBuilderCodeSuffix(tx.data, getCode());
              return target.request({
                ...args,
                params: [{ ...tx, data: nextData }, ...args.params.slice(1)],
              } as Parameters<EIP1193Provider["request"]>[0]);
            }
          }
          if (args.method === "wallet_sendCalls") {
            const req = args.params[0] as {
              capabilities?: Record<string, unknown>;
            };
            if (!req.capabilities?.dataSuffix) {
              return target.request({
                ...args,
                params: [
                  {
                    ...req,
                    capabilities: {
                      ...req.capabilities,
                      dataSuffix: { value: suffix, optional: true },
                    },
                  },
                  ...args.params.slice(1),
                ],
              } as Parameters<EIP1193Provider["request"]>[0]);
            }
          }
        }
        return target.request(args as Parameters<EIP1193Provider["request"]>[0]);
      };
    },
  });
}
