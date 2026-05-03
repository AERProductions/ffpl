import createModule from './psp-encryption.js';

let pspModule = null;

export async function decryptPspSave(arrayBuffer) {
  console.log('[DEBUG] Starting decryptPspSave...');
  if (!pspModule) {
    console.log('[DEBUG] Creating WASM module...');
    try {
      pspModule = await createModule({
        locateFile: (path) => {
          if (path.endsWith('.wasm')) {
            console.log('[DEBUG] Locating:', path);
            return '/psp-encryption.wasm';
          }
          return path;
        }
      });
      console.log('[DEBUG] WASM module created successfully');
    } catch(e) {
      console.error('[DEBUG] WASM module creation failed', e);
      throw e;
    }

    console.log('[DEBUG] Triggering Kirk init...');
    pspModule._kirk_init();
    console.log('[DEBUG] Kirk init done');
  }

  console.log('[DEBUG] Wrapping decrypt function limit...');
  const decryptSaveData = pspModule.cwrap('decrypt_save_buffer', 'number', ['number', 'number', 'number']);
  
  const saveArr = new Uint8Array(arrayBuffer);
  
  // The Formula Front Extreme Battle Keys
  const keysToTry = [
    'e802030c605aa5241200a4931a00a593', // US
    '4603030c6060a5241200a4931a00a593'  // JP International
  ];
  
  let decryptedBuf = null;
  let success = false;

  const keyPtr = pspModule._malloc(16);
  const lenPtr = pspModule._malloc(4);
  const savePtr = pspModule._malloc(saveArr.length);

  for (const keyHex of keysToTry) {
    // Reset the heap to the ORIGINAL encrypted file bytes each try
    pspModule.HEAPU8.set(saveArr, savePtr);
    pspModule.setValue(lenPtr, saveArr.length, 'i32');

    // Parse Key
    const keyArr = new Uint8Array(16);
    for(let i=0; i<16; i++) {
        keyArr[i] = parseInt(keyHex.substr(i*2, 2), 16);
    }
    pspModule.HEAPU8.set(keyArr, keyPtr);

    console.log(`[ARCH-NEXUS] Firing PSP-WASM Kirk decryption engine with key ${keyHex}...`);
    // Using 3 args defaults to SDATA secure mode (verifies MAC)
    const res = decryptSaveData(savePtr, lenPtr, keyPtr);

    if (res === 0) {
      const outLen = pspModule.getValue(lenPtr, 'i32');
      console.log(`[ARCH-NEXUS] Decryption SUCCESS! Payload size: ${outLen} bytes`);
      
      decryptedBuf = new Uint8Array(outLen);
      decryptedBuf.set(pspModule.HEAPU8.subarray(savePtr, savePtr + outLen));
      success = true;
      break;
    } else {
      console.log(`[ARCH-NEXUS] Decryption failed with code ${res}, trying next key...`);
    }
  }

  // cleanup
  pspModule._free(savePtr);
  pspModule._free(keyPtr);
  pspModule._free(lenPtr);

  if (!success) {
    throw new Error(`Decryption failed natively. No known keys worked or the file is already unencrypted!`);
  }

  return decryptedBuf;
}
