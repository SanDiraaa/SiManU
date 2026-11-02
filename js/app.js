/**
 * PocketLedger Application Bootstrap & State Router
 * Menangani routing antar tab tanpa reload, Service Worker PWA, dan reaktivitas saldo
 */

import { initDB, WalletService, TransactionService, SplitBillService } from './db.js';
import { formatRupiah } from './utils/formatters.js';
import { ExpenseComponent } from './components/expense.js';
import { SplitBillComponent } from './components/splitbill.js';
import { AnalyticsComponent } from './components/analytics.js';
import { BackupSettingsComponent } from './components/backup.js';

class AppStateRouter {
  constructor() {
    this.currentTab = 'transaksi';
    this.wallets = [];
    this.transactions = [];
    this.splitBills = [];
    
    // Inisialisasi Komponen Pengeluaran / Transaksi
    this.expenseComponent = new ExpenseComponent({
      onDataChanged: async (shouldReload = false) => {
        if (shouldReload) {
          await this.loadDataFromDB();
        }
        this.renderCurrentView();
      }
    });

    // Inisialisasi Komponen Split Bill
    this.splitBillComponent = new SplitBillComponent({
      onDataChanged: async (shouldReload = false) => {
        if (shouldReload) {
          await this.loadDataFromDB();
        }
        this.renderCurrentView();
      }
    });

    // Inisialisasi Komponen Analisis
    this.analyticsComponent = new AnalyticsComponent({
      onDataChanged: () => {
        this.renderCurrentView();
      }
    });

    // Inisialisasi Komponen Pengaturan & Backup
    this.backupSettingsComponent = new BackupSettingsComponent({
      onDataChanged: async (shouldReload = false) => {
        if (shouldReload) {
          await this.loadDataFromDB();
        }
        this.renderCurrentView();
      }
    });

    this.tabButtons = {
      transaksi: document.getElementById('tab-transaksi'),
      splitbill: document.getElementById('tab-splitbill'),
      analisis: document.getElementById('tab-analisis'),
      pengaturan: document.getElementById('tab-pengaturan')
    };

    this.contentContainer = document.getElementById('app-content');
    this.headerTotalBalance = document.getElementById('header-total-balance');
  }

