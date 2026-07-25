import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        // Only externalize native modules that cannot be bundled.
        // Pure-JS packages (tfjs, nsfwjs, etc.) are bundled by Vite to
        // avoid runtime module-resolution failures in the packaged app.
        exclude: [
          '@tensorflow/tfjs',
          '@tensorflow/tfjs-backend-wasm',
          '@tensorflow/tfjs-core',
          '@tensorflow/tfjs-converter',
          '@tensorflow/tfjs-backend-cpu',
          'nsfwjs',
          'drizzle-orm',
          'zustand',
          'uuid',
          'exifr'
        ]
      })
    ],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'sharp', 'onnxruntime-node']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    },
    plugins: [react()]
  }
})
