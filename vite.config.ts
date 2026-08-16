import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// Published as a GitHub Pages project site at gordl.github.io/retirement-calculator/,
// so every asset URL needs that prefix. Dev server serves from '/' as usual.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/retirement-calculator/' : '/',
  plugins: [preact()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
}))
