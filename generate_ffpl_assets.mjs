/**
 * FFPL Full Asset Generation — Flux.1-schnell
 * Generates: icons, banners, OG image, match results, avatars, commissioner badge,
 *            header strip, menu backgrounds, dividers, favicon source
 */
const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-assets-001";
const OUTPUT_DIR = "C:/Users/ABL/Documents/ComfyUI/output";

// ── Arch-Nexus palette hints for prompts ──────────────────────────────────────
// navy #002063 | blue #2AAAE9 | ice #40DBFA | red #E30A01 | gold #FFD700 | black #080808

const ASSETS = [
  // ════════════════════════════════════════════════════
  // BATCH A — CORE IDENTITY
  // ════════════════════════════════════════════════════
  {
    name: "ffpl_icon_emblem",
    batch: "A",
    positive:
      "FFPL league emblem, heraldic crest design, stylized armored mech skull faceplate at center, angular geometric diamond border, circuit board tracery, glowing ice-blue energy lines, deep navy and black background, gold accent trim, centered symmetrical composition, flat graphic design style, high contrast, no text, emblem on dark plate, metallic sheen, sci-fi military insignia",
    negative:
      "text, letters, words, watermark, blurry, asymmetrical, cartoon, anime, human figure, low quality, gradient sky",
    width: 512,
    height: 512,
    seed: 42001,
  },
  {
    name: "ffpl_icon_diamond",
    batch: "A",
    positive:
      "minimalist geometric diamond-shaped logo mark, angular armored core mech silhouette inside a diamond frame, glowing electric blue outline, pure black background, centered, flat vector-style illustration, sharp edges, sci-fi military badge, high contrast neon ice blue on pitch black, no text, no gradients in background",
    negative:
      "text, letters, watermark, blurry, soft, realistic photo, human, cartoon, busy background, many colors",
    width: 512,
    height: 512,
    seed: 42002,
  },
  {
    name: "ffpl_og_social",
    batch: "A",
    positive:
      "Formula Front Pro League official social media banner, dramatic sci-fi mech standing in a dark arena, glowing ice-blue energy accents, deep navy blue background, angular industrial typography space on left third, FFPL league cinematic key art, widescreen 16:9 composition, league logo space top-left, bottom third dark fade, high production value, concept art",
    negative:
      "watermark, low quality, blurry, cartoon, anime, human pilot, text overlapping mech, bright sky",
    width: 1216,
    height: 640,
    seed: 42003,
  },
  {
    name: "ffpl_discord_banner",
    batch: "A",
    positive:
      "Formula Front Pro League Discord server banner, dramatic panoramic view of two armored mechs facing off in a dark futuristic arena, wide shot, industrial atmosphere, ice-blue and red energy glow, reflective dark floor, spectator lighting rigs overhead, cinematic composition, deep dark navy background, high contrast, dynamic action pose, sci-fi concept art",
    negative:
      "text overlay, watermark, blurry, cartoon, anime, human pilot, bright daylight, pastel colors",
    width: 960,
    height: 544,
    seed: 42004,
  },

  // ════════════════════════════════════════════════════
  // BATCH B — MATCH RESULT SCREENS
  // ════════════════════════════════════════════════════
  {
    name: "ffpl_result_victory",
    batch: "B",
    positive:
      "VICTORY screen graphic, triumphant armored mech standing over a defeated opponent in a dark arena, dramatic upward angle, golden light rays breaking through from above, glowing gold and ice-blue energy, sparks and debris settling, dark atmospheric background, cinematic game UI overlay feel, high contrast, powerful composition, electric atmosphere",
    negative:
      "text, watermark, blurry, cartoon, human, defeat, death, blood, gore",
    width: 1024,
    height: 576,
    seed: 42005,
  },
  {
    name: "ffpl_result_defeat",
    batch: "B",
    positive:
      "DEFEAT screen graphic, damaged armored mech kneeling in a dark arena, sparks flying from broken chassis, red emergency lighting, smoke billowing, dark oppressive atmosphere, deep shadows, glowing red warning lights, cinematic game over mood, dramatic low angle, sci-fi art",
    negative:
      "text, watermark, blurry, cartoon, human, blood, gore, bright sunlight",
    width: 1024,
    height: 576,
    seed: 42006,
  },
  {
    name: "ffpl_result_draw",
    batch: "B",
    positive:
      "DRAW screen graphic, two armored mechs standing facing each other at distance in a dark arena, both damaged and steaming, equal energy aura on both sides, one glowing blue one glowing red, symmetrical composition, tense standoff atmosphere, smoke and sparks, neutral grey-blue atmospheric lighting, cinematic sci-fi game art",
    negative:
      "text, watermark, blurry, cartoon, human, blood, gore",
    width: 1024,
    height: 576,
    seed: 42007,
  },

  // ════════════════════════════════════════════════════
  // BATCH C — PLAYER PROFILE AVATARS
  // ════════════════════════════════════════════════════
  {
    name: "ffpl_avatar_assault",
    batch: "C",
    positive:
      "player avatar portrait, heavy assault armored core mech, close-up front-facing bust shot, massive shoulder cannons, thick angular plating, glowing red targeting sensors, dark arena background, dramatic industrial lighting, ice-blue cockpit glow, scarred battle-worn metal, sci-fi portrait, game avatar square format",
    negative:
      "human, pilot, text, watermark, cartoon, anime, blurry, low quality",
    width: 512,
    height: 512,
    seed: 42008,
  },
  {
    name: "ffpl_avatar_recon",
    batch: "C",
    positive:
      "player avatar portrait, lightweight recon armored core mech, sleek agile frame, sharp angular head unit, multi-sensor array, glowing blue eyes, carbon fiber paneling, stealth black and silver chassis, speed blurs, dark background with circuit pattern, sci-fi game avatar square portrait",
    negative:
      "human, pilot, text, watermark, cartoon, anime, blurry, bulky, heavy",
    width: 512,
    height: 512,
    seed: 42009,
  },
  {
    name: "ffpl_avatar_artillery",
    batch: "C",
    positive:
      "player avatar portrait, long-range artillery armored core mech, tall imposing frame, massive railgun arm, targeting scope eye unit, gold and navy color scheme, elegant but lethal design, glowing gold energy coils, dark atmospheric background, sci-fi game avatar square portrait",
    negative:
      "human, pilot, text, watermark, cartoon, anime, blurry, close range weapons",
    width: 512,
    height: 512,
    seed: 42010,
  },
  {
    name: "ffpl_avatar_balanced",
    batch: "C",
    positive:
      "player avatar portrait, balanced mid-range armored core mech, clean symmetrical design, dual arm blades and shoulder missiles, ice-blue and white color scheme, pristine angular plating, advanced sensor dome head, dignified champion posture, clean sci-fi aesthetic, game avatar square portrait, dark navy background",
    negative:
      "human, pilot, text, watermark, cartoon, anime, blurry, damaged",
    width: 512,
    height: 512,
    seed: 42011,
  },

  // ════════════════════════════════════════════════════
  // BATCH D — UI BACKGROUNDS & COMMISSIONER ASSETS
  // ════════════════════════════════════════════════════
  {
    name: "ffpl_commissioner_badge",
    batch: "D",
    positive:
      "FFPL Commissioner official badge, circular shield-shaped emblem, ornate mechanical gear border, central armored mech crest, STANDARD tier markings, deep navy blue and gold color scheme, metallic sheen, engraved circuit patterns, official government seal aesthetic mixed with sci-fi military insignia, high detail, centered composition, dark background",
    negative:
      "text, letters, words, watermark, blurry, cartoon, human, asymmetrical",
    width: 512,
    height: 512,
    seed: 42012,
  },
  {
    name: "ffpl_header_strip",
    batch: "D",
    positive:
      "website header background strip, extremely wide and narrow panoramic, dark navy and black gradient, subtle hexagonal carbon fiber texture, faint circuit board tracery, very slight ice-blue glow along bottom edge, no focal subject, abstract geometric dark industrial pattern, tileable horizontal band, UI background texture",
    negative:
      "text, watermark, mech, figure, human, bright colors, cartoon, focal point subject",
    width: 1024,
    height: 192,
    seed: 42013,
  },
  {
    name: "ffpl_menu_bg_dark",
    batch: "D",
    positive:
      "dark UI menu background texture, deep space black with very subtle hexagonal plate armor pattern, faint blue-grey grid lines, dark carbon composite material surface, micro-detail industrial texture, top-secret military terminal aesthetic, no focal subject, seamless tileable texture, ultra dark",
    negative:
      "text, watermark, bright colors, cartoon, figure, human, mech, focal point, gradient sky",
    width: 1024,
    height: 1024,
    seed: 42014,
  },
  {
    name: "ffpl_favicon_source",
    batch: "D",
    positive:
      "favicon source image, extremely bold simple geometric logo mark, stylized angular letter F inside diamond frame, electric blue on pure black, maximum contrast, flat design, thick strokes, instantly recognizable at tiny size, minimal detail, sci-fi military insignia style",
    negative:
      "text beyond single letter, watermark, complex detail, gradients, photograph, human",
    width: 512,
    height: 512,
    seed: 42015,
  },
];

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
        seed: seed,
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
  const data = await res.json();
  console.log(`  [${label}] queued — ${data.prompt_id}`);
  return data.prompt_id;
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
        for (const img of imgs) {
          console.log(`  [${label}] DONE → ${img.filename}`);
        }
        return imgs;
      }
    }
  }
  console.error(`  [${label}] TIMEOUT`);
  return null;
}

async function runBatch(assets, batchLabel) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`BATCH ${batchLabel} — ${assets.length} assets`);
  console.log(`${"═".repeat(60)}`);

  const results = [];
  for (const asset of assets) {
    const wf = buildFluxWorkflow(asset);
    const id = await queuePrompt(wf, asset.name);
    if (id) {
      const imgs = await pollUntilDone(id, asset.name);
      if (imgs) results.push({ name: asset.name, files: imgs.map((i) => i.filename) });
    }
  }
  return results;
}

async function main() {
  console.log("FFPL Asset Generation — Flux.1-schnell");
  console.log(`Generating ${ASSETS.length} assets across 4 batches\n`);

  const batches = ["A", "B", "C", "D"];
  const allResults = [];

  for (const batchId of batches) {
    const assets = ASSETS.filter((a) => a.batch === batchId);
    const results = await runBatch(assets, batchId);
    allResults.push(...results);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("ALL DONE — Summary:");
  for (const r of allResults) {
    console.log(`  ${r.name}: ${r.files.join(", ")}`);
  }
  console.log(`\nOutput dir: ${OUTPUT_DIR}`);
}

main().catch(console.error);
