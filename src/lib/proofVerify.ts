export type Hex = `0x${string}`;

export interface CanonicalSettledOrder {
  schema: "tap2stacks.settledOrder.v1";
  orderId: string;
  userId: string;
  marketId: string;
  ticker: string;
  status: "WON" | "LOST" | "VOIDED";
  amount: string | number;
  rewardRate: string | number;
  settledAt: number;
  settledWin: boolean | null;
  cellTimeStart: number;
  cellTimeEnd: number;
  lowerPrice: string;
  upperPrice: string;
}

export interface MerkleProofStep {
  position: "left" | "right";
  hash: string;
}

const encoder = new TextEncoder();

export function normalizeHex(value: string): Hex {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  return `0x${clean.toLowerCase()}`;
}

function hexToBytes(value: string): Uint8Array {
  const clean = value.startsWith("0x") ? value.slice(2) : value;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: ArrayBuffer): Hex {
  const view = new Uint8Array(bytes);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
}

async function sha256Bytes(bytes: Uint8Array): Promise<Hex> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  return bytesToHex(digest);
}

async function hashPair(left: string, right: string): Promise<Hex> {
  const l = hexToBytes(left);
  const r = hexToBytes(right);
  const combined = new Uint8Array(l.length + r.length);
  combined.set(l, 0);
  combined.set(r, l.length);
  return sha256Bytes(combined);
}

/** Serialize canonical fields in the exact backend order and SHA-256 hash them. */
export async function hashLeaf(tap: CanonicalSettledOrder): Promise<Hex> {
  const canonical: CanonicalSettledOrder = {
    schema: tap.schema,
    orderId: tap.orderId,
    userId: tap.userId,
    marketId: tap.marketId,
    ticker: tap.ticker,
    status: tap.status,
    amount: tap.amount,
    rewardRate: tap.rewardRate,
    settledAt: tap.settledAt,
    settledWin: tap.settledWin,
    cellTimeStart: tap.cellTimeStart,
    cellTimeEnd: tap.cellTimeEnd,
    lowerPrice: tap.lowerPrice,
    upperPrice: tap.upperPrice,
  };
  return sha256Bytes(encoder.encode(JSON.stringify(canonical)));
}

/** Verify a Merkle proof path against an anchored root using SHA-256 pair hashing. */
export async function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofStep[],
  root: string,
): Promise<boolean> {
  let computed = normalizeHex(leafHash);
  for (const step of proof) {
    computed =
      step.position === "left"
        ? await hashPair(step.hash, computed)
        : await hashPair(computed, step.hash);
  }
  return computed === normalizeHex(root);
}

/** Compute the 0x-prefixed SHA-256 hex digest of raw price-log bytes. */
export async function hashPriceLog(bytes: Uint8Array): Promise<Hex> {
  return sha256Bytes(bytes);
}
