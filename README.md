# PocketLedger (SiManU) 📱💳

> **Mobile-First, 100% Offline-Ready Personal Finance & Split Bill Progressive Web App (PWA) with Capacitor Android Native Build.**

---

## 🌟 Fitur Utama

- **100% Offline-First:** Seluruh data keuangan tersimpan aman secara lokal di perangkat Anda menggunakan **IndexedDB** melalui **Dexie.js** tanpa memerlukan koneksi internet ataupun server pihak ketiga (*Zero-Server Privacy*).
- **Mobile-First Touch UI:** Desain antarmuka responsif yang disesuaikan khusus untuk layar ponsel (`max-w-md`), keypad angka bawaan (`inputmode="numeric"`), serta pencegahan *pull-to-refresh* tak sengaja (`overscroll-behavior-y: contain`).
- **Transaksi Harian Reaktif:**
  - Manajemen multi-dompet (*Tunai, BCA, GoPay, dll.*).
  - Ringkasan otomatis: Total Saldo, Pemasukan Bulan Ini, dan Pengeluaran Bulan Ini.
  - Riwayat transaksi terkelompok per tanggal (*Hari ini, Kemarin*) dengan tombol hapus cepat berkonfirmasi.
- **Kalkulator Split Bill Pintar (Itemized & Proporsional):**
  - Pembagian tagihan patungan per menu/item.
  - **Pajak & Service Charge dihitung secara proporsional** berdasarkan subtotal pesanan individu (tidak dibagi rata buta).
  - Biaya flat (parkir/ongkir) dibagi rata ke seluruh peserta.
  - **Salin Format WhatsApp:** Menghasilkan format pesan terstruktur rapi untuk dibagikan langsung ke grup WhatsApp lengkap dengan nomor rekening/e-wallet penagih.
- **Analisis Keuangan Visual:**
  - Diagram Lingkaran (**Doughnut Chart**) berbasis **SVG murni** yang tajam dan super ringan (<4KB) tanpa dependensi library eksternal.
  - Peringkat alokasi pengeluaran per kategori dari terbesar ke terkecil dengan indikator persentase.
  - Filter periode fleksibel (Bulan Ini, Sepanjang Tahun, atau pilihan Bulan & Tahun).
- **Pencadangan & Pemulihan (Zero-Server Backup):**
  - **Ekspor JSON:** Unduh seluruh database dalam format `.json` untuk dipindahkan ke perangkat lain.
  - **Impor JSON:** Pulihkan data lama dengan validasi integritas struktur tanpa merusak database.
  - **Reset Data Pabrik:** Dilengkapi sistem konfirmasi ganda (ketik `RESET`).
- **Kesiapan Mobile Native (Capacitor & PWABuilder):**
  - Skema aman Android (`https://localhost`) untuk menjaga ketahanan IndexedDB.
  - Status Bar terintegrasi dengan warna dark slate (`#0f172a`) dan teks terang.
  - Dukungan notch dan navigation bar gesture Android (*safe-area-insets*).
  - Berkas `manifest.json` lengkap dengan ikon *maskable* dan *screenshots* siap kemas di **PWABuilder.com**.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla JavaScript (Modern ES Modules), HTML5 Canvas
- **Styling:** Tailwind CSS CDN (Dark Slate Theme)
- **Database Lokal:** Dexie.js (IndexedDB Wrapper)
- **Ikonografi:** Lucide Icons & FontAwesome 6
- **PWA:** Service Worker v2.0 (Cache-First Architecture)
- **Mobile Wrapper:** Capacitor.js (@capacitor/core, @capacitor/android, @capacitor/status-bar)

---

## 🚀 Panduan Menjalankan

### 1. Menjalankan di Browser Lokal (PWA)
Anda dapat menjalankan server lokal sederhana menggunakan Python atau Node.js:
```bash
# Menggunakan Python
python -m http.server 3000

# Atau menggunakan Node.js
npx serve .
```
Buka `http://localhost:3000` di peramban Anda.

### 2. Membangun Berkas Android APK (Capacitor)
```bash
# 1. Salin aset web ke folder build www
npm run build

# 2. Sinkronisasikan aset ke proyek native Android
npm run cap:sync

# 3. Buka proyek di Android Studio
npm run cap:open
```
Di Android Studio, pilih **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)** untuk membuat berkas `app-debug.apk`.

### 3. Mengemas via PWABuilder.com
1. Deploy repositori ini ke hosting HTTPS (seperti GitHub Pages, Vercel, atau Netlify).
2. Masukkan URL web Anda di [PWABuilder.com](https://www.pwabuilder.com/).
3. Unduh paket APK Android siap rilis dengan skor audit PWA 100%.

---

## 📂 Struktur Proyek

```text
SiManU/
├── index.html                  # Shell layout aplikasi & bottom navigation
├── manifest.json               # Konfigurasi PWA standar PWABuilder
├── sw.js                       # Service Worker Cache-First offline (v2.0)
├── capacitor.config.json       # Konfigurasi Android Capacitor (Secure Scheme)
├── package.json                # Dependensi & skrip build
├── icons/                      # Ikon PWA (any & maskable) dan screenshots
├── js/
│   ├── app.js                  # State Router & App Controller
│   ├── db.js                   # Skema Dexie.js & CRUD Service
│   ├── components/
│   │   ├── expense.js          # Tab Transaksi & Quick Add Bottom Sheet
│   │   ├── splitbill.js        # Tab Split Bill & Kalkulasi Proporsional
│   │   ├── analytics.js        # Tab Analisis & Diagram Donat SVG Murni
│   │   └── backup.js           # Tab Pengaturan, Manajemen Dompet & Backup JSON
│   └── utils/
│       ├── formatters.js       # Formatter Rupiah, Tanggal & Input Pad
│       └── share.js            # Generator Format Teks Rapi WhatsApp
├── scripts/
│   ├── build.js                # Skrip build aset ke folder www/
│   ├── generate-icons.py       # Generator ikon Python Pillow
│   └── generate-icons.html     # Generator ikon Canvas peramban
└── android/                    # Proyek native Android (Capacitor)
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
