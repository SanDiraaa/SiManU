/**
 * PocketLedger - Backup & Settings Component
 * Manajemen Dompet, Zero-Server Backup (Ekspor & Impor JSON), dan Reset Data Pabrik.
 */

import { db, WalletService, TransactionService, SplitBillService, DEFAULT_WALLETS } from '../db.js';
import { formatRupiah, parseNumberInput, formatInputDigits } from '../utils/formatters.js';

export class BackupSettingsComponent {
  constructor({ onDataChanged }) {
    this.onDataChanged = onDataChanged || (() => {});
    this.wallets = [];
    this.transactions = [];
    this.splitBills = [];

    // State Modal Dompet
    this.walletModal = {
      isOpen: false,
      isEdit: false,
      id: null,
      name: '',
      type: 'cash', // 'cash' | 'bank' | 'ewallet'
      balance: ''
    };

    // State Modal Reset Pabrik
    this.resetModal = {
      isOpen: false,
      step: 1, // 1: warning, 2: input confirmation
      confirmationText: ''
    };

    this.toastMessage = null;
  }

  setData(wallets, transactions, splitBills) {
    this.wallets = wallets || [];
    this.transactions = transactions || [];
    this.splitBills = splitBills || [];
  }

  showToast(message) {
    this.toastMessage = message;
    this.onDataChanged();
    setTimeout(() => {
      this.toastMessage = null;
      this.onDataChanged();
    }, 3000);
  }

