import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "public/brand");
const GSTACK_PLAYWRIGHT = "/Users/dev/.tools/node_modules/playwright";
const DEFAULT_BROWSERS_PATH = "/Users/dev/.local/share/ms-playwright";

const PALETTE = {
  paper: "#F4EBE0",
  ink: "#1D1B18",
  lavender: "#E4DCF7",
  yellow: "#F5E4AE",
  pink: "#F7CFC8",
  highlight: "#FFD84D",
  coinLight: "#FFE58A",
  coinDark: "#E2B23C",
  win: "#2F6B34",
};

function tapCoin(cx, cy, r) {
  return `
    <g>
      <circle cx="${cx + 3}" cy="${cy + 4}" r="${r}" fill="${PALETTE.ink}" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE.coinLight}" stroke="${PALETTE.ink}" stroke-width="${Math.max(3, Math.round(r * 0.14))}" />
      <circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.7)}" fill="none" stroke="${PALETTE.coinDark}" stroke-width="${Math.max(2, Math.round(r * 0.1))}" />
      <text x="${cx}" y="${cy + Math.round(r * 0.34)}" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="${Math.round(r * 0.95)}" font-weight="800" fill="${PALETTE.ink}">$</text>
    </g>
  `;
}

function miniGrid(x, y, cols, rows, cellW, cellH, gap) {
  const multipliers = [
    ["1.8x", "2.4x", "3.9x", "6.2x"],
    ["1.4x", "2.1x", "4.5x", "8.0x"],
    ["1.6x", "3.1x", "5.4x", "9.5x"],
  ];
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * (cellW + gap);
      const cy = y + r * (cellH + gap);
      const isTarget = r === 1 && c === 2;
      const isAlt = (r + c) % 2 === 0;
      const fill = isTarget
        ? PALETTE.highlight
        : isAlt
          ? PALETTE.lavender
          : PALETTE.yellow;
      const label = multipliers[r % multipliers.length][c % 4];
      const textY = cy + cellH - 16;
      cells.push(`
        <g>
          ${isTarget ? `<rect x="${cx + 4}" y="${cy + 4}" width="${cellW}" height="${cellH}" rx="12" fill="${PALETTE.ink}" />` : ""}
          <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="12" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="${isTarget ? 4 : 2.5}" />
          <text x="${cx + cellW / 2}" y="${textY}" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="22" font-weight="800" fill="${PALETTE.ink}">${label}</text>
        </g>
      `);
    }
  }
  return cells.join("\n");
}

function buildIconSvg() {
  // 1024x1024 opaque square app icon using only our own mark: grid, price line, and tap coin.
  // Line & coin sit in the upper zone of the center cell so "4.5x" below is completely unobstructed.
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="${PALETTE.paper}" />
  <rect x="64" y="64" width="896" height="896" rx="140" fill="${PALETTE.ink}" />
  <rect x="48" y="48" width="896" height="896" rx="140" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="18" />

  <g transform="translate(132, 132)">
    <rect x="0" y="0" width="224" height="224" rx="34" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="10" />
    <rect x="252" y="0" width="224" height="224" rx="34" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="10" />
    <rect x="504" y="0" width="224" height="224" rx="34" fill="${PALETTE.pink}" stroke="${PALETTE.ink}" stroke-width="10" />

    <rect x="0" y="252" width="224" height="224" rx="34" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="10" />
    <rect x="266" y="266" width="224" height="224" rx="34" fill="${PALETTE.ink}" />
    <rect x="252" y="252" width="224" height="224" rx="34" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="14" />
    <rect x="504" y="252" width="224" height="224" rx="34" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="10" />

    <rect x="0" y="504" width="224" height="224" rx="34" fill="${PALETTE.pink}" stroke="${PALETTE.ink}" stroke-width="10" />
    <rect x="252" y="504" width="224" height="224" rx="34" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="10" />
    <rect x="504" y="504" width="224" height="224" rx="34" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="10" />

    <!-- Price line routed cleanly above center-cell multiplier text -->
    <polyline points="18,620 112,562 204,420 296,318 424,318 548,205 646,148 712,92"
      fill="none" stroke="${PALETTE.ink}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Tap coin inside the highlighted center cell, above 4.5x -->
    ${tapCoin(364, 318, 44)}

    <!-- Live hit marker on the outgoing path -->
    <circle cx="548" cy="205" r="20" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="9" />

    <!-- Unobstructed multiplier readout in center cell -->
    <text x="364" y="442" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="60" font-weight="800" fill="${PALETTE.ink}">4.5x</text>
  </g>
</svg>`.trim();
}

function buildOgSvg() {
  // 1200x630 OpenGraph / Base Dashboard banner with no third-party trademarks.
  // Left column stays <= x=540; right grid sits at x=602..1100 with labels bottom-aligned
  // and the price line + tap coin routed cleanly through the upper zones.
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PALETTE.paper}" />
  <rect x="58" y="58" width="1104" height="534" rx="28" fill="${PALETTE.ink}" />
  <rect x="44" y="44" width="1104" height="534" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="5" />

  <rect x="92" y="92" width="320" height="44" rx="10" fill="${PALETTE.ink}" />
  <text x="252" y="121" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="20" font-weight="800" fill="${PALETTE.paper}">BASE SEPOLIA TESTNET</text>

  <text x="92" y="192" font-family="Menlo, Monaco, Consolas, monospace" font-size="68" font-weight="800" fill="${PALETTE.ink}">tap2stacks</text>
  <text x="92" y="238" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="600" fill="${PALETTE.ink}">Tap live price cells.</text>
  <text x="92" y="272" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="600" fill="${PALETTE.ink}">Test USDC play preview.</text>

  <!-- Own mark badge: tap coin + multiplier chip -->
  <g transform="translate(92, 312)">
    <rect x="4" y="4" width="356" height="74" rx="14" fill="${PALETTE.ink}" />
    <rect x="0" y="0" width="356" height="74" rx="14" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="3" />
    ${tapCoin(42, 37, 22)}
    <text x="82" y="45" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">5s GRID • 4.5x</text>
  </g>

  <rect x="98" y="424" width="310" height="68" rx="14" fill="${PALETTE.ink}" />
  <rect x="92" y="418" width="310" height="68" rx="14" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="4" />
  <text x="247" y="461" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">TAP CELL -> PLAY</text>

  ${miniGrid(602, 148, 4, 3, 114, 104, 14)}

  <!-- Price line stays in upper half of every visited cell so no label is crossed -->
  <polyline points="608,428 700,408 787,304 915,304 1002,202 1092,172"
    fill="none" stroke="${PALETTE.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  ${tapCoin(915, 304, 17)}
  <circle cx="1002" cy="202" r="10" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="4" />
</svg>`.trim();
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const candidate of ["playwright", GSTACK_PLAYWRIGHT]) {
    try {
      return require(candidate);
    } catch {
      continue;
    }
  }
  return null;
}

