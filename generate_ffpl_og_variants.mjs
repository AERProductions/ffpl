/**
 * FFPL OG Social — Logo Layout Iteration Script
 *
 * Iterating on ffpl_og_social_00001_.png (seed 42003).
 * User loves: top-left "FFPL / PRO LEAGUE" small condensed wordmark, mech composition,
 *             ice-blue glows, dark navy atmosphere.
 * User wants: fix the hallucinated "FFFPL" center text, produce two layout variants:
 *   Variant A — HORIZONTAL: "FF" monogram + "PRO LEAGUE" on same horizontal baseline (top-left)
 *   Variant B — VERTICAL:   "FF" at top, "PRO LEAGUE" stacked vertically down left edge
 *
 * Generates 4 seeds × 2 variants = 8 images total.
 * Seeds 43001–43008 (separate range from original 42xxx batch).
 */

const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-og-iter-001";
const OUTPUT_DIR = "C:/Users/ABL/Documents/ComfyUI/output";

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT A — HORIZONTAL LOCKUP
//   Left panel: [ FF ] · PRO LEAGUE   (monogram beside tagline, same line)
//   Right panel: armored mech, cinematic
// ─────────────────────────────────────────────────────────────────────────────
const POSITIVE_A = `Formula Front Pro League esports social banner, cinematic armored core mech on the right half of the frame, glowing ice-blue arm cannons and chest core, deep navy black arena floor with atmospheric fog and spotlight, dramatic side lighting, in the top-left corner a clean bold italic condensed white letter logo: capital letter F and capital letter F as an angular monogram, immediately to the right of the monogram the words PRO LEAGUE in condensed white capitals on the same horizontal baseline, horizontal wordmark lockup top-left only, clean professional sports league branding, dark moody left panel empty below the logo, cinematic widescreen 16:9 key art`;

const NEGATIVE_A = `FFFPL, FFF, three letter F, FFPL in center, large text center panel, watermark, text on mech body, blurry, cartoon, anime, human pilot, bright sky, green tones, extra logos, duplicate wordmarks, low quality`;

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT B — VERTICAL STACK
//   Left panel top: FF (large, stacked two Fs)
//   Below: PRO stacked over LEAGUE, vertical reading down left edge
//   Right panel: armored mech, cinematic
// ─────────────────────────────────────────────────────────────────────────────
const POSITIVE_B = `Formula Front Pro League esports social banner, cinematic armored core mech on the right half of the frame, glowing ice-blue energy accents, deep navy black arena with atmospheric fog, dramatic lighting, on the top-left a bold italic angular white letter logo: the letters FF large at the top, below them the word PRO centered, below that the word LEAGUE centered, vertical stacked wordmark column on left edge, tall condensed sports typography, professional league branding, dark moody left panel with vertical text spine, cinematic widescreen 16:9 key art`;

const NEGATIVE_B = `FFFPL, FFF, three letter F, FFPL in center, large horizontal center text, watermark, text on mech, blurry, cartoon, anime, human pilot, bright sky, green tones, extra logos, low quality`;

const SEEDS_A = [43001, 43002, 43003, 43004];
const SEEDS_B = [43005, 43006, 43007, 43008];

const ASSETS = [
  ...SEEDS_A.map((seed, i) => ({
    name: `ffpl_og_v2_horizontal_s${seed}`,
    variant: "A",
    positive: POSITIVE_A,
    negative: NEGATIVE_A,
    width: 1216,
    height: 640,
    seed,
  })),
  ...SEEDS_B.map((seed, i) => ({
    name: `ffpl_og_v3_vertical_s${seed}`,
    variant: "B",
    positive: POSITIVE_B,
    negative: NEGATIVE_B,
    width: 1216,
    height: 640,
    seed,
  })),
];

// ─────────────────────────────────────────────────────────────────────────────
// Flux.1-schnell split-model workflow (UNETLoader / DualCLIPLoader / VAELoader)
// ─────────────────────────────────────────────────────────────────────────────
function buildFluxWorkflow({ positive, negative, width, height, seed, name }) {
  return {
    "1": {
      class_type: "UNETLoader",
      inputs: { unet_name: "flux1-schnell.safetensors", weight_dtype: "default" },
    },
    "2": {
      class_type: "DualCLIPLoader",
      inputs: {
        clip_name1: "clip_l.safetensors",
        clip_name2: "t5xxl_fp16.safetensors",
        type: "flux",
      },
    },
    "3": {
      class_type: "VAELoader",
      inputs: { vae_name: "ae.safetensors" },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: positive, clip: ["2", 0] },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: { text: negative, clip: ["2", 0] },
    },
    "6": {
      class_type: "EmptySD3LatentImage",
      inputs: { width, height, batch_size: 1 },
    },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["6", 0],
        seed,
        steps: 4,
        cfg: 1.0,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1.0,
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["7", 0], vae: ["3", 0] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { images: ["8", 0], filename_prefix: name },
    },
  };
}

async function queuePrompt(workflow, label) {
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: CLIENT_ID }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  [${label}] QUEUE FAILED (${res.status}): ${err.slice(0, 200)}`);
    return null;
  }
  const { prompt_id } = await res.json();
  console.log(`  [${label}] queued — ${prompt_id}`);
  return prompt_id;
}

async function pollUntilDone(promptId, label, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    const data = await res.json();
    if (data[promptId]) {
      const outputs = data[promptId].outputs;
      const imgs = Object.values(outputs).flatMap((o) => o.images ?? []);
      if (imgs.length > 0) {
        for (const img of imgs) console.log(`  [${label}] ✓  ${img.filename}`);
        return imgs;
      }
    }
  }
  console.error(`  [${label}] TIMEOUT`);
  return null;
}

async function main() {
  console.log("FFPL OG Social — Layout Iteration (Flux.1-schnell)");
  console.log(`Variant A (Horizontal): seeds ${SEEDS_A.join(", ")}`);
  console.log(`Variant B (Vertical):   seeds ${SEEDS_B.join(", ")}`);
  console.log(`Total: ${ASSETS.length} images at 1216×640\n`);
  console.log(`Output → ${OUTPUT_DIR}\n`);

  for (const asset of ASSETS) {
    const variantLabel = asset.variant === "A" ? "HORIZONTAL" : "VERTICAL";
    console.log(`\n── [${variantLabel}] seed ${asset.seed} ──────────────────────`);
    const wf = buildFluxWorkflow(asset);
    const id = await queuePrompt(wf, asset.name);
    if (id) await pollUntilDone(id, asset.name);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("All iterations complete.");
  console.log(`Files saved to: ${OUTPUT_DIR}`);
  console.log("Naming: ffpl_og_v2_horizontal_s43001_*.png  (Variant A)");
  console.log("        ffpl_og_v3_vertical_s43005_*.png    (Variant B)");
}

main().catch(console.error);
