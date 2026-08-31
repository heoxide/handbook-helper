import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { versionManifestPlugin } from './vite-plugins/version-manifest'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const rendererOutDir = resolve(__dirname, 'out/renderer')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version)
    },
    plugins: [
      react(),
      versionManifestPlugin({
        version: pkg.version,
        outDir: rendererOutDir,
        buildId: process.env.GITHUB_SHA
      })
    ]
  }
})
