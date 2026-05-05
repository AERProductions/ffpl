// ComfyUI Flux.1-schnell submission script for FFPL hero graphic
// Usage: node generate_ffpl_hero.mjs

const COMFY_URL = "http://127.0.0.1:8000";
const CLIENT_ID = "ffpl-hero-gen-001";

const PROMPTS = [
  // Primary: lone unmanned AC mech, hero format
  {
    name: "ac_hero_lone",
    positive: "a sleek futuristic unmanned armored combat mech, Armored Core style, standing on a darkened arena floor, cinematic lighting, glowing ice-blue energy accents, dark navy background, chrome and carbon fiber plating, angular silhouette, dramatic low angle shot, no pilot, autonomous machine, depth of field, ultra-detailed, sci-fi concept art, 8k",
    negative: "pilot, cockpit, human, person, text, watermark, blurry, cartoon, anime, pastel, bright white background",
    width: 896,
    height: 1024,
  },
  // Secondary: two ACs facing off in arena
  {
    name: "ac_battle_arena",
    positive: "two futuristic unmanned armored mechs facing each other in a dark high-tech arena, Armored Core Formula Front style, dramatic backlit silhouettes, glowing blue and red energy highlights, sparks, cinematic composition, dark floor reflections, sci-fi industrial setting, concept art, hyper-detailed",
    negative: "pilot, human, cockpit, text, watermark, cartoon, anime, childish",
    width: 1024,
    height: 768,
  },
];

function buildFluxWorkflow({ positive, negative, width, height, seed }) {
  return {
    "1": {
      class_type: "UNETLoader",
      inputs: {
        unet_name: "flux1-schnell.safetensors",
        weight_dtype: "default",
      },
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
      inputs: {
        vae_name: "ae.safetensors",
      },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: positive,
        clip: ["2", 0],
      },
    },
    "5": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negative,
        clip: ["2", 0],
      },
    },
    "6": {
      class_type: "EmptySD3LatentImage",
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    "7": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        positive: ["4", 0],
        negative: ["5", 0],
        latent_image: ["6", 0],
        seed: seed ?? Math.floor(Math.random() * 2 ** 32),
        steps: 4,
        cfg: 1.0,
        sampler_name: "euler",
        scheduler: "simple",
        denoise: 1.0,
      },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["7", 0],
        vae: ["3", 0],
      },
    },
    "9": {
      class_type: "SaveImage",
      inputs: {
        images: ["8", 0],
        filename_prefix: `ffpl_hero`,
      },
    },
  };
}

async function queuePrompt(workflow, label) {
  const body = JSON.stringify({
    prompt: workflow,
    client_id: CLIENT_ID,
  });
  const res = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[${label}] Queue failed (${res.status}): ${err}`);
    return null;
  }
  const data = await res.json();
  console.log(`[${label}] Queued — prompt_id: ${data.prompt_id}`);
  return data.prompt_id;
}

async function pollUntilDone(promptId, label, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${COMFY_URL}/history/${promptId}`);
    const data = await res.json();
    if (data[promptId]) {
      const outputs = data[promptId].outputs;
      const nodeKeys = Object.keys(outputs);
      if (nodeKeys.length > 0) {
        const images = outputs[nodeKeys[0]]?.images ?? [];
        for (const img of images) {
          console.log(`[${label}] DONE — filename: ${img.filename}  subfolder: ${img.subfolder}  type: ${img.type}`);
        }
        return outputs;
      }
    }
  }
  console.log(`[${label}] Timed out waiting for result`);
  return null;
}

async function main() {
  for (const p of PROMPTS) {
    const wf = buildFluxWorkflow(p);
    const id = await queuePrompt(wf, p.name);
    if (id) {
      await pollUntilDone(id, p.name);
    }
  }
}

main().catch(console.error);
