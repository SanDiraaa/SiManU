/**
 * PocketLedger Bundler Script
 * Menggabungkan semua modul JS menjadi satu berkas mandiri (IIFE)
 * agar dapat berjalan di SEMUA lingkungan:
 * - Double-click di Windows Explorer (file:///) tanpa diblokir CORS browser
 * - HTTP / HTTPS / localhost
 * - PWA Service Worker Cache
 * - Capacitor WebView di Android
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const files = [
  'js/utils/formatters.js',
  'js/utils/share.js',
  'js/db.js',
  'js/components/expense.js',
  'js/components/splitbill.js',
  'js/components/analytics.js',
  'js/components/backup.js',
  'js/app.js'
];

console.log('[Bundler] Memulai penggabungan modul...');

let combinedCode = `/**
 * PocketLedger Universal Bundle
 * Berisi seluruh logika aplikasi, komponen UI, dan database Dexie IndexedDB
 * Dibuat otomatis untuk kompatibilitas penuh (file:///, http://, Android WebView)
 */
(function() {
  'use strict';
`;

files.forEach(relPath => {
  const fullPath = path.join(ROOT_DIR, relPath);
  let code = fs.readFileSync(fullPath, 'utf8');

  // Hapus semua baris import
  // Contoh: import { ... } from '...'; atau import xxx from '...';
  code = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '');
  
  // Hapus kata kunci export default
  code = code.replace(/^export\s+default\s+/gm, 'const _defaultExport = ');

  // Ubah 'export const x =' atau 'export function x' atau 'export async function x' atau 'export class x'
  code = code.replace(/^export\s+(const|let|var|function|async\s+function|class)\s+/gm, '$1 ');

  // Hapus deklarasi export { ... };
  code = code.replace(/^export\s*\{[\s\S]*?\};?/gm, '');

  combinedCode += `\n/* --- Start: ${relPath} --- */\n` + code + `\n/* --- End: ${relPath} --- */\n`;
});

combinedCode += `
  // Ekspos ke global window untuk debugging & integrasi luar jika diperlukan
  if (typeof window !== 'undefined') {
    window.PocketLedgerApp = app;
  }
})();
`;

const outputPath = path.join(ROOT_DIR, 'js', 'app.bundle.js');
fs.writeFileSync(outputPath, combinedCode, 'utf8');

console.log(`[Bundler] Berhasil membuat ${outputPath} (${fs.statSync(outputPath).size} bytes)`);

