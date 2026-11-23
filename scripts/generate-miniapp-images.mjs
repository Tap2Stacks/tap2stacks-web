import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOGOS_DIR = resolve(ROOT, "src/assets/logos");
const OUT_DIR = resolve(ROOT, "public/brand");

const PALETTE = {
  paper: "#F4EBE0",
  ink: "#1D1B18",
  lavender: "#E4DCF7",
  yellow: "#F5E4AE",
  pink: "#F7CFC8",
  highlight: "#FFD84D",
  win: "#2F6B34",
};

function stripOuterSvg(svgText) {
  return svgText
    .replace(/^<\?xml[^>]*>\s*/i, "")
    .replace(/^<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

const nvdaInner = stripOuterSvg(
  readFileSync(resolve(LOGOS_DIR, "nvda.svg"), "utf8"),
);
const tslaInner = stripOuterSvg(
  readFileSync(resolve(LOGOS_DIR, "tsla.svg"), "utf8"),
);
const usdcInner = stripOuterSvg(
  readFileSync(resolve(LOGOS_DIR, "usdc.svg"), "utf8"),
);

function logoBadge(inner, x, y, size, ticker) {
  const scale = size / 32;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="4" y="4" width="${size + 124}" height="${size + 24}" rx="14" fill="${PALETTE.ink}" />
      <rect x="0" y="0" width="${size + 124}" height="${size + 24}" rx="14" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="3" />
      <g transform="translate(12, 12) scale(${scale})">
        ${inner}
      </g>
      <text x="${size + 24}" y="${size / 2 + 20}" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">${ticker}</text>
    </g>
  `;
}

function miniGrid(x, y, cols, rows, cellW, cellH, gap, highlightRow = 1, highlightCol = 2) {
  const multipliers = [
    ["1.8x", "2.4x", "3.9x", "6.2x"],
    ["1.4x", "2.1x", "4.5x", "8.0x"],
    ["1.6x", "3.1x", "5.4x", "9.5x"],
    ["2.2x", "3.5x", "7.1x", "12.0x"],
  ];
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x + c * (cellW + gap);
      const cy = y + r * (cellH + gap);
      const isTarget = r === highlightRow && c === highlightCol;
      const isAlt = (r + c) % 2 === 0;
      const fill = isTarget
        ? PALETTE.highlight
        : isAlt
          ? PALETTE.lavender
          : PALETTE.yellow;
      const label = multipliers[r % multipliers.length][c % 4];
      cells.push(`
        <g>
          ${isTarget ? `<rect x="${cx + 4}" y="${cy + 4}" width="${cellW}" height="${cellH}" rx="12" fill="${PALETTE.ink}" />` : ""}
          <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="12" fill="${fill}" stroke="${PALETTE.ink}" stroke-width="${isTarget ? 4 : 2.5}" />
          <text x="${cx + cellW / 2}" y="${cy + cellH / 2 + 9}" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="800" fill="${PALETTE.ink}">${label}</text>
        </g>
      `);
    }
  }
  return cells.join("\n");
}

function buildIconSvg() {
  // 1024x1024 opaque square icon (no transparency)
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

    <polyline points="20,560 150,470 260,410 364,340 490,260 616,180 715,125"
      fill="none" stroke="${PALETTE.ink}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="364" cy="340" r="24" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="10" />

    <g transform="translate(54, 54) scale(3.6)">${nvdaInner}</g>
    <g transform="translate(558, 558) scale(3.6)">${tslaInner}</g>
    <text x="364" y="422" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="60" font-weight="800" fill="${PALETTE.ink}">4.5x</text>
  </g>
</svg>`.trim();
}

function buildOgSvg() {
  // 1200x630 OpenGraph / Base Dashboard banner
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PALETTE.paper}" />
  <rect x="58" y="58" width="1104" height="534" rx="28" fill="${PALETTE.ink}" />
  <rect x="44" y="44" width="1104" height="534" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="5" />

  <rect x="92" y="92" width="320" height="44" rx="10" fill="${PALETTE.ink}" />
  <text x="252" y="121" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="20" font-weight="800" fill="${PALETTE.paper}">BASE SEPOLIA TESTNET</text>

  <text x="92" y="190" font-family="Menlo, Monaco, Consolas, monospace" font-size="68" font-weight="800" fill="${PALETTE.ink}">tap2stacks</text>
  <text x="92" y="238" font-family="Menlo, Monaco, Consolas, monospace" font-size="25" font-weight="600" fill="${PALETTE.ink}">Tap live stock price cells. Test USDC play preview.</text>

  ${logoBadge(nvdaInner, 92, 285, 48, "NVDA")}
  ${logoBadge(tslaInner, 310, 285, 48, "TSLA")}

  <rect x="98" y="395" width="310" height="68" rx="14" fill="${PALETTE.ink}" />
  <rect x="92" y="389" width="310" height="68" rx="14" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="4" />
  <text x="247" y="432" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">TAP CELL -> PLAY</text>

  ${miniGrid(590, 185, 4, 3, 122, 96, 14)}
  <polyline points="602,425 715,386 820,348 930,324 1060,266"
    fill="none" stroke="${PALETTE.ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="930" cy="324" r="11" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="4" />
</svg>`.trim();
}

function phoneChrome(title, activeTab, bodySvg) {
  const tabs = ["Trade", "History", "Wallet", "Proofs"];
  const tabWidth = 1140 / tabs.length;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="2778" viewBox="0 0 1284 2778">
  <rect width="1284" height="2778" fill="${PALETTE.paper}" />
  <!-- Running tape -->
  <rect x="0" y="96" width="1284" height="68" fill="${PALETTE.ink}" />
  <text x="48" y="138" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.paper}">LIVE TAPE  •  NVDA $154.68  •  TSLA $342.10  •  BASE SEPOLIA TESTNET</text>

  <!-- Phone Header -->
  <rect x="0" y="164" width="1284" height="128" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="3" />
  <text x="48" y="242" font-family="Menlo, Monaco, Consolas, monospace" font-size="44" font-weight="800" fill="${PALETTE.ink}">tap2stacks</text>
  <rect x="870" y="196" width="208" height="64" rx="14" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="3" />
  <text x="974" y="236" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">Bell live</text>
  <rect x="1096" y="196" width="144" height="64" rx="14" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="3" />
  <text x="1168" y="236" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="24" font-weight="800" fill="${PALETTE.ink}">0x7a..4f</text>

  <!-- Headline banner -->
  <text x="64" y="378" font-family="Menlo, Monaco, Consolas, monospace" font-size="46" font-weight="800" fill="${PALETTE.ink}">${title}</text>

  ${bodySvg}

  <!-- Bottom Nav -->
  <rect x="0" y="2530" width="1284" height="184" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="3" />
  ${tabs
    .map((tab, i) => {
      const tx = 72 + i * tabWidth + tabWidth / 2;
      const isActive = tab === activeTab;
      return `<text x="${tx}" y="2626" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="30" font-weight="${isActive ? "800" : "500"}" fill="${PALETTE.ink}" ${isActive ? 'text-decoration="underline"' : 'opacity="0.65"'}>${tab}</text>`;
    })
    .join("\n")}
  <text x="642" y="2728" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="22" fill="${PALETTE.ink}" opacity="0.6">Testnet game. Test USDC has no value. Not for US persons. 18+.</text>
</svg>`.trim();
}

function buildScreenshot1Svg() {
  // Portrait 1284x2778: Live tap board
  return phoneChrome(
    "Tap price cells in 5s windows",
    "Trade",
    `
    ${logoBadge(nvdaInner, 64, 430, 52, "NVDA")}
    ${logoBadge(tslaInner, 310, 430, 52, "TSLA")}
    <rect x="64" y="548" width="1156" height="1450" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    ${miniGrid(114, 620, 4, 4, 246, 286, 24, 1, 2)}
    <polyline points="118,1620 280,1510 420,1410 560,1290 730,1080 920,940 1160,790"
      fill="none" stroke="${PALETTE.ink}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="768" cy="1062" r="18" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="6" />
    <rect x="64" y="2050" width="1156" height="120" rx="20" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="3" />
    <text x="104" y="2120" font-family="Menlo, Monaco, Consolas, monospace" font-size="30" font-weight="700" fill="${PALETTE.ink}">2 open taps / $10 on the board</text>

    <rect x="64" y="2210" width="350" height="150" rx="22" fill="${PALETTE.ink}" />
    <text x="100" y="2266" font-family="Menlo, Monaco, Consolas, monospace" font-size="22" font-weight="700" fill="${PALETTE.paper}">TEST USDC</text>
    <text x="100" y="2328" font-family="Menlo, Monaco, Consolas, monospace" font-size="44" font-weight="800" fill="${PALETTE.paper}">$124.50</text>

    <rect x="446" y="2215" width="170" height="140" rx="70" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="531" y="2296" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">$1</text>
    <rect x="646" y="2215" width="170" height="140" rx="70" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="5" />
    <text x="731" y="2296" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">$5</text>
    <rect x="846" y="2215" width="170" height="140" rx="70" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="931" y="2296" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">$10</text>
    <rect x="1046" y="2215" width="170" height="140" rx="70" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="1131" y="2296" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">$25</text>
    `,
  );
}

function buildScreenshot2Svg() {
  // Portrait 1284x2778: Wallet & Base Sepolia Testnet Vault
  return phoneChrome(
    "Base Sepolia Testnet Vault",
    "Wallet",
    `
    <rect x="64" y="438" width="556" height="250" rx="24" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="100" y="504" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">WALLET tUSDC</text>
    <text x="100" y="596" font-family="Menlo, Monaco, Consolas, monospace" font-size="52" font-weight="800" fill="${PALETTE.ink}">100.00</text>
    <text x="100" y="650" font-family="Menlo, Monaco, Consolas, monospace" font-size="22" fill="${PALETTE.ink}">On-chain Base Sepolia</text>

    <rect x="664" y="438" width="556" height="250" rx="24" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="700" y="504" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">APP BALANCE</text>
    <text x="700" y="596" font-family="Menlo, Monaco, Consolas, monospace" font-size="52" font-weight="800" fill="${PALETTE.ink}">124.50</text>
    <text x="700" y="650" font-family="Menlo, Monaco, Consolas, monospace" font-size="22" fill="${PALETTE.ink}">Available to trade or withdraw</text>

    <rect x="74" y="750" width="1156" height="580" rx="28" fill="${PALETTE.ink}" />
    <rect x="64" y="740" width="1156" height="580" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="112" y="818" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">TRANSFER (1:1) • WALLET -> APP BALANCE</text>
    <rect x="112" y="868" width="1060" height="200" rx="20" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="3" />
    <text x="152" y="996" font-family="Menlo, Monaco, Consolas, monospace" font-size="76" font-weight="800" fill="${PALETTE.ink}">25.00</text>
    <g transform="translate(975, 932) scale(2.2)">${usdcInner}</g>
    <text x="1060" y="984" font-family="Menlo, Monaco, Consolas, monospace" font-size="30" font-weight="800" fill="${PALETTE.ink}">tUSDC</text>

    <rect x="118" y="1136" width="1060" height="128" rx="22" fill="${PALETTE.ink}" />
    <rect x="112" y="1130" width="1060" height="128" rx="22" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="642" y="1208" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">Deposit tUSDC (Sponsored)</text>

    <rect x="64" y="1390" width="1156" height="360" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="112" y="1474" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">TESTNET FAUCET • 100 tUSDC / 24H</text>
    <text x="112" y="1538" font-family="Menlo, Monaco, Consolas, monospace" font-size="28" fill="${PALETTE.ink}">Claim free test USDC to try the grid on Base Sepolia.</text>
    <rect x="112" y="1590" width="1060" height="112" rx="20" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="642" y="1658" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="32" font-weight="800" fill="${PALETTE.ink}">Claim 100 tUSDC</text>
    `,
  );
}

function buildScreenshot3Svg() {
  // Portrait 1284x2778: Proofs & Settlement Transparency
  return phoneChrome(
    "Anchored Settlement Proofs",
    "Proofs",
    `
    <rect x="64" y="440" width="1156" height="440" rx="28" fill="${PALETTE.yellow}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="112" y="518" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">BATCH #42 • BASE SEPOLIA ANCHOR</text>
    <text x="112" y="592" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">tapsRoot: 0x9c4a...f18b</text>
    <text x="112" y="654" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">priceLogHash: 0x3b12...0e77</text>
    <rect x="112" y="720" width="440" height="96" rx="16" fill="${PALETTE.highlight}" stroke="${PALETTE.ink}" stroke-width="3" />
    <text x="332" y="780" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="28" font-weight="800" fill="${PALETTE.ink}">Verify Proof Locally</text>

    <rect x="64" y="940" width="1156" height="440" rx="28" fill="${PALETTE.paper}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="112" y="1018" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" font-weight="700" fill="${PALETTE.ink}">BATCH #41 • VERIFIED ONCHAIN</text>
    <text x="112" y="1092" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">tapsRoot: 0x71e0...8c22</text>
    <text x="112" y="1154" font-family="Menlo, Monaco, Consolas, monospace" font-size="34" font-weight="800" fill="${PALETTE.ink}">txHash: 0x54d9...a910</text>
    <rect x="112" y="1220" width="380" height="96" rx="16" fill="${PALETTE.win}" stroke="${PALETTE.ink}" stroke-width="3" />
    <text x="302" y="1280" text-anchor="middle" font-family="Menlo, Monaco, Consolas, monospace" font-size="28" font-weight="800" fill="${PALETTE.paper}">Proof Verified</text>

    <rect x="64" y="1440" width="1156" height="320" rx="28" fill="${PALETTE.lavender}" stroke="${PALETTE.ink}" stroke-width="4" />
    <text x="112" y="1520" font-family="Menlo, Monaco, Consolas, monospace" font-size="30" font-weight="800" fill="${PALETTE.ink}">Open Price Feed + ERC-8021 Attribution</text>
    <text x="112" y="1588" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" fill="${PALETTE.ink}">Every settlement batch is anchored to Base Sepolia,</text>
    <text x="112" y="1634" font-family="Menlo, Monaco, Consolas, monospace" font-size="26" fill="${PALETTE.ink}">and every wallet transaction carries Base Builder Code.</text>
    `,
  );
}

function findRenderer() {
  const chromePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  for (const bin of chromePaths) {
    if (existsSync(bin)) return { kind: "chrome", bin };
  }
  for (const cmd of ["rsvg-convert", "google-chrome", "chromium"]) {
    try {
      const found = execFileSync("which", [cmd], { encoding: "utf8" }).trim();
      if (found) {
        return { kind: cmd === "rsvg-convert" ? "rsvg" : "chrome", bin: found };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function renderWithChrome(chromeBin, svgPath, pngPath, width, height) {
  const htmlPath = svgPath.replace(/\.svg$/, ".tmp.html");
  const svgMarkup = readFileSync(svgPath, "utf8");
  writeFileSync(
    htmlPath,
    `<!doctype html><html><body style="margin:0;padding:0;overflow:hidden;background:#F4EBE0;">${svgMarkup}</body></html>`,
  );
  try {
    execFileSync(
      chromeBin,
      [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--window-size=${width},${height}`,
        `--screenshot=${pngPath}`,
        pathToFileURL(htmlPath).href,
      ],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(htmlPath, { force: true });
  }
}

mkdirSync(OUT_DIR, { recursive: true });

const assets = [
  { name: "icon", width: 1024, height: 1024, svg: buildIconSvg() },
  { name: "og", width: 1200, height: 630, svg: buildOgSvg() },
  { name: "screenshot-1", width: 1284, height: 2778, svg: buildScreenshot1Svg() },
  { name: "screenshot-2", width: 1284, height: 2778, svg: buildScreenshot2Svg() },
  { name: "screenshot-3", width: 1284, height: 2778, svg: buildScreenshot3Svg() },
];

const renderer = findRenderer();
for (const asset of assets) {
  const svgPath = resolve(OUT_DIR, `${asset.name}.svg`);
  const pngPath = resolve(OUT_DIR, `${asset.name}.png`);
  writeFileSync(svgPath, `${asset.svg}\n`);
  if (renderer?.kind === "rsvg") {
    execFileSync(renderer.bin, ["-w", String(asset.width), "-h", String(asset.height), svgPath, "-o", pngPath]);
    console.log(`Generated ${svgPath} -> ${pngPath} (${asset.width}x${asset.height} via rsvg-convert)`);
  } else if (renderer?.kind === "chrome") {
    renderWithChrome(renderer.bin, svgPath, pngPath, asset.width, asset.height);
    console.log(`Generated ${svgPath} -> ${pngPath} (${asset.width}x${asset.height} via headless Chrome)`);
  } else {
    console.log(`Generated ${svgPath} (no local SVG->PNG renderer found; render ${pngPath} at ${asset.width}x${asset.height})`);
  }
}