  /**
   * 1. Registrasi Service Worker untuk PWA Offline
   */
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        console.log('[PWA] Service Worker aktif dengan scope:', reg.scope);

        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[PWA] Konten baru tersedia, silakan refresh.');
              } else {
                console.log('[PWA] Konten berhasil dicache untuk penggunaan offline.');
              }
            }
          };
        };
      } catch (err) {
        console.warn('[PWA] Gagal meregistrasi Service Worker:', err);
      }
    }
  }

  /**
   * 2. Ambil Data Terbaru dari IndexedDB
   */
  async loadDataFromDB() {
    try {
      this.wallets = await WalletService.getAll();
      this.transactions = await TransactionService.getAll({ limit: 100 });
      this.splitBills = await SplitBillService.getAll();

      // Sinkronkan data ke komponen
      this.expenseComponent.setData(this.wallets, this.transactions);
      this.splitBillComponent.setSavedSessions(this.splitBills);
      this.analyticsComponent.setTransactions(this.transactions);
      this.backupSettingsComponent.setData(this.wallets, this.transactions, this.splitBills);

      // Perbarui status total saldo
      this.updateTotalBalanceStatus();
    } catch (err) {
      console.error('[App] Gagal memuat data dari IndexedDB:', err);
    }
  }

  /**
   * 3. Update Status Saldo Keseluruhan (Total Saldo = Penjumlahan saldo dompet)
   */
  updateTotalBalanceStatus() {
    const totalBalance = this.wallets.reduce((acc, w) => acc + (w.balance || 0), 0);
    if (this.headerTotalBalance) {
      this.headerTotalBalance.textContent = formatRupiah(totalBalance);
    }
  }

  /**
   * 4. State Router: Navigasi Antar Tab Tanpa Reload
   */
  navigateTo(tabName, updateHistory = true) {
    const validTabs = ['transaksi', 'splitbill', 'analisis', 'pengaturan'];
    const target = validTabs.includes(tabName) ? tabName : 'transaksi';

    this.currentTab = target;

    if (updateHistory) {
      window.location.hash = `#${target}`;
    }

    // Update styling tombol bottom navigation bar
    Object.entries(this.tabButtons).forEach(([key, btn]) => {
      if (!btn) return;
      const icon = btn.querySelector('.tab-icon');
      const label = btn.querySelector('.tab-label');

      if (key === target) {
        btn.className = 'tab-btn flex flex-col items-center justify-center py-2 px-3 text-emerald-400 font-medium transition-colors relative';
        if (icon) icon.className = 'tab-icon w-5 h-5 mb-1 text-emerald-400 stroke-[2.5]';
        if (label) label.className = 'tab-label text-xs font-semibold text-emerald-400';
      } else {
        btn.className = 'tab-btn flex flex-col items-center justify-center py-2 px-3 text-slate-400 hover:text-slate-200 transition-colors relative';
        if (icon) icon.className = 'tab-icon w-5 h-5 mb-1 text-slate-400 stroke-[1.8]';
        if (label) label.className = 'tab-label text-xs text-slate-400';
      }
    });

    this.renderCurrentView();
  }

  /**
   * 5. Render View Sesuai Tab Aktif
   */
  renderCurrentView() {
    if (!this.contentContainer) return;

    switch (this.currentTab) {
      case 'transaksi':
        this.contentContainer.innerHTML = this.expenseComponent.render();
        this.expenseComponent.bindEvents(this.contentContainer);
        break;

      case 'splitbill':
        this.contentContainer.innerHTML = this.splitBillComponent.render();
        this.splitBillComponent.bindEvents(this.contentContainer);
        break;

      case 'analisis':
        this.contentContainer.innerHTML = this.analyticsComponent.render();
        this.analyticsComponent.bindEvents(this.contentContainer);
        break;

      case 'pengaturan':
        this.contentContainer.innerHTML = this.backupSettingsComponent.render();
        this.backupSettingsComponent.bindEvents(this.contentContainer);
        break;

      default:
        this.contentContainer.innerHTML = this.expenseComponent.render();
        this.expenseComponent.bindEvents(this.contentContainer);
    }

    // Refresh ikon Lucide secara instan di setiap perenderan DOM
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /**
   * Inisialisasi Penuh Aplikasi
   */
  async init() {
    console.log('[PocketLedger] Initializing App & State Router...');

    // 1. Setup Tab Click Events
    Object.keys(this.tabButtons).forEach(tabKey => {
      const btn = this.tabButtons[tabKey];
      if (btn) {
        btn.addEventListener('click', () => this.navigateTo(tabKey));
      }
    });

    // 2. Setup Hash Change Listener (Back/Forward Navigation tanpa reload)
    window.addEventListener('hashchange', () => {
      const hashTab = window.location.hash.replace('#', '');
      if (hashTab && hashTab !== this.currentTab) {
        this.navigateTo(hashTab, false);
      }
    });

    // 3. Inisialisasi IndexedDB & Muat Data Awal
    try {
      await initDB();
      await this.loadDataFromDB();
    } catch (err) {
      console.error('[PocketLedger] Database initialization error:', err);
    }

    // 4. Registrasi Service Worker PWA
    await this.registerServiceWorker();

    // 5. Inisialisasi Android Status Bar (Capacitor Native)
    await this.configureStatusBar();

    // 6. Buka tab awal berdasarkan hash URL atau default ke 'transaksi'
    const initialHash = window.location.hash.replace('#', '');
    this.navigateTo(initialHash || 'transaksi', false);
  }

  /**
   * Konfigurasi Status Bar Android via Capacitor Plugins
   */
  async configureStatusBar() {
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.StatusBar) {
      try {
        const { StatusBar } = window.Capacitor.Plugins;
        // Set background status bar menyatu dengan dark slate (#0f172a)
        await StatusBar.setBackgroundColor({ color: '#0f172a' });
        // Style 'DARK' pada Capacitor Android menampilkan ikon & teks terang (putih)
        await StatusBar.setStyle({ style: 'DARK' });
        // Pastikan WebView tidak tertumpuk di bawah status bar
        await StatusBar.setOverlaysWebView({ overlay: false });
        console.log('[Capacitor] Android Status Bar berhasil diatur ke tema dark slate.');
      } catch (err) {
        console.warn('[Capacitor] Gagal mengatur Status Bar:', err);
      }
    }
  }
}

// Inisialisasi singleton aplikasi
const app = new AppStateRouter();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

export default app;
