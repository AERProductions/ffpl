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
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("FFPL Compositor\n");
  await fixVictory();
  console.log();
  await makeFavicon();
  console.log("\nDone.");
}

main().catch(console.error);