function findRsvg() {
  try {
    const found = execFileSync("which", ["rsvg-convert"], { encoding: "utf8" }).trim();
    return found || null;
  } catch {
    return null;
  }
}

async function renderWithPlaywright(playwright, items) {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(DEFAULT_BROWSERS_PATH)) {
    const entries = execFileSync("ls", [DEFAULT_BROWSERS_PATH], { encoding: "utf8" }).trim();
    if (entries.length > 0) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = DEFAULT_BROWSERS_PATH;
    }
  }
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    for (const item of items) {
      const page = await browser.newPage({
        viewport: { width: item.width, height: item.height },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<!doctype html><html><body style="margin:0;padding:0;overflow:hidden;background:#F4EBE0;">${item.svg}</body></html>`,
      );
      await page.screenshot({ path: item.pngPath, omitBackground: false });
      await page.close();
      console.log(`Generated ${item.svgPath} -> ${item.pngPath} (${item.width}x${item.height} via Playwright headless shell)`);
    }
  } finally {
    await browser.close();
  }
}

mkdirSync(OUT_DIR, { recursive: true });

// Remove legacy synthetic screenshots from public/brand if present.
for (const legacy of [
  "screenshot-1.png",
  "screenshot-1.svg",
  "screenshot-2.png",
  "screenshot-2.svg",
  "screenshot-3.png",
  "screenshot-3.svg",
]) {
  rmSync(resolve(OUT_DIR, legacy), { force: true });
}

const assets = [
  { name: "icon", width: 1024, height: 1024, svg: buildIconSvg() },
  { name: "og", width: 1200, height: 630, svg: buildOgSvg() },
].map((asset) => ({
  ...asset,
  svgPath: resolve(OUT_DIR, `${asset.name}.svg`),
  pngPath: resolve(OUT_DIR, `${asset.name}.png`),
}));

for (const asset of assets) {
  writeFileSync(asset.svgPath, `${asset.svg}\n`);
}

const rsvgBin = findRsvg();
const playwright = rsvgBin ? null : loadPlaywright();

if (rsvgBin) {
  for (const asset of assets) {
    execFileSync(rsvgBin, ["-w", String(asset.width), "-h", String(asset.height), asset.svgPath, "-o", asset.pngPath]);
    console.log(`Generated ${asset.svgPath} -> ${asset.pngPath} (${asset.width}x${asset.height} via rsvg-convert)`);
  }
} else if (playwright) {
  await renderWithPlaywright(playwright, assets);
} else {
  for (const asset of assets) {
    console.log(`Generated ${asset.svgPath} (render ${asset.pngPath} at ${asset.width}x${asset.height} with Playwright or rsvg-convert)`);
  }
}
