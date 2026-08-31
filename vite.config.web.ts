import { resolve } from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { versionManifestPlugin } from './vite-plugins/version-manifest'

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))
const repoName = process.env.GITHUB_REPOSITORY_NAME || 'handbook-helper'
const base = process.env.GITHUB_PAGES === 'true' ? `/${repoName}/` : './'
const outDir = resolve(__dirname, 'dist/web')

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    react(),
    versionManifestPlugin({
      version: pkg.version,
      outDir,
      buildId: process.env.GITHUB_SHA
    })
  ],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  build: {
    outDir,
    emptyOutDir: true
  }
})
