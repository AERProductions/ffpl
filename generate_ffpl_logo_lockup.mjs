/**
 * FFPL Logo Lockup — Pure Typography, No Background Mech
 *
 * Design logic:
 *   The monogram is a 2×2 stacked letterform: FF on top row, PL on bottom row.
 *   Below the monogram, "RO EAGUE" completes the phrase PRO LEAGUE —
 *   the P is already the top-left of PL, the L is already the bottom-right,
 *   so only the remaining letters are needed. No letter is repeated.
 *
 * Layout A — VERTICAL STACK (examples 1 & 2 style):
 *   [ FF ]
 *   [ PL ]
 *   RO EAGUE
 *
 * Layout B — HORIZONTAL (example 3 style):
 *   [ FFPL ] · RO EAGUE   (all on one line or FFPL with subtitle inline)
 *
 * Output: white letterforms on pure black — transparent-ready for compositing.
 * 4 seeds per layout = 8 images.
 */

const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-logo-lockup-001";

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT A — VERTICAL STACK
//   FF (top row, large bold italic)
//   PL (bottom row, same scale)
//   RO EAGUE (smaller condensed subtitle below)
// ─────────────────────────────────────────────────────────────────────────────
const POSITIVE_A = `minimalist sports league logo, pure white bold italic condensed letterforms on pure black background, two rows of two large letters stacked: top row capital F and capital F side by side, bottom row capital P and capital L side by side, below the four-letter block in smaller condensed white capitals the text RO EAGUE, angular forward-slanting letterforms, geometric sans-serif typeface, no background art, no mech, no gradients, no color, just white typography on black, clean graphic design, esports wordmark, centered composition, flat vector-style`;

const NEGATIVE_A = `mech, robot, background scenery, arena, gradient sky, color tints, blurry, watermark, PRO LEAGUE spelled in full on its own line without the monogram above it, FFPL on single line, horizontal layout, extra letters, misspelled text, cartoon`;

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT B — HORIZONTAL / INLINE
//   FFPL as a single compressed bold italic word + RO EAGUE beside or below
//   (example 3 reference: FFPL·RO·EAGUE all on one stretched horizontal line)
// ─────────────────────────────────────────────────────────────────────────────
const POSITIVE_B = `minimalist esports wordmark, pure white bold italic condensed letters on pure black background, single horizontal line reads FFPL followed by RO EAGUE, all letters are forward-slanting angular italic, uniform height, very wide compressed letterforms, no letter spacing gaps except between FFPL and RO, letters slightly overlap in the FFPL block for a connected monogram feel, clean flat graphic design, no background imagery, no mech, no color, no gradients, white on black only, sports league logotype`;

const NEGATIVE_B = `mech, robot, scenery, color, gradient, blurry, watermark, stacked vertical layout, PRO LEAGUE spelled separately, extra letters, cartoon, realistic photo`;

const SEEDS_A = [44001, 44002, 44003, 44004];
const SEEDS_B = [44005, 44006, 44007, 44008];

const ASSETS = [
  ...SEEDS_A.map((seed) => ({
    name: `ffpl_logo_vertical_s${seed}`,
    variant: "A",
    positive: POSITIVE_A,
    negative: NEGATIVE_A,
    width: 768,
    height: 512,
    seed,
  })),
  ...SEEDS_B.map((seed) => ({
    name: `ffpl_logo_horizontal_s${seed}`,
    variant: "B",
    positive: POSITIVE_B,
    negative: NEGATIVE_B,
    width: 1024,
    height: 384,
    seed,
  })),
];

function buildFluxWorkflow({ positive, negative, width, height, seed, name }) {
  return {
    "1": { class_type: "UNETLoader", inputs: { unet_name: "flux1-schnell.safetensors", weight_dtype: "default" } },
    "2": { class_type: "DualCLIPLoader", inputs: { clip_name1: "clip_l.safetensors", clip_name2: "t5xxl_fp16.safetensors", type: "flux" } },
    "3": { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: positive, clip: ["2", 0] } },
    "5": { class_type: "CLIPTextEncode", inputs: { text: negative, clip: ["2", 0] } },
    "6": { class_type: "EmptySD3LatentImage", inputs: { width, height, batch_size: 1 } },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0], positive: ["4", 0], negative: ["5", 0], latent_image: ["6", 0],
        seed, steps: 4, cfg: 1.0, sampler_name: "euler", scheduler: "simple", denoise: 1.0,
      },
    },
    "8": { class_type: "VAEDecode", inputs: { samples: ["7", 0], vae: ["3", 0] } },
    "9": { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: name } },
  };
}

async function queuePrompt(workflow, label) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID }),
  });
  if (!res.ok) { console.error(`  [${label}] FAILED (${res.status})`); return null; }
  const { prompt_id } = await res.json();
  console.log(`  [${label}] queued — ${prompt_id}`);
  return prompt_id;
}

async function pollUntilDone(promptId, label, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2500));
    const data = await (await fetch(`${COMFY_URL}/history/${promptId}`)).json();
    if (data[promptId]) {
      const imgs = Object.values(data[promptId].outputs).flatMap((o) => o.images ?? []);
      if (imgs.length > 0) { imgs.forEach((i) => console.log(`  [${label}] ✓  ${i.filename}`)); return imgs; }
    }
  }
  console.error(`  [${label}] TIMEOUT`); return null;
}

async function main() {
  console.log("FFPL Logo Lockup — Pure Typography (Flux.1-schnell)");
  console.log("Design: FF/PL monogram + RO EAGUE subtitle (P and L shared from monogram)");
  console.log(`Layout A (Vertical stack 768×512): seeds ${SEEDS_A.join(", ")}`);
  console.log(`Layout B (Horizontal line 1024×384): seeds ${SEEDS_B.join(", ")}`);
  console.log(`Total: ${ASSETS.length} images\n`);

  for (const asset of ASSETS) {
    const label = asset.variant === "A" ? "VERTICAL" : "HORIZONTAL";
    console.log(`\n── [${label}] seed ${asset.seed} ──────────────────────`);
    const id = await queuePrompt(buildFluxWorkflow(asset), asset.name);
    if (id) await pollUntilDone(id, asset.name);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("Done. Files in: C:/Users/ABL/Documents/ComfyUI/output");
  console.log("ffpl_logo_vertical_s44001_*.png   — stacked FF/PL + RO EAGUE");
  console.log("ffpl_logo_horizontal_s44005_*.png — FFPL·RO·EAGUE inline");
}

main().catch(console.error);
