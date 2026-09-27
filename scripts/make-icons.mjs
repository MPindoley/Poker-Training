// Renders public/icon-source.svg into the PNG icons the PWA manifest and iOS need.
// Usage: node scripts/make-icons.mjs  (needs a Chromium binary; set CHROMIUM=/path if not on PATH)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromium = process.env.CHROMIUM ?? 'chromium';
const svg = readFileSync('public/icon-source.svg', 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'icons-'));

const targets = [
  { file: 'pwa-192.png', size: 192, pad: 0 },
  { file: 'pwa-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  // The chip already sits inside the maskable safe zone (central 80% circle), so no padding needed.
  { file: 'pwa-maskable-512.png', size: 512, pad: 0 },
];

for (const { file, size, pad } of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  const html = `<html><body style="margin:0;background:#0b4d2c;width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`;
  const page = join(dir, `${file}.html`);
  writeFileSync(page, html);
  execFileSync(chromium, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    `--window-size=${size},${size}`, `--screenshot=public/${file}`, `file://${page}`,
  ], { stdio: 'ignore' });
  console.log('wrote public/' + file);
}
