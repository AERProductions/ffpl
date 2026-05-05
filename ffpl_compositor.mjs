/**
 * FFPL Compositor
 *
 * 1. Fix VICTORY result screen — cover broken "VICOORY" text, overlay correct SVG text
 * 2. Generate favicon from ffpl.jpg — resize to 64×64 PNG
 * 3. Copy clean logo versions (400×400 and 1:1 512×512) for landing page use
 */

import sharp from "sharp";
import { resolve } from "path";

const COMFY_OUT = "C:/Users/ABL/Documents/ComfyUI/output";
const FFPLHQ    = "C:/Users/ABL/Desktop/ffplhq";
const FFPL_DIR  = "C:/Users/ABL/Desktop/Formula Front Pro League";

// ─────────────────────────────────────────────────────────────────────────────
// 1. VICTORY text fix
//    Image: ffpl_result_victory_00001_.png  (1024×576)
//    Problem: mech head sits where T should be → reads "VICOORY"
//    Fix: black rect over top text band, re-render "VICTORY" in matching style
// ─────────────────────────────────────────────────────────────────────────────
async function fixVictory() {
  const src  = `${COMFY_OUT}/ffpl_result_victory_00001_.png`;
  const dest = `${FFPLHQ}/assets/ffpl_result_victory.png`;

  // SVG overlay — covers the broken text row, paints correct text
  // Image is 1024×576. Text lives roughly y=45→y=195.
  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576">
    <!-- Fade cover — not pure black so the spotlights bleed through slightly -->
    <rect x="0" y="38" width="1024" height="162" fill="rgba(4,8,20,0.88)"/>
    <!-- Glow halo layer (wider, softer) -->
    <text
      x="512" y="170"
      font-family="Impact, 'Arial Black', 'Oswald', sans-serif"
      font-size="148"
      font-weight="900"
      fill="none"
      stroke="#40DBFA"
      stroke-width="14"
      stroke-opacity="0.35"
      text-anchor="middle"
      textLength="960"
      lengthAdjust="spacing">VICTORY</text>
    <!-- Main text -->
    <text
      x="512" y="170"
      font-family="Impact, 'Arial Black', 'Oswald', sans-serif"
      font-size="148"
      font-weight="900"
      fill="#40DBFA"
      text-anchor="middle"
      textLength="960"
      lengthAdjust="spacing">VICTORY</text>
  </svg>`;

  await sharp(src)
    .composite([{ input: Buffer.from(svgOverlay), blend: "over" }])
    .png()
    .toFile(dest);

  console.log(`✓  VICTORY fixed → ${dest}`);

  // Also overwrite the ComfyUI source so future runs start from the fixed version
  await sharp(src)
    .composite([{ input: Buffer.from(svgOverlay), blend: "over" }])
    .png()
    .toFile(`${COMFY_OUT}/ffpl_result_victory_FIXED.png`);

  console.log(`✓  Preview copy → ${COMFY_OUT}/ffpl_result_victory_FIXED.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Favicon — ffpl.jpg → 64×64 PNG → ffplhq/favicon.png
// ─────────────────────────────────────────────────────────────────────────────
async function makeFavicon() {
  const src = `${FFPL_DIR}/ffpl.jpg`;

  // 64×64 — browser favicon
  await sharp(src)
    .resize(64, 64, { fit: "contain", background: { r: 8, g: 8, b: 8, alpha: 1 } })
    .png()
    .toFile(`${FFPLHQ}/favicon.png`);
  console.log(`✓  favicon.png (64×64) → ${FFPLHQ}/favicon.png`);

  // 512×512 — high-res icon for Apple touch icon / PWA
  await sharp(src)
    .resize(512, 512, { fit: "contain", background: { r: 8, g: 8, b: 8, alpha: 1 } })
    .png()
    .toFile(`${FFPLHQ}/assets/ffpl_icon_512.png`);
  console.log(`✓  ffpl_icon_512.png (512×512) → ${FFPLHQ}/assets/ffpl_icon_512.png`);

  // 400×400 — logo for landing page / Discord avatar
  await sharp(src)
    .resize(400, 400, { fit: "contain", background: { r: 8, g: 8, b: 8, alpha: 1 } })
    .png()
    .toFile(`${FFPLHQ}/assets/ffpl_logo_clean.png`);
  console.log(`✓  ffpl_logo_clean.png (400×400) → ${FFPLHQ}/assets/ffpl_logo_clean.png`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. OG Social image — deterministic, no AI, no hallucinated text
//    Output: 1200×630  (standard OG / Twitter card size)
//    Layout:
//      Background: ffpl_header_strip.png stretched to fill
//      Dark gradient overlay on left 55% for legibility
//      Logo: ffpl_logo_clean.png  — 200×200, vertically centred, 60px from left
//      Text block right of logo:
//        Line 1: "FORMULA FRONT"   — 44px ice-blue condensed caps
//        Line 2: "PRO LEAGUE"      — 72px white bold
//        Line 3: tagline           — 20px silver
// ─────────────────────────────────────────────────────────────────────────────
async function generateOGClean() {
  const dest      = `${FFPLHQ}/assets/ffpl_og_social.png`;
  const logoSrc   = `${FFPLHQ}/assets/ffpl_logo_clean.png`;
  const bgSrc     = `${FFPLHQ}/assets/ffpl_header_strip.png`;

  const W = 1200, H = 630;

  // Stretch/fill background to 1200×630
  const bg = await sharp(bgSrc)
    .resize(W, H, { fit: "fill" })
    .png()
    .toBuffer();

  // Logo — resize to 200×200, keep aspect
  const logo = await sharp(logoSrc)
    .resize(200, 200, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoW = logoMeta.width;
  const logoH = logoMeta.height;
  const logoLeft = 60;
  const logoTop  = Math.round((H - logoH) / 2);

  // Text block starts right of logo with a small gap
  const textLeft = logoLeft + logoW + 36;

  // SVG overlay — gradient veil + text
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <!-- Left panel gradient: opaque navy → transparent -->
      <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="#020b1e" stop-opacity="0.94"/>
        <stop offset="50%"  stop-color="#020b1e" stop-opacity="0.80"/>
        <stop offset="75%"  stop-color="#020b1e" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#020b1e" stop-opacity="0.00"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#veil)"/>

    <!-- FORMULA FRONT — small ice-blue caps -->
    <text
      x="${textLeft}" y="${Math.round(H / 2) - 52}"
      font-family="'Segoe UI', 'Arial', sans-serif"
      font-size="40"
      font-weight="700"
      fill="#40DBFA"
      letter-spacing="6">FORMULA FRONT</text>

    <!-- PRO LEAGUE — large white -->
    <text
      x="${textLeft}" y="${Math.round(H / 2) + 28}"
      font-family="Impact, 'Arial Black', sans-serif"
      font-size="80"
      font-weight="900"
      fill="#FAFAFA"
      letter-spacing="2">PRO LEAGUE</text>

    <!-- Tagline -->
    <text
      x="${textLeft}" y="${Math.round(H / 2) + 72}"
      font-family="'Segoe UI', 'Arial', sans-serif"
      font-size="22"
      fill="#7C7E7D"
      letter-spacing="2">Ranked AC Combat · Commissioner Events · Save Verified</text>

    <!-- Thin ice-blue rule under PRO LEAGUE -->
    <line
      x1="${textLeft}" y1="${Math.round(H / 2) + 40}"
      x2="${textLeft + 520}" y2="${Math.round(H / 2) + 40}"
      stroke="#40DBFA" stroke-width="2" stroke-opacity="0.45"/>
  </svg>`;

  await sharp(bg)
    .composite([
      { input: logo, left: logoLeft, top: logoTop },
      { input: Buffer.from(svg), blend: "over" },
    ])
    .png()
    .toFile(dest);

  console.log(`✓  OG social image → ${dest}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("FFPL Compositor\n");
  await fixVictory();
  console.log();
  await makeFavicon();
  console.log();
  await generateOGClean();
  console.log("\nDone.");
}

main().catch(console.error);
