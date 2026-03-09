#!/usr/bin/env node
/**
 * Gera icon-192.png e icon-512.png a partir de public/icons/icon.svg
 * Uso: node scripts/generate-icons.mjs (ou pnpm icons:generate)
 * Requer: pnpm add -D sharp
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const iconsDir = join(root, 'public', 'icons')
const svgPath = join(iconsDir, 'icon.svg')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Instale sharp: pnpm add -D sharp')
  process.exit(1)
}

const svg = readFileSync(svgPath)
for (const size of [192, 512]) {
  const out = join(iconsDir, `icon-${size}.png`)
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log('Gerado:', out)
}
