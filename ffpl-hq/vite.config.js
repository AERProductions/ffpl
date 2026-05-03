import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Set VITE_TARGET=web for the static web build (Hostinger).
// Desktop (Wails) builds leave VITE_TARGET unset.
const isWeb = process.env.VITE_TARGET === 'web';

// Web build is served at https://ffplhq.com/hq/ — assets must use that base.
// Wails desktop build requires relative paths ('./' not '/').
const base = isWeb ? '/hq/' : './';

export default defineConfig({
  plugins: [react()],
  base,
  resolve: isWeb ? {
    alias: {
      // Swap out auto-generated Wails bindings for browser-safe shims.
      [path.resolve('./src/wailsjs/go/main/App.js')]:        path.resolve('./src/lib/wails-shim-app.js'),
      [path.resolve('./src/wailsjs/runtime/runtime.js')]:    path.resolve('./src/lib/wails-shim-runtime.js'),
    },
  } : {},
})
