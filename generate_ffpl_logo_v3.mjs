/**
 * FFPL Logo — Focused iteration on seed 44007 style
 * Target: FFPL monogram (FF top / PL bottom) + "PRO LEAGUE" subtitle
 *
 * 44007 nailed the FFPL monogram perfectly.
 * Subtitle must read: PRO LEAGUE — two words, six letters + five letters.
 * Spelling locked down hard in every prompt variation.
 */

const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-logo-v3-001";

// Core style cloned from what made 44007 work, with aggressive subtitle spelling control
const BASE_POSITIVE = `minimalist esports wordmark logo, pure white bold italic condensed letterforms on pure black background, large stacked monogram block: top row two capital letters F F side by side, bottom row capital P and capital L side by side forming FFPL, a thin horizontal rule beneath the monogram, below the rule the subtitle in smaller condensed bold italic white capitals spells PRO LEAGUE — the word PRO then a space then the word LEAGUE, PRO is three letters P-R-O, LEAGUE is six letters L-E-A-G-U-E, no extra letters no missing letters, angular forward-slanting geometric sans-serif typeface, all white typography on solid pure black background, no background scenery, no mech, no gradients, flat graphic design, centered composition`;

const BASE_NEGATIVE = `mech, robot, scenery, gradient, color tint, blurry, watermark, RO EAGUE, EEAGUE, ŁEAGUE, missing letters, extra letters, PRO JEAGUE, PRO LEAGE, horizontal single-line layout, stacked three rows without monogram, cartoon, realistic photo, texture background`;

const VARIANTS = [
  {
    // Closest to 44007 — minimal change, just add explicit P-R-O spelling
    extra: `the subtitle word PRO spelled P then R then O, the subtitle word LEAGUE spelled L then E then A then G then U then E`,
    seed: 45001,
  },
  {
    // Reinforce separator bar + subtitle position
    extra: `thin horizontal divider bar separates the FFPL monogram from the subtitle, subtitle PRO LEAGUE sits centered below the bar, PRO on left half LEAGUE on right half of subtitle line`,
    seed: 45002,
  },
  {
    // Mirror 44007 seed neighborhood
    extra: `the complete subtitle reads PRO LEAGUE in full, both words clearly legible, PRO three letters P R O space LEAGUE six letters L E A G U E`,
    seed: 45003,
  },
  {
    // Try seed just above 44007
    extra: `subtitle is exactly the phrase PRO LEAGUE nothing more nothing less, PRO then one space then LEAGUE`,
    seed: 45004,
  },
  {
    // Slightly different aspect — tall format, subtitle breathing room
    extra: `the word PRO and the word LEAGUE are on the same baseline below the FFPL block, correct English spelling: P-R-O space L-E-A-G-U-E`,
    seed: 45005,
  },
  {
    // Wider layout — slightly more horizontal breathing room for subtitle
    extra: `subtitle line reads PRO LEAGUE in condensed bold italic capitals, PRO is the first word LEAGUE is the second word, subtitle is smaller than the monogram but clearly readable`,
    seed: 45006,
  },
];

const ASSETS = VARIANTS.map(({ extra, seed }) => ({
  name: `ffpl_logo_v3_s${seed}`,
  positive: `${BASE_POSITIVE}, ${extra}`,
  negative: BASE_NEGATIVE,
  width: 768,
  height: 512,
  seed,
}));

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
  console.log("FFPL Logo v3 — 44007-style + PRO LEAGUE subtitle fix");
  console.log(`Seeds: ${VARIANTS.map(v => v.seed).join(", ")}`);
  console.log(`6 images at 768×512\n`);

  for (const asset of ASSETS) {
    console.log(`\n── seed ${asset.seed} ──────────────────────`);
    const id = await queuePrompt(buildFluxWorkflow(asset), asset.name);
    if (id) await pollUntilDone(id, asset.name);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("Done. C:/Users/ABL/Documents/ComfyUI/output");
  console.log("Files: ffpl_logo_v3_s45001_*.png  through  ffpl_logo_v3_s45006_*.png");
}

main().catch(console.error);
