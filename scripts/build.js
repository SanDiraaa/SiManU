/**
 * PocketLedger Build Script for Capacitor
 * Menyalin aset web publik ke folder target 'www/' sebelum sinkronisasi Android
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.resolve(ROOT_DIR, 'www');

console.log('[Build] Menyiapkan direktori www...');

// 1. Bersihkan dan buat ulang direktori www
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

// 2. Berkas akar yang disalin
const rootFiles = ['index.html', 'manifest.json', 'sw.js'];
rootFiles.forEach(file => {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(WWW_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Build] Disalin: ${file}`);
  }
});

// 3. Folder yang disalin rekursif
const directories = ['icons', 'js'];
directories.forEach(dir => {
  const src = path.join(ROOT_DIR, dir);
  const dest = path.join(WWW_DIR, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`[Build] Direktori disalin: ${dir}/`);
  }
});

console.log('[Build] Selesai! Aset web siap di folder www/ untuk Capacitor.');