  /**
   * 1. Ekspor Seluruh Record ke Berkas JSON
   */
  async exportBackup() {
    try {
      const allWallets = await db.wallets.toArray();
      const allTransactions = await db.transactions.toArray();
      const allSplitBills = await db.splitBills.toArray();

      const backupData = {
        appName: 'PocketLedger',
        appVersion: '1.2.0',
        exportedAt: new Date().toISOString(),
        databaseVersion: db.verno,
        summary: {
          walletsCount: allWallets.length,
          transactionsCount: allTransactions.length,
          splitBillsCount: allSplitBills.length
        },
        data: {
          wallets: allWallets,
          transactions: allTransactions,
          splitBills: allSplitBills
        }
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `pocketledger-backup-${dateStr}.json`;

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      this.showToast(`Berhasil mengekspor backup: ${filename}`);
    } catch (err) {
      console.error('Ekspor gagal:', err);
      alert('Gagal mengekspor data backup: ' + err.message);
    }
  }

  /**
   * 2. Impor dan Validasi Berkas JSON Backup
   */
  async importBackup(file) {
    if (!file) return;

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        throw new Error('Berkas bukan format JSON yang valid.');
      }

      // Validasi struktur berkas
      const dataPayload = parsed.data || parsed;
      if (!dataPayload.wallets || !Array.isArray(dataPayload.wallets)) {
        throw new Error('Format data tidak valid: Tabel "wallets" tidak ditemukan.');
      }

      const importedWallets = dataPayload.wallets;
      const importedTransactions = Array.isArray(dataPayload.transactions) ? dataPayload.transactions : [];
      const importedSplitBills = Array.isArray(dataPayload.splitBills) ? dataPayload.splitBills : [];

      if (importedWallets.length === 0) {
        throw new Error('Data backup tidak memiliki dompet aktif.');
      }

      const confirmRestore = confirm(
        `Pulihkan Backup?\n\n` +
        `• ${importedWallets.length} Dompet\n` +
        `• ${importedTransactions.length} Transaksi\n` +
        `• ${importedSplitBills.length} Sesi Split Bill\n\n` +
        `Data lokal saat ini akan ditimpa dengan data backup ini.`
      );

      if (!confirmRestore) return;

      // Jalankan restore atomik dalam transaksi Dexie
      await db.transaction('rw', db.wallets, db.transactions, db.splitBills, async () => {
        await db.wallets.clear();
        await db.transactions.clear();
        await db.splitBills.clear();

        await db.wallets.bulkAdd(importedWallets);
        if (importedTransactions.length > 0) {
          await db.transactions.bulkAdd(importedTransactions);
        }
        if (importedSplitBills.length > 0) {
          await db.splitBills.bulkAdd(importedSplitBills);
        }
      });

      this.showToast('Data berhasil dipulihkan dari backup JSON!');
      this.onDataChanged(true); // reload all data from DB
    } catch (err) {
      console.error('Impor gagal:', err);
      alert('Gagal mengimpor file backup: ' + err.message);
    }
  }

  /**
   * 3. Reset Data Pabrik (Factory Reset)
   */
  async performFactoryReset() {
    try {
      await db.transaction('rw', db.wallets, db.transactions, db.splitBills, async () => {
        await db.wallets.clear();
        await db.transactions.clear();
        await db.splitBills.clear();

        // Seed ulang dompet default
        await db.wallets.bulkAdd(DEFAULT_WALLETS);
      });

      this.resetModal.isOpen = false;
      this.resetModal.step = 1;
      this.resetModal.confirmationText = '';
      this.showToast('Database berhasil direset ke pengaturan awal.');
      this.onDataChanged(true);
    } catch (err) {
      console.error('Reset gagal:', err);
      alert('Gagal mereset database: ' + err.message);
    }
  }

  /**
   * Render Komponen Utama Pengaturan & Backup
   */
  render() {
    const totalTransactions = this.transactions.length;
    const totalSplitBills = this.splitBills.length;
    const totalWallets = this.wallets.length;

    return `
      <div class="space-y-4 animate-fade-in pb-20">
        
        <!-- TOAST NOTIFIKASI -->
        ${this.toastMessage ? `
          <div class="fixed top-16 inset-x-4 max-w-sm mx-auto bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-fade-in">
            <i data-lucide="check-circle-2" class="w-4 h-4 flex-shrink-0"></i>
            <span>${this.toastMessage}</span>
          </div>
        ` : ''}

        <!-- 1. MANAJEMEN DOMPET -->
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <i data-lucide="wallet" class="w-4 h-4"></i>
              </div>
              <div>
                <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200">Manajemen Dompet</h3>
                <p class="text-[10px] text-slate-400">Atur akun & saldo awal</p>
              </div>
            </div>
            <button id="btn-add-wallet" type="button" class="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 active:scale-95 transition-all">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              Tambah Dompet
            </button>
          </div>

          <div class="space-y-2 pt-1">
            ${this.wallets.map(w => `
              <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-2.5 h-2.5 rounded-full ${w.type === 'bank' ? 'bg-blue-400' : w.type === 'ewallet' ? 'bg-cyan-400' : 'bg-emerald-400'}"></div>
                  <div>
                    <div class="text-xs font-bold text-slate-100">${w.name}</div>
                    <div class="text-[10px] text-slate-400 uppercase tracking-wider">${w.type || 'cash'}</div>
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-xs font-mono font-bold text-white">${formatRupiah(w.balance || 0)}</span>
                  <div class="flex items-center gap-1">
                    <button type="button" data-edit-wallet-id="${w.id}" class="p-1 text-slate-400 hover:text-emerald-400" title="Edit Dompet">
                      <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    ${this.wallets.length > 1 ? `
                      <button type="button" data-delete-wallet-id="${w.id}" class="p-1 text-slate-500 hover:text-rose-400" title="Hapus Dompet">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 2. ZERO-SERVER BACKUP & RESTORE JSON -->
        <div class="bg-slate-800/70 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <i data-lucide="database" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200">Cadangkan & Pulihkan (JSON)</h3>
              <p class="text-[10px] text-slate-400">Zero-Server 100% Privasi di Perangkat Anda</p>
            </div>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            Semua data PocketLedger tersimpan di peramban Anda (IndexedDB). Anda dapat mengunduh seluruh data dalam format JSON untuk dipindahkan ke ponsel/perangkat lain kapan saja.
          </p>

          <div class="grid grid-cols-2 gap-3 pt-1">
            <!-- Tombol Ekspor JSON -->
            <button id="btn-export-json" type="button" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-700 hover:border-cyan-500/60 active:scale-[0.98] transition-all group">
              <i data-lucide="download" class="w-5 h-5 text-cyan-400 mb-1 group-hover:-translate-y-0.5 transition-transform"></i>
              <span class="text-xs font-bold text-white">Ekspor Data</span>
              <span class="text-[9px] text-slate-400 mt-0.5">Unduh file .json</span>
            </button>

            <!-- Tombol Impor JSON -->
            <label class="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-700 hover:border-indigo-500/60 active:scale-[0.98] transition-all cursor-pointer group">
              <i data-lucide="upload" class="w-5 h-5 text-indigo-400 mb-1 group-hover:-translate-y-0.5 transition-transform"></i>
              <span class="text-xs font-bold text-white">Pulihkan Data</span>
              <span class="text-[9px] text-slate-400 mt-0.5">Pilih file .json</span>
              <input type="file" id="input-import-json" accept=".json" class="hidden" />
            </label>
          </div>

          <!-- Statistik Database -->
          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-center">
            <div class="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
              <span class="text-[9px] text-slate-400 block">Dompet</span>
              <span class="text-xs font-bold text-white font-mono mt-0.5">${totalWallets}</span>
            </div>
            <div class="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
              <span class="text-[9px] text-slate-400 block">Transaksi</span>
              <span class="text-xs font-bold text-white font-mono mt-0.5">${totalTransactions}</span>
            </div>
            <div class="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
              <span class="text-[9px] text-slate-400 block">Split Bill</span>
              <span class="text-xs font-bold text-white font-mono mt-0.5">${totalSplitBills}</span>
            </div>
          </div>
        </div>

        <!-- 3. RESET DATA PABRIK -->
        <div class="bg-slate-800/40 border border-rose-500/30 rounded-3xl p-5 shadow-xl space-y-3">
          <div class="flex items-center gap-2 text-rose-400">
            <i data-lucide="alert-octagon" class="w-4 h-4"></i>
            <h3 class="text-xs font-bold uppercase tracking-wider">Zona Bahaya</h3>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Hapus seluruh catatan transaksi, tagihan split bill, dan kembalikan dompet ke bawaan awal.
          </p>
          <button id="btn-open-factory-reset" type="button" class="w-full py-2.5 px-4 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 active:scale-[0.98] text-xs font-bold transition-all flex items-center justify-center gap-1.5">
            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            Reset Data Pabrik (Factory Reset)
          </button>
        </div>

        <!-- 4. INFO APLIKASI & PWA -->
        <div class="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-4 divide-y divide-slate-700/50 text-xs">
          <div class="pb-2.5 flex items-center justify-between">
            <span class="text-slate-400">Versi PocketLedger</span>
            <span class="font-mono text-slate-200 font-semibold">v1.2.0 (Mobile PWA)</span>
          </div>
          <div class="py-2.5 flex items-center justify-between">
            <span class="text-slate-400">Status Penyimpanan</span>
            <span class="text-emerald-400 font-semibold flex items-center gap-1">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
              IndexedDB Aktif
            </span>
          </div>
          <div class="pt-2.5 flex items-center justify-between">
            <span class="text-slate-400">Dibuat untuk Layar Ponsel</span>
            <span class="text-slate-300">100% Offline Ready</span>
          </div>
        </div>

        <!-- MODAL FORM DOMPET (TAMBAH / EDIT) -->
        ${this.renderWalletModal()}

        <!-- MODAL KONFIRMASI GANDA RESET PABRIK -->
        ${this.renderResetModal()}

      </div>
    `;
  }

  /**
   * Render Modal Tambah / Edit Dompet
   */
  renderWalletModal() {
    if (!this.walletModal.isOpen) return '';

    const isEdit = this.walletModal.isEdit;

    return `
      <div id="wallet-modal-backdrop" class="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
          <div class="flex items-center justify-between">
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="wallet" class="w-4 h-4 text-emerald-400"></i>
              ${isEdit ? 'Edit Dompet' : 'Tambah Dompet Baru'}
            </h4>
            <button id="btn-close-wallet-modal" type="button" class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <form id="form-wallet" class="space-y-3.5">
            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1">Nama Dompet</label>
              <input
                type="text"
                id="input-wallet-name"
                value="${this.walletModal.name}"
                placeholder="Misal: Bank Jago, OVO, Brankas"
                class="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1">Tipe Dompet</label>
              <select id="select-wallet-type" class="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500 font-medium">
                <option value="cash" ${this.walletModal.type === 'cash' ? 'selected' : ''}>Tunai (Cash)</option>
                <option value="bank" ${this.walletModal.type === 'bank' ? 'selected' : ''}>Rekening Bank (BCA, Mandiri, dll)</option>
                <option value="ewallet" ${this.walletModal.type === 'ewallet' ? 'selected' : ''}>E-Wallet (GoPay, OVO, DANA)</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1">Saldo ${isEdit ? 'Sekarang' : 'Awal'}</label>
              <div class="relative flex items-center">
                <span class="absolute left-3 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="text"
                  id="input-wallet-balance"
                  inputmode="numeric"
                  value="${formatInputDigits(this.walletModal.balance)}"
                  placeholder="0"
                  class="w-full bg-slate-800/90 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-sm font-bold font-mono text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <div class="pt-2">
              <button type="submit" class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-1.5">
                <i data-lucide="check" class="w-4 h-4"></i>
                ${isEdit ? 'Simpan Perubahan' : 'Buat Dompet'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  /**
   * Render Modal Konfirmasi Ganda Reset Pabrik
   */
  renderResetModal() {
    if (!this.resetModal.isOpen) return '';

    return `
      <div id="reset-modal-backdrop" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-slate-900 border border-rose-500/50 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>

          <div class="text-center">
            <h4 class="text-sm font-bold text-white">Konfirmasi Reset Data Pabrik</h4>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Tindakan ini bersifat permanen. Seluruh transaksi dan sesi split bill akan terhapus.
            </p>
          </div>

          <div class="space-y-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-300">
            <p>Ketik kata <span class="text-rose-400 font-bold font-mono">RESET</span> di bawah ini untuk mengonfirmasi:</p>
            <input
              type="text"
              id="input-confirm-reset"
              value="${this.resetModal.confirmationText}"
              placeholder="Ketik RESET di sini..."
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase tracking-wider outline-none focus:border-rose-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button id="btn-cancel-reset" type="button" class="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
              Batal
            </button>
            <button
              id="btn-confirm-factory-reset"
              type="button"
              class="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-all"
              ${this.resetModal.confirmationText.trim() !== 'RESET' ? 'disabled' : ''}
            >
              Ya, Hapus Semua
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind Event Listeners
   */
  bindEvents(container) {
    if (!container) return;

    // 1. Ekspor JSON
    const btnExport = container.querySelector('#btn-export-json');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportBackup());
    }

    // 2. Impor JSON
    const inputImport = container.querySelector('#input-import-json');
    if (inputImport) {
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.importBackup(file);
        }
      });
    }

    // 3. Tambah Dompet
    const btnAddWallet = container.querySelector('#btn-add-wallet');
    if (btnAddWallet) {
      btnAddWallet.addEventListener('click', () => {
        this.walletModal = {
          isOpen: true,
          isEdit: false,
          id: null,
          name: '',
          type: 'cash',
          balance: ''
        };
        this.onDataChanged();
      });
    }

    // 4. Edit Dompet
    const editBtns = container.querySelectorAll('[data-edit-wallet-id]');
    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-edit-wallet-id'));
        const w = this.wallets.find(item => item.id === id);
        if (w) {
          this.walletModal = {
            isOpen: true,
            isEdit: true,
            id: w.id,
            name: w.name,
            type: w.type || 'cash',
            balance: String(w.balance || 0)
          };
          this.onDataChanged();
        }
      });
    });

    // 5. Hapus Dompet
    const deleteWalletBtns = container.querySelectorAll('[data-delete-wallet-id]');
    deleteWalletBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-delete-wallet-id'));
        if (this.wallets.length <= 1) {
          alert('Minimal harus ada 1 dompet aktif.');
          return;
        }

        const confirmDelete = confirm('Hapus dompet ini? Transaksi yang terhubung ke dompet ini mungkin terpengaruh.');
        if (confirmDelete) {
          await WalletService.delete(id);
          this.showToast('Dompet berhasil dihapus.');
          this.onDataChanged(true);
        }
      });
    });

    // 6. Modal Dompet Form Handler
    if (this.walletModal.isOpen) {
      const btnCloseWallet = container.querySelector('#btn-close-wallet-modal');
      if (btnCloseWallet) {
        btnCloseWallet.addEventListener('click', () => {
          this.walletModal.isOpen = false;
          this.onDataChanged();
        });
      }

      const inputBalance = container.querySelector('#input-wallet-balance');
      if (inputBalance) {
        inputBalance.addEventListener('input', (e) => {
          const parsed = parseNumberInput(e.target.value);
          this.walletModal.balance = String(parsed);
          e.target.value = formatInputDigits(parsed);
        });
      }

      const formWallet = container.querySelector('#form-wallet');
      if (formWallet) {
        formWallet.addEventListener('submit', async (e) => {
          e.preventDefault();
          const name = container.querySelector('#input-wallet-name')?.value.trim();
          const type = container.querySelector('#select-wallet-type')?.value || 'cash';
          const balance = parseNumberInput(this.walletModal.balance);

          if (!name) {
            alert('Nama dompet tidak boleh kosong.');
            return;
          }

          if (this.walletModal.isEdit && this.walletModal.id) {
            await WalletService.update(this.walletModal.id, { name, type, balance });
            this.showToast('Dompet berhasil diperbarui.');
          } else {
            await WalletService.add({ name, type, balance });
            this.showToast('Dompet baru berhasil ditambahkan.');
          }

          this.walletModal.isOpen = false;
          this.onDataChanged(true);
        });
      }
    }

    // 7. Modal Reset Pabrik
    const btnOpenReset = container.querySelector('#btn-open-factory-reset');
    if (btnOpenReset) {
      btnOpenReset.addEventListener('click', () => {
        this.resetModal.isOpen = true;
        this.resetModal.confirmationText = '';
        this.onDataChanged();
      });
    }

    if (this.resetModal.isOpen) {
      const btnCancelReset = container.querySelector('#btn-cancel-reset');
      if (btnCancelReset) {
        btnCancelReset.addEventListener('click', () => {
          this.resetModal.isOpen = false;
          this.onDataChanged();
        });
      }

      const inputReset = container.querySelector('#input-confirm-reset');
      if (inputReset) {
        inputReset.addEventListener('input', (e) => {
          this.resetModal.confirmationText = e.target.value;
          const btnConfirm = container.querySelector('#btn-confirm-factory-reset');
          if (btnConfirm) {
            btnConfirm.disabled = e.target.value.trim() !== 'RESET';
          }
        });
      }

      const btnConfirmReset = container.querySelector('#btn-confirm-factory-reset');
      if (btnConfirmReset) {
        btnConfirmReset.addEventListener('click', () => {
          if (this.resetModal.confirmationText.trim() === 'RESET') {
            this.performFactoryReset();
          }
        });
      }
    }
  }
}

