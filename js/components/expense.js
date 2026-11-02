/**
 * PocketLedger - Expense & Transaction Component
 * Menangani card ringkasan, quick add bottom sheet modal, dan riwayat transaksi harian
 */

import { WalletService, TransactionService } from '../db.js';
import {
  formatRupiah,
  parseNumberInput,
  formatInputDigits,
  formatRelativeDate,
  getDateGroupKey,
  formatTimeIndo
} from '../utils/formatters.js';

// Kategori & Pengaturan Warna
export const CATEGORY_DEFINITIONS = {
  expense: [
    { name: 'Makanan & Minuman', icon: 'utensils', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    { name: 'Transportasi', icon: 'car', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    { name: 'Belanja', icon: 'shopping-bag', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    { name: 'Tagihan & Utilitas', icon: 'zap', bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    { name: 'Hiburan', icon: 'film', bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
    { name: 'Kesehatan', icon: 'heart-pulse', bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    { name: 'Pendidikan', icon: 'graduation-cap', bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    { name: 'Lainnya', icon: 'package', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' }
  ],
  income: [
    { name: 'Gaji', icon: 'banknote', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    { name: 'Bisnis / Freelance', icon: 'briefcase', bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    { name: 'Bonus & THR', icon: 'gift', bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/30' },
    { name: 'Investasi', icon: 'trending-up', bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    { name: 'Hadiah / Masuk', icon: 'heart', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    { name: 'Lainnya', icon: 'sparkles', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' }
  ]
};

export function getCategoryMeta(categoryName, type = 'expense') {
  const list = CATEGORY_DEFINITIONS[type] || CATEGORY_DEFINITIONS.expense;
  const match = list.find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase());
  if (match) return match;

  // Search across both types
  const alt = [...CATEGORY_DEFINITIONS.expense, ...CATEGORY_DEFINITIONS.income].find(
    c => c.name.toLowerCase() === (categoryName || '').toLowerCase()
  );
  if (alt) return alt;

  return {
    name: categoryName || 'Umum',
    icon: type === 'income' ? 'arrow-down-left' : 'arrow-up-right',
    bg: type === 'income' ? 'bg-emerald-500/15' : 'bg-rose-500/15',
    text: type === 'income' ? 'text-emerald-400' : 'text-rose-400',
    border: 'border-slate-700'
  };
}

export class ExpenseComponent {
  constructor({ onDataChanged }) {
    this.onDataChanged = onDataChanged || (() => {});
    this.wallets = [];
    this.transactions = [];
    this.modalState = {
      isOpen: false,
      type: 'expense', // 'expense' | 'income'
      amount: '',
      walletId: null,
      category: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    };
    this.deleteConfirmId = null;
  }

  setData(wallets, transactions) {
    this.wallets = wallets || [];
    this.transactions = transactions || [];
  }

  /**
   * Hitung Ringkasan Saldo dan Aliran Kas Bulan Ini
   */
  getSummary() {
    const totalBalance = this.wallets.reduce((acc, w) => acc + (w.balance || 0), 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthIncome = 0;
    let monthExpense = 0;

    this.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.type === 'income') {
          monthIncome += (tx.amount || 0);
        } else if (tx.type === 'expense') {
          monthExpense += (tx.amount || 0);
        }
      }
    });

    return { totalBalance, monthIncome, monthExpense };
  }

  /**
   * Kelompokkan riwayat transaksi berdasarkan tanggal
   */
  getGroupedTransactions() {
    const groups = {};

    this.transactions.forEach(tx => {
      const key = getDateGroupKey(tx.date);
      if (!groups[key]) {
        groups[key] = {
          dateKey: key,
          rawDate: tx.date,
          dayTotal: 0,
          items: []
        };
      }
      groups[key].items.push(tx);
      const delta = tx.type === 'income' ? tx.amount : -tx.amount;
      groups[key].dayTotal += delta;
    });

    // Urutkan key dari yang terbaru ke terlama
    return Object.values(groups).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
  }

  /**
   * Render HTML Lengkap Komponen Transaksi
   */
  render() {
    const { totalBalance, monthIncome, monthExpense } = this.getSummary();
    const groupedList = this.getGroupedTransactions();

    return `
      <div class="space-y-4 animate-fade-in pb-16">
        
        <!-- CARD RINGKASAN UTAMA -->
        <div class="bg-gradient-to-br from-slate-800 via-slate-800/90 to-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-xl relative overflow-hidden">
          <div class="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -left-8 -bottom-8 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div class="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span class="font-medium tracking-wide">Total Saldo Terkumpul</span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Offline DB
            </span>
          </div>

          <div class="text-3xl font-extrabold text-white tracking-tight mt-1 mb-4 font-mono">
            ${formatRupiah(totalBalance)}
          </div>

          <!-- Pemasukan & Pengeluaran Bulan Ini -->
          <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/60">
            <div class="bg-slate-900/60 rounded-2xl p-2.5 border border-slate-800">
              <div class="flex items-center gap-1.5 text-[11px] text-emerald-400 mb-1 font-medium">
                <i data-lucide="arrow-down-left" class="w-3.5 h-3.5"></i>
                <span>Pemasukan Bulan Ini</span>
              </div>
              <div class="text-sm font-bold text-slate-100 font-mono truncate">
                ${formatRupiah(monthIncome)}
              </div>
            </div>

            <div class="bg-slate-900/60 rounded-2xl p-2.5 border border-slate-800">
              <div class="flex items-center gap-1.5 text-[11px] text-rose-400 mb-1 font-medium">
                <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                <span>Pengeluaran Bulan Ini</span>
              </div>
              <div class="text-sm font-bold text-slate-100 font-mono truncate">
                ${formatRupiah(monthExpense)}
              </div>
            </div>
          </div>

          <!-- Dompet Horizontal Pills -->
          <div class="mt-4 pt-3 border-t border-slate-700/50">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Saldo per Dompet</div>
            <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              ${this.wallets.map(w => `
                <div class="flex-shrink-0 bg-slate-950/70 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full ${w.type === 'bank' ? 'bg-blue-400' : w.type === 'ewallet' ? 'bg-cyan-400' : 'bg-emerald-400'}"></div>
                  <span class="text-xs font-medium text-slate-300">${w.name}</span>
                  <span class="text-xs font-mono font-semibold text-slate-100">${formatRupiah(w.balance || 0)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- TOMBOL CATAT TRANSAKSI CEPAT -->
        <div class="grid grid-cols-2 gap-3">
          <button id="btn-open-income" type="button" class="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white py-3 px-4 rounded-2xl text-xs font-bold shadow-lg shadow-emerald-950/40 transition-all">
            <i data-lucide="plus-circle" class="w-4 h-4"></i>
            + Pemasukan
          </button>
          <button id="btn-open-expense" type="button" class="flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.98] text-white py-3 px-4 rounded-2xl text-xs font-bold shadow-lg shadow-rose-950/40 transition-all">
            <i data-lucide="minus-circle" class="w-4 h-4"></i>
            - Pengeluaran
          </button>
        </div>

        <!-- RIWAYAT TRANSAKSI HARIAN -->
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h2 class="text-xs font-bold uppercase tracking-wider text-slate-400">Riwayat Transaksi</h2>
            <span class="text-xs text-slate-500">${this.transactions.length} Total</span>
          </div>

          ${groupedList.length === 0 ? `
            <div class="bg-slate-800/40 border border-dashed border-slate-700/80 rounded-3xl p-8 text-center">
              <div class="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <i data-lucide="receipt-text" class="w-7 h-7 text-slate-400"></i>
              </div>
              <p class="text-sm font-bold text-slate-200">Belum Ada Transaksi</p>
              <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Klik tombol Pemasukan atau Pengeluaran di atas untuk mencatat transaksi pertama Anda secara offline.</p>
            </div>
          ` : `
            <div class="space-y-4">
              ${groupedList.map(group => `
                <div class="space-y-2">
                  <!-- Header Grup Tanggal -->
                  <div class="flex items-center justify-between px-1 text-xs">
                    <span class="font-bold text-slate-300 flex items-center gap-1.5">
                      <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-400"></i>
                      ${formatRelativeDate(group.rawDate)}
                    </span>
                    <span class="font-mono text-[11px] font-semibold ${group.dayTotal >= 0 ? 'text-emerald-400' : 'text-slate-400'}">
                      ${group.dayTotal >= 0 ? '+' : ''}${formatRupiah(group.dayTotal)}
                    </span>
                  </div>

                  <!-- List Transaksi Dalam Tanggal Tersebut -->
                  <div class="space-y-2">
                    ${group.items.map(tx => {
                      const meta = getCategoryMeta(tx.category, tx.type);
                      const wallet = this.wallets.find(w => w.id === tx.walletId);
                      const walletName = wallet ? wallet.name : 'Dompet';
                      const isIncome = tx.type === 'income';

                      return `
                        <div class="bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors">
                          <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-xl ${meta.bg} ${meta.text} border ${meta.border} flex items-center justify-center flex-shrink-0">
                              <i data-lucide="${meta.icon}" class="w-5 h-5"></i>
                            </div>
                            <div class="min-w-0">
                              <div class="text-xs font-bold text-slate-100 truncate">${tx.category}</div>
                              <div class="text-[11px] text-slate-400 truncate">${tx.note || 'Tanpa catatan'}</div>
                              <div class="flex items-center gap-1.5 mt-0.5">
                                <span class="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-900 text-slate-300 border border-slate-700">
                                  ${walletName}
                                </span>
                                <span class="text-[10px] text-slate-500">
                                  ${formatTimeIndo(tx.date)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div class="text-right flex items-center gap-2 flex-shrink-0">
                            <div>
                              <div class="text-xs font-mono font-bold ${isIncome ? 'text-emerald-400' : 'text-slate-100'}">
                                ${isIncome ? '+' : '-'}${formatRupiah(tx.amount)}
                              </div>
                            </div>
                            <!-- Tombol Hapus Cepat -->
                            <button type="button" data-delete-id="${tx.id}" class="btn-delete-tx p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-colors" title="Hapus transaksi">
                              <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- RENDER BOTTOM SHEET MODAL (JIKA DIBUKA) -->
        ${this.renderBottomSheetModal()}

        <!-- RENDER DIALOG KONFIRMASI HAPUS (JIKA ADA) -->
        ${this.renderDeleteConfirmDialog()}
      </div>
    `;
  }

  /**
   * Render Bottom Sheet Form Modal
   */
  renderBottomSheetModal() {
    if (!this.modalState.isOpen) return '';

    const isIncome = this.modalState.type === 'income';
    const categories = CATEGORY_DEFINITIONS[this.modalState.type] || [];
    const activeCategory = this.modalState.category || (categories[0]?.name || '');

    return `
      <!-- Backdrop Overlay -->
      <div id="modal-backdrop" class="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex flex-col justify-end animate-fade-in">
        
        <!-- Bottom Sheet Content -->
        <div id="modal-sheet" class="bg-slate-900 border-t border-slate-700/90 rounded-t-3xl p-5 max-w-md w-full mx-auto max-h-[92vh] overflow-y-auto safe-padding-bottom shadow-2xl relative">
          
          <!-- Sheet Drag Handle -->
          <div class="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-4"></div>

          <!-- Header Modal -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${isIncome ? 'text-emerald-400' : 'text-rose-400'}"></i>
              Catat ${isIncome ? 'Pemasukan' : 'Pengeluaran'}
            </h3>
            <button id="btn-close-modal" type="button" class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <form id="form-quick-transaction" class="space-y-4">
            
            <!-- Type Switch Tabs -->
            <div class="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button type="button" id="tab-type-expense" class="py-2 rounded-xl text-xs font-bold transition-all ${!isIncome ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}">
                Pengeluaran
              </button>
              <button type="button" id="tab-type-income" class="py-2 rounded-xl text-xs font-bold transition-all ${isIncome ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}">
                Pemasukan
              </button>
            </div>

            <!-- Input Nominal (Mobile Number Pad Optimized) -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Nominal Transaksi</label>
              <div class="relative flex items-center">
                <span class="absolute left-4 text-base font-extrabold text-slate-400">Rp</span>
                <input
                  type="text"
                  id="input-tx-amount"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  value="${this.modalState.amount}"
                  placeholder="0"
                  class="w-full bg-slate-800/90 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-2xl py-3 pl-12 pr-4 text-2xl font-bold font-mono text-white placeholder-slate-600 outline-none transition-all"
                  autocomplete="off"
                  required
                />
              </div>

              <!-- Shortcut Chips Nominal Cepat -->
              <div class="flex gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
                ${[10000, 20000, 50000, 100000, 250000].map(val => `
                  <button type="button" data-chip-val="${val}" class="btn-amount-chip flex-shrink-0 text-[11px] font-mono font-medium px-2.5 py-1 bg-slate-800 border border-slate-700 hover:bg-slate-700/80 rounded-lg text-slate-300">
                    +${formatRupiah(val)}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Pilih Dompet -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Sumber / Dompet</label>
              <div class="grid grid-cols-3 gap-2">
                ${this.wallets.map(w => {
                  const isSelected = this.modalState.walletId === w.id;
                  return `
                    <button type="button" data-wallet-id="${w.id}" class="btn-select-wallet py-2 px-2.5 rounded-xl border text-left transition-all ${isSelected ? 'bg-slate-800 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-950/60 border-slate-800 text-slate-400'}">
                      <div class="text-xs font-bold text-slate-200 truncate">${w.name}</div>
                      <div class="text-[10px] font-mono text-slate-400 mt-0.5 truncate">${formatRupiah(w.balance || 0)}</div>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Pilih Kategori (Ikon Berwarna) -->
            <div>
              <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Pilih Kategori</label>
              <div class="grid grid-cols-4 gap-2">
                ${categories.map(cat => {
                  const isSelected = activeCategory.toLowerCase() === cat.name.toLowerCase();
                  return `
                    <button type="button" data-cat-name="${cat.name}" class="btn-select-category flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${isSelected ? 'bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/50' : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/40'}">
                      <div class="w-8 h-8 rounded-lg ${cat.bg} ${cat.text} flex items-center justify-center mb-1">
                        <i data-lucide="${cat.icon}" class="w-4 h-4"></i>
                      </div>
                      <span class="text-[10px] font-semibold text-slate-300 text-center leading-tight truncate w-full">${cat.name}</span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Tanggal & Catatan -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  id="input-tx-date"
                  value="${this.modalState.date}"
                  class="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-400 mb-1.5">Catatan (Opsional)</label>
                <input
                  type="text"
                  id="input-tx-note"
                  value="${this.modalState.note}"
                  placeholder="Misal: Kopi, bensin..."
                  class="w-full bg-slate-800/90 border border-slate-700/80 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <!-- Tombol Simpan -->
            <div class="pt-2">
              <button
                type="submit"
                id="btn-submit-tx"
                class="w-full py-3.5 px-4 rounded-2xl text-xs font-bold text-white shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${isIncome ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/40'}"
              >
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                Simpan Transaksi
              </button>
            </div>

          </form>

        </div>
      </div>
    `;
  }

  /**
   * Render Dialog Konfirmasi Hapus Transaksi
   */
  renderDeleteConfirmDialog() {
    if (!this.deleteConfirmId) return '';

    return `
      <div id="delete-backdrop" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>

          <div class="text-center">
            <h4 class="text-sm font-bold text-white">Hapus Transaksi?</h4>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Transaksi ini akan dihapus dari IndexedDB dan saldo dompet terkait akan disesuaikan kembali secara otomatis.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2">
            <button id="btn-cancel-delete" type="button" class="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
              Batal
            </button>
            <button id="btn-confirm-delete" type="button" class="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40 transition-colors">
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Buka Bottom Sheet Modal Transaksi
   */
  openModal(type = 'expense') {
    const categories = CATEGORY_DEFINITIONS[type] || [];
    const defaultWalletId = this.wallets.length > 0 ? this.wallets[0].id : null;

    this.modalState = {
      isOpen: true,
      type: type,
      amount: '',
      walletId: defaultWalletId,
      category: categories[0]?.name || 'Umum',
      date: new Date().toISOString().split('T')[0],
      note: ''
    };

    this.onDataChanged();
  }

  /**
   * Tutup Modal Transaksi
   */
  closeModal() {
    this.modalState.isOpen = false;
    this.onDataChanged();
  }

  /**
   * Hubungkan Event Listeners Komponen
   */
  bindEvents(container) {
    if (!container) return;

    // 1. Tombol buka modal dari halaman utama
    const btnIncome = container.querySelector('#btn-open-income');
    if (btnIncome) {
      btnIncome.addEventListener('click', () => this.openModal('income'));
    }

    const btnExpense = container.querySelector('#btn-open-expense');
    if (btnExpense) {
      btnExpense.addEventListener('click', () => this.openModal('expense'));
    }

    // 2. Tombol hapus pada tiap baris transaksi
    const deleteButtons = container.querySelectorAll('.btn-delete-tx');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(btn.getAttribute('data-delete-id'));
        if (id) {
          this.deleteConfirmId = id;
          this.onDataChanged();
        }
      });
    });

    // 3. Tombol konfirmasi hapus modal dialog
    const btnCancelDelete = container.querySelector('#btn-cancel-delete');
    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', () => {
        this.deleteConfirmId = null;
        this.onDataChanged();
      });
    }

    const btnConfirmDelete = container.querySelector('#btn-confirm-delete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', async () => {
        if (this.deleteConfirmId) {
          await TransactionService.delete(this.deleteConfirmId);
          this.deleteConfirmId = null;
          this.onDataChanged(true); // reload from DB and re-render
        }
      });
    }

    // 4. Modal Bottom Sheet Handlers (jika modal terbuka)
    if (this.modalState.isOpen) {
      const btnCloseModal = container.querySelector('#btn-close-modal');
      if (btnCloseModal) {
        btnCloseModal.addEventListener('click', () => this.closeModal());
      }

      // Klik backdrop untuk menutup modal
      const backdrop = container.querySelector('#modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) {
            this.closeModal();
          }
        });
      }

      // Tab switch jenis transaksi (Pengeluaran vs Pemasukan)
      const tabExpense = container.querySelector('#tab-type-expense');
      const tabIncome = container.querySelector('#tab-type-income');

      if (tabExpense) {
        tabExpense.addEventListener('click', () => {
          this.modalState.type = 'expense';
          const cats = CATEGORY_DEFINITIONS.expense;
          this.modalState.category = cats[0]?.name || 'Umum';
          this.onDataChanged();
        });
      }

      if (tabIncome) {
        tabIncome.addEventListener('click', () => {
          this.modalState.type = 'income';
          const cats = CATEGORY_DEFINITIONS.income;
          this.modalState.category = cats[0]?.name || 'Umum';
          this.onDataChanged();
        });
      }

      // Live formatting input nominal angka keypad HP
      const inputAmount = container.querySelector('#input-tx-amount');
      if (inputAmount) {
        // Fokuskan input saat modal baru terbuka
        setTimeout(() => inputAmount.focus(), 80);

        inputAmount.addEventListener('input', (e) => {
          const raw = e.target.value;
          const formatted = formatInputDigits(raw);
          this.modalState.amount = formatted;
          e.target.value = formatted;
        });
      }

      // Shortcut chip nominal (+10rb, +20rb, dll)
      const amountChips = container.querySelectorAll('.btn-amount-chip');
      amountChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const addVal = Number(chip.getAttribute('data-chip-val')) || 0;
          const currentVal = parseNumberInput(this.modalState.amount);
          const newVal = currentVal + addVal;
          this.modalState.amount = formatInputDigits(newVal);
          if (inputAmount) inputAmount.value = this.modalState.amount;
        });
      });

      // Pilih Dompet
      const walletBtns = container.querySelectorAll('.btn-select-wallet');
      walletBtns.forEach(wBtn => {
        wBtn.addEventListener('click', () => {
          this.modalState.walletId = Number(wBtn.getAttribute('data-wallet-id'));
          this.onDataChanged();
        });
      });

      // Pilih Kategori
      const catBtns = container.querySelectorAll('.btn-select-category');
      catBtns.forEach(cBtn => {
        cBtn.addEventListener('click', () => {
          this.modalState.category = cBtn.getAttribute('data-cat-name');
          this.onDataChanged();
        });
      });

      // Submit Form Tambah Transaksi
      const form = container.querySelector('#form-quick-transaction');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          const numericAmount = parseNumberInput(this.modalState.amount);
          if (!numericAmount || numericAmount <= 0) {
            alert('Silakan masukkan nominal transaksi yang valid.');
            return;
          }

          if (!this.modalState.walletId) {
            alert('Silakan pilih dompet sumber transaksi.');
            return;
          }

          const dateVal = container.querySelector('#input-tx-date')?.value || new Date().toISOString();
          const noteVal = container.querySelector('#input-tx-note')?.value || '';

          // Waktu transaksi lengkap (sertakan jam menit sekarang jika tanggal adalah hari ini)
          const now = new Date();
          let fullDateStr = dateVal;
          if (dateVal === now.toISOString().split('T')[0]) {
            fullDateStr = now.toISOString();
          } else {
            fullDateStr = new Date(`${dateVal}T12:00:00`).toISOString();
          }

          const newTransaction = {
            type: this.modalState.type,
            amount: numericAmount,
            category: this.modalState.category || 'Umum',
            walletId: this.modalState.walletId,
            date: fullDateStr,
            note: noteVal
          };

          // Simpan ke Dexie (otomatis memperbarui saldo dompet terkait)
          await TransactionService.add(newTransaction);

          // Reset modal dan update UI secara reaktif tanpa reload
          this.modalState.isOpen = false;
          this.onDataChanged(true); // reload from DB and re-render
        });
      }
    }
  }
}

