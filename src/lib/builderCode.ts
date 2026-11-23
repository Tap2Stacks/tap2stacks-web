import { concat, numberToHex, stringToHex, type Hex } from "viem";

export function builderCodeSuffix(rawCode: string | undefined): Hex | undefined {
  const code = rawCode?.trim();
  if (!code) return undefined;
  if (!/^bc_[a-z0-9]{1,252}$/.test(code)) {
    throw new Error("VITE_BASE_BUILDER_CODE must be a Base Dashboard Builder Code");
  }
  return concat([
    stringToHex(code),
    numberToHex(code.length, { size: 1 }),
    "0x0080218021802180218021802180218021",
  ]);
}
