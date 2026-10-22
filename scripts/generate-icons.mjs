import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="118" fill="#6554ce"/><path d="M145 142h116c61 0 94 26 94 70 0 28-15 48-38 57 30 8 49 30 49 64 0 48-37 77-98 77H145V142zm64 57v49h46c23 0 35-8 35-25 0-16-12-24-35-24h-46zm0 101v53h53c26 0 39-9 39-27 0-17-13-26-39-26h-53z" transform="translate(0,-23)" fill="#fff"/><path d="m370 111 9-28 9 28 28 9-28 9-9 28-9-28-28-9z" fill="#c9f0b5"/></svg>`
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/favicon.svg', import.meta.url), svg)
for (const size of [192, 512])
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname)
await sharp(Buffer.from(svg))
  .resize(400, 400)
  .extend({ top: 56, bottom: 56, left: 56, right: 56, background: '#6554ce' })
  .png()
  .toFile(new URL('../public/icons/maskable-512.png', import.meta.url).pathname)
