/**
 * FFPL Result Screens — Regeneration
 *
 * VICTORY: 8 seeds. Spelling locked: V-I-C-T-O-R-Y, seven letters, no omissions.
 * DEFEAT:  4 seeds while we're at it. D-E-F-E-A-T.
 * DRAW:    4 seeds. D-R-A-W.
 *
 * Lesson from logo iterations:
 *   - Structural anchoring works: "text sits in the top third", "text above the mech"
 *   - Explicit letter-by-letter spelling helps
 *   - Separator / positional constraints help the model commit to a layout
 */

const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-results-regen-001";

// ─────────────────────────────────────────────────────────────────────────────
// VICTORY
// ─────────────────────────────────────────────────────────────────────────────
const VICTORY_SEEDS = [46001, 46002, 46003, 46004, 46005, 46006, 46007, 46008];

const VICTORY_VARIANTS = [
  // V1 — clean top banner text above dramatic scene
  {
    seed: 46001,
    positive: `esports match result screen, triumphant armored mech standing victorious in a dark arena, dramatic upward camera angle, golden light rays from above, glowing ice-blue chest core, sparks and debris settling around its feet, cinematic atmosphere, the word VICTORY displayed large in the upper portion of the image in bold condensed white capital letters with ice-blue glow and drop shadow, VICTORY spelled V then I then C then T then O then R then Y, seven letters total, text is cleanly legible above the mech, dark cinematic background, game result screen aesthetic, high contrast sci-fi concept art`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, wrong spelling, missing T, missing letters, extra letters, text on mech body, watermark, blurry, cartoon, human, gore, blood, bright pastel colors`,
  },
  // V2 — text in lower third instead, mech fills frame
  {
    seed: 46002,
    positive: `esports match result screen, massive triumphant armored mech fills the upper frame, dark arena with spotlight from above, golden victory light rays, ice-blue energy accents on shoulder armor and chest, dramatic low angle shot looking up, the word VICTORY appears in the bottom third of the image in large bold condensed italic white capitals with glowing ice-blue neon outline, V-I-C-T-O-R-Y seven letters all present, text centered horizontally in lower panel, dark atmospheric sci-fi game UI`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, missing T, missing C, missing letters, extra letters, text floating on mech, watermark, blurry, cartoon, human`,
  },
  // V3 — full bleed cinematic, text top center with neon treatment
  {
    seed: 46003,
    positive: `game victory screen key art, cinematic widescreen, armored mech warrior raising one arm cannon skyward in triumph, golden sparks erupting from cannon barrel, dark navy arena floor with reflections, atmospheric fog, the single word VICTORY in massive bold italic impact-style font at the top center of the frame, glowing electric ice-blue color with inner light and outer glow, perfectly spelled V I C T O R Y all seven letters present, dramatic result screen composition`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, misspelled, missing T, wrong letters, text overlapping mech center mass, watermark, blurry, anime, cartoon, human pilot`,
  },
  // V4 — minimalist dark with text dominant
  {
    seed: 46004,
    positive: `match victory announcement screen, dark navy black background with subtle hex grid texture, triumphant armored mech silhouette glowing from within with gold and ice-blue energy, centered in lower half of frame, the word VICTORY dominates the upper half in extremely large bold condensed white italic capitals, ice-blue glow around each letter, correct spelling V then I then C then T then O then R then Y, seven letters, no more no less, esports league result screen, premium game UI aesthetic`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, missing letter T, missing any letter, extra letters, watermark, cartoon, human, blurry`,
  },
  // V5 — golden hour dramatic
  {
    seed: 46005,
    positive: `VICTORY screen graphic for esports league, armored core mech standing tall in dramatic golden arena light, rays of gold breaking through dark clouds from above, ice-blue energy lines across plating, the text VICTORY in the top band of the image, bold condensed white capitals with gold and ice-blue dual glow, the word is seven letters: V I C T O R Y, cinematic composition, dark dramatic background below the text band, result screen overlay aesthetic`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, misspelled VICTORY, missing T in VICTORY, extra letters in VICTORY, text across mech body, watermark, blurry, cartoon, human`,
  },
  // V6 — text very explicit, structural
  {
    seed: 46006,
    positive: `esports victory result screen, the complete seven-letter word VICTORY printed large at top: first letter V, second letter I, third letter C, fourth letter T, fifth letter O, sixth letter R, seventh letter Y, bold italic condensed white font with ice-blue neon glow on pure dark background top band, below the text band a dramatic armored mech standing victorious in dark arena with golden light rays and ice-blue energy, cinematic sci-fi game art, high production quality`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, six letters, eight letters, missing T, missing C, misspelled, watermark, blurry, cartoon, human`,
  },
  // V7 — vary composition with mech in background
  {
    seed: 46007,
    positive: `victory game screen, dark moody cinematic arena, armored mech in background with glowing chest core and shoulder energy vents, golden particle effects raining down, dark reflective floor, large bold condensed italic all-caps text VICTORY centered in the image with strong ice-blue LED backlight glow, the word spells V-I-C-T-O-R-Y across seven characters, white letterforms with electric blue glow, result screen for sci-fi mech combat league`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, wrong number of letters, T missing from VICTORY, watermark, blurry, cartoon, human, anime style`,
  },
  // V8 — near-black, text as hero
  {
    seed: 46008,
    positive: `esports result screen, almost pure black background with very faint hexagonal carbon fiber texture, armored mech silhouette in center lower half emitting gold and ice-blue light, the hero element is the word VICTORY displayed huge across the top half, serif-free bold italic condensed white capitals with ice-blue glowing outline and subtle gold inner glow, seven-letter word V I C T O R Y correctly spelled, cinematic premium feel, sci-fi combat league branding`,
    negative: `VICOORY, VICORY, VICTOY, VICTRY, VICORY, misspelled, missing T, extra letters, text on mech, watermark, blurry, cartoon, human`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFEAT
// ─────────────────────────────────────────────────────────────────────────────
const DEFEAT_VARIANTS = [
  {
    seed: 46101,
    positive: `esports match defeat result screen, destroyed armored mech kneeling or collapsed in a dark arena, sparks and smoke rising from damaged plating, red emergency lighting, dark oppressive atmosphere, the word DEFEAT large at the top in bold condensed white capitals with glowing red outline and drop shadow, correctly spelled D-E-F-E-A-T six letters, cinematic sci-fi game result screen, dark dramatic mood`,
    negative: `DEFAT, DEAT, DFEAT, missing E, missing letters, extra letters, misspelled, victory imagery, bright colors, watermark, blurry, cartoon, human`,
  },
  {
    seed: 46102,
    positive: `defeat screen for mech combat esports, dark red and black atmosphere, armored mech with cracked plating and failing energy core, one knee down on arena floor, the single word DEFEAT in massive bold italic condensed font at top of image, D-E-F-E-A-T six letters all present, red neon glow on letterforms, dark cinematic composition, sci-fi league result screen aesthetic`,
    negative: `DEFAT, DEAT, DFEAT, missing any letter, misspelled, watermark, blurry, cartoon, human, green tones`,
  },
  {
    seed: 46103,
    positive: `esports loss result screen, cinematic widescreen, armored mech damaged and slumped in dark arena with red emergency strobes, smoke and debris, oppressive dark atmosphere, the word DEFEAT displayed large in bold condensed italic white letters with deep red glow, spelled D then E then F then E then A then T, six letters total, text sits in upper band of image above the mech scene`,
    negative: `DEFAT, DEAT, DFEAT, wrong spelling, missing letters, watermark, blurry, cartoon, human`,
  },
  {
    seed: 46104,
    positive: `defeat game screen key art, near-black background with dark red atmospheric lighting, armored mech silhouette collapsing, the hero word DEFEAT huge bold condensed italic across the top, D-E-F-E-A-T, six letters, white font with red LED glow, dark sci-fi result screen, mech combat esports league`,
    negative: `DEFAT, DEAT, DFEAT, misspelled DEFEAT, wrong letters, watermark, blurry, cartoon, human`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRAW
// ─────────────────────────────────────────────────────────────────────────────
const DRAW_VARIANTS = [
  {
    seed: 46201,
    positive: `esports match draw result screen, two armored mechs facing each other in standoff across dark arena, neither victorious, tense atmosphere, ice-blue and silver neutral lighting, the word DRAW large at top in bold condensed italic white capitals with silver-white glow, correctly spelled D-R-A-W four letters, cinematic sci-fi result screen`,
    negative: `DRWA, DRW, DAW, missing letters, misspelled, watermark, blurry, cartoon, human`,
  },
  {
    seed: 46202,
    positive: `draw result screen for mech combat esports, two mechs symmetrically facing off, dark neutral atmosphere with ice-blue ambient glow, both mechs at equal power, the word DRAW in massive bold condensed italic white font at top center, D then R then A then W four letters, silver and blue glow, cinematic composition, sci-fi league result screen`,
    negative: `DRWA, DRW, DAW, misspelled, missing letters, watermark, blurry, cartoon, human`,
  },
  {
    seed: 46203,
    positive: `tied match announcement screen, dark neutral arena, two armored mechs in mirror standoff position, cool silver-blue atmospheric lighting, the word DRAW large and bold at top, D-R-A-W four letters spelled correctly, white condensed bold italic capitals with ice-blue glow outline, esports result screen aesthetic, cinematic composition`,
    negative: `DRWA, DRW, DAW, misspelled, wrong letters, watermark, blurry, cartoon, human`,
  },
  {
    seed: 46204,
    positive: `draw game result screen, near-black background, two mech silhouettes facing each other with matching ice-blue energy cores, tense standoff mood, hero word DRAW across the top in huge bold condensed italic white letters D-R-A-W, silver neon glow, premium esports sci-fi result screen, mech combat league`,
    negative: `DRWA, DRW, DAW, wrong spelling, missing letters, watermark, blurry, cartoon, human`,
  },
];

const ALL_ASSETS = [
  ...VICTORY_VARIANTS.map((v) => ({ ...v, name: `ffpl_result_victory_regen_s${v.seed}`, width: 1024, height: 576 })),
  ...DEFEAT_VARIANTS.map((v) => ({ ...v, name: `ffpl_result_defeat_regen_s${v.seed}`, width: 1024, height: 576 })),
  ...DRAW_VARIANTS.map((v) => ({ ...v, name: `ffpl_result_draw_regen_s${v.seed}`, width: 1024, height: 576 })),
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
  console.log("FFPL Result Screens — Full Regeneration");
  console.log(`VICTORY: ${VICTORY_VARIANTS.length} seeds | DEFEAT: ${DEFEAT_VARIANTS.length} seeds | DRAW: ${DRAW_VARIANTS.length} seeds`);
  console.log(`Total: ${ALL_ASSETS.length} images at 1024×576\n`);

  for (const asset of ALL_ASSETS) {
    const label = asset.name.includes("victory") ? "VICTORY" : asset.name.includes("defeat") ? "DEFEAT" : "DRAW";
    console.log(`\n── [${label}] seed ${asset.seed} ──────────────────────`);
    const id = await queuePrompt(buildFluxWorkflow(asset), asset.name);
    if (id) await pollUntilDone(id, asset.name);
  }

  console.log("\n══════════════════════════════════════════════════════");
  console.log("Done. Files in: C:/Users/ABL/Documents/ComfyUI/output");
  console.log("VICTORY: ffpl_result_victory_regen_s46001_*.png → s46008");
  console.log("DEFEAT:  ffpl_result_defeat_regen_s46101_*.png  → s46104");
  console.log("DRAW:    ffpl_result_draw_regen_s46201_*.png    → s46204");
}

main().catch(console.error);
