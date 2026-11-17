import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashLeaf,
  hashPriceLog,
  verifyMerkleProof,
  type CanonicalSettledOrder,
  type MerkleProofStep,
} from "./proofVerify";

function sha256Hex(data: string | Buffer): `0x${string}` {
  return `0x${createHash("sha256").update(data).digest("hex")}`;
}

function hashPairNode(left: string, right: string): `0x${string}` {
  const l = Buffer.from(left.replace(/^0x/, ""), "hex");
  const r = Buffer.from(right.replace(/^0x/, ""), "hex");
  return sha256Hex(Buffer.concat([l, r]));
}

const TAPS: CanonicalSettledOrder[] = [
  {
    schema: "tap2stacks.settledOrder.v1",
    orderId: "ord-1",
    userId: "0x1111111111111111111111111111111111111111",
    marketId: "NVDA",
    ticker: "NVDA",
    status: "WON",
    amount: "5",
    rewardRate: "4.1000",
    settledAt: 1_700_000_001_000,
    settledWin: true,
    cellTimeStart: 1_700_000_000_000,
    cellTimeEnd: 1_700_000_005_000,
    lowerPrice: "154.00",
    upperPrice: "154.03",
  },
  {
    schema: "tap2stacks.settledOrder.v1",
    orderId: "ord-2",
    userId: "0x1111111111111111111111111111111111111111",
    marketId: "NVDA",
    ticker: "NVDA",
    status: "LOST",
    amount: "10",
    rewardRate: "2.3000",
    settledAt: 1_700_000_005_000,
    settledWin: false,
    cellTimeStart: 1_700_000_000_000,
    cellTimeEnd: 1_700_000_005_000,
    lowerPrice: "154.03",
    upperPrice: "154.06",
  },
  {
    schema: "tap2stacks.settledOrder.v1",
    orderId: "ord-3",
    userId: "0x2222222222222222222222222222222222222222",
    marketId: "TSLA",
    ticker: "TSLA",
    status: "VOIDED",
    amount: "25",
    rewardRate: "3.5000",
    settledAt: 1_700_000_006_000,
    settledWin: null,
    cellTimeStart: 1_700_000_005_000,
    cellTimeEnd: 1_700_000_010_000,
    lowerPrice: "250.00",
    upperPrice: "250.08",
  },
];

describe("proofVerify", () => {
  it("verifies a fixed 3-tap Merkle batch and rejects a tampered amount", async () => {
    const leaves = TAPS.map((t) => sha256Hex(JSON.stringify(t)));
    const p01 = hashPairNode(leaves[0], leaves[1]);
    const p22 = hashPairNode(leaves[2], leaves[2]);
    const root = hashPairNode(p01, p22);

    const proofFor0: MerkleProofStep[] = [
      { position: "right", hash: leaves[1] },
      { position: "right", hash: p22 },
    ];
    const proofFor2: MerkleProofStep[] = [
      { position: "right", hash: leaves[2] },
      { position: "left", hash: p01 },
    ];

    expect(await hashLeaf(TAPS[0])).toBe(leaves[0]);
    expect(await verifyMerkleProof(await hashLeaf(TAPS[0]), proofFor0, root)).toBe(true);
    expect(await verifyMerkleProof(await hashLeaf(TAPS[2]), proofFor2, root)).toBe(true);

    const tampered = { ...TAPS[0], amount: "500" };
    expect(await verifyMerkleProof(await hashLeaf(tampered), proofFor0, root)).toBe(false);
  });

  it("hashPriceLog matches SHA-256 of fixed 2-line ndjson bytes", async () => {
    const ndjson =
      '{"ticker":"NVDA","tsMs":1700000000100,"price":"154.01"}\n' +
      '{"ticker":"TSLA","tsMs":1700000000200,"price":"250.05"}\n';
    const bytes = new TextEncoder().encode(ndjson);
    const expected =
      "0xc56308c8db18ff76e148e5aed4b1256f03e259087f25b1ab3e8cecd795ae68b1";
    expect(await hashPriceLog(bytes)).toBe(expected);
  });
});
