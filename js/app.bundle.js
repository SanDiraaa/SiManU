/**
 * PocketLedger Universal Bundle
 * Berisi seluruh logika aplikasi, komponen UI, dan database Dexie IndexedDB
 * Dibuat otomatis untuk kompatibilitas penuh (file:///, http://, Android WebView)
 */
(function() {
  'use strict';

/* --- Start: js/utils/formatters.js --- */
/**
 * PocketLedger - Utilities & Formatters
 * Formatter mata uang Rupiah, tanggal Indonesia, dan parser input angka mobile
 */

/**
 * Format angka ke mata uang Rupiah (contoh: "Rp 150.000")
 * @param {number|string} amount
 * @param {object} options { withSign: boolean, type: 'income'|'expense' }
 * @returns {string}
 */
function formatRupiah(amount, options = {}) {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absNum);

  if (options.withSign) {
    if (options.type === 'income' || num > 0) {
      return `+${formatted}`;
    }
    if (options.type === 'expense' || isNegative) {
      return `-${formatted}`;
    }
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parse string nominal input dari form menjadi integer murni
 * Contoh: "150.000" -> 150000, "Rp 1.250.500" -> 1250500
 * @param {string|number} rawValue
 * @returns {number}
 */
function parseNumberInput(rawValue) {
  if (typeof rawValue === 'number') return Math.max(0, rawValue);
  if (!rawValue) return 0;

  // Hilangkan karakter non-digit
  const cleanDigits = String(rawValue).replace(/\D/g, '');
  const parsed = parseInt(cleanDigits, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format string digit menjadi format pemisah ribuan titik (contoh: 150000 -> "150.000")
 * Berguna untuk live formatting saat user mengetik di keypad HP
 * @param {string|number} value
 * @returns {string}
 */
function formatInputDigits(value) {
  const num = parseNumberInput(value);
  if (num === 0) return '';
  return new Intl.NumberFormat('id-ID').format(num);
}

/**
 * Konversi ISO date string ke tanggal Indonesia
 * Contoh: "2026-11-02" -> "2 November 2026"
 * @param {string|Date} dateStr
 * @param {object} options
 * @returns {string}
 */
function formatDateIndo(dateStr, options = { withDay: true, shortMonth: false }) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('id-ID', {
    weekday: options.withDay ? 'long' : undefined,
    day: 'numeric',
    month: options.shortMonth ? 'short' : 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Format tanggal ramah untuk pengelompokan riwayat transaksi
 * Contoh: "Hari ini", "Kemarin", atau "Senin, 2 Nov 2026"
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffTime = today.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Hari ini';
  } else if (diffDays === 1) {
    return 'Kemarin';
  } else if (diffDays === -1) {
    return 'Besok';
  }

  // Jika tahun sama, tampilkan nama hari, tanggal bulan
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(date);
}

/**
 * Ambil key tanggal YYYY-MM-DD untuk grouping transaksi
 * @param {string|Date} dateStr
 * @returns {string}
 */
function getDateGroupKey(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format jam menit (contoh: "14:30")
 * @param {string|Date} dateStr
 * @returns {string}
 */
function formatTimeIndo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}


/* --- End: js/utils/formatters.js --- */

/* --- Start: js/utils/share.js --- */
/**
 * PocketLedger - WhatsApp Share & Clipboard Utility
 * Menghasilkan teks terstruktur untuk dibagikan ke grup WhatsApp
 */



/**
 * Buat format teks rapi untuk dibagikan via WhatsApp
 * @param {object} session
 * @param {object} calcResult
 * @returns {string}
 */
function generateWhatsAppSplitBillText(session, calcResult) {
  const { title, date, taxPercent, servicePercent, flatFee, paymentInfo } = session;
  const { participants, grandTotal, totalSubtotal } = calcResult;

  const dateFormatted = formatDateIndo(date || new Date().toISOString(), { withDay: true });

  let text = `🧾 *TAGIHAN SPLIT BILL: ${title || 'Makan Bersama'}*\n`;
  text += `📅 Tanggal: ${dateFormatted}\n`;
  text += `👥 Jumlah Peserta: ${participants.length} orang\n`;
  text += `─────────────────────────\n\n`;

  participants.forEach((p, idx) => {
    text += `👤 *${p.name.toUpperCase()}*\n`;

    if (p.items && p.items.length > 0) {
      p.items.forEach(item => {
        const sharedNote = item.sharedCount > 1 ? ` _(patungan ${item.sharedCount} org)_` : '';
        text += `  • ${item.name}: ${formatRupiah(item.portionPrice)}${sharedNote}\n`;
      });
      text += `  Subtotal: ${formatRupiah(p.subtotal)}\n`;
    } else {
      text += `  Subtotal: Rp 0\n`;
    }

    // Rincian Pajak & Service jika ada
    const extraCharges = (p.tax || 0) + (p.service || 0);
    if (extraCharges > 0) {
      const parts = [];
      if (taxPercent > 0) parts.push(`Pajak ${taxPercent}%`);
      if (servicePercent > 0) parts.push(`Servis ${servicePercent}%`);
      text += `  + ${parts.join(' & ')}: ${formatRupiah(extraCharges)}\n`;
    }

    // Biaya Flat (Parkir/Ongkir) jika ada
    if (p.flatFee && p.flatFee > 0) {
      text += `  + Biaya Flat (Parkir/Ongkir): ${formatRupiah(p.flatFee)}\n`;
    }

    text += `  👉 *TOTAL BAYAR: ${formatRupiah(p.total)}*\n\n`;
  });

  text += `─────────────────────────\n`;
  text += `📊 *RINGKASAN TOTAL TAGIHAN:*\n`;
  text += `• Total Makanan/Item: ${formatRupiah(totalSubtotal)}\n`;
  if (taxPercent > 0) text += `• Total Pajak (${taxPercent}%): ${formatRupiah(calcResult.totalTax)}\n`;
  if (servicePercent > 0) text += `• Total Servis (${servicePercent}%): ${formatRupiah(calcResult.totalService)}\n`;
  if (flatFee > 0) text += `• Total Biaya Lain: ${formatRupiah(flatFee)}\n`;
  text += `💰 *GRAND TOTAL: ${formatRupiah(grandTotal)}*\n\n`;

  if (paymentInfo && paymentInfo.trim()) {
    text += `💳 *INFORMASI PEMBAYARAN / REKENING:*\n`;
    text += `${paymentInfo.trim()}\n\n`;
  }

  text += `_Dihitung otomatis via PocketLedger Offline PWA_ 📱`;

  return text;
}

/**
 * Salin teks ke Clipboard dengan fallback aman
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API gagal, mencoba fallback execCommand:', err);
    }
  }

  // Fallback untuk browser/lingkungan tanpa clipboard API modern
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  } catch (err) {
    console.error('Semua metode clipboard gagal:', err);
    return false;
  }
}

/**
 * Buka langsung ke WhatsApp dengan teks terformat
 * @param {string} text
 */
function openWhatsAppWithText(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}


/* --- End: js/utils/share.js --- */

/* --- Start: js/db.js --- */
/**
 * PocketLedger Database Module
 * IndexedDB wrapper powered by Dexie.js
 */

// Ensure Dexie is available
const Dexie = (typeof window !== 'undefined' && window.Dexie) || globalThis.Dexie;

if (!Dexie) {
  throw new Error('Dexie.js is not loaded. Please ensure Dexie CDN is included before db.js.');
}

// 1. Initialize Dexie Instance
const db = new Dexie('PocketLedgerDB');

// 2. Define Database Schema
db.version(1).stores({
  wallets: '++id, name, type, balance',
  transactions: '++id, type, amount, category, walletId, date, note',
  splitBills: '++id, title, date, totalAmount, status'
});

// 3. Seed Default Data
const DEFAULT_WALLETS = [
  { name: 'Tunai', type: 'cash', balance: 0 },
  { name: 'BCA', type: 'bank', balance: 0 },
  { name: 'GoPay', type: 'ewallet', balance: 0 }
];

async function seedInitialData() {
  const count = await db.wallets.count();
  if (count === 0) {
    console.log('[DB] Seeding default wallets:', DEFAULT_WALLETS.map(w => w.name).join(', '));
    await db.wallets.bulkAdd(DEFAULT_WALLETS);
    return true;
  }
  return false;
}

// Automatically seed on database first creation
db.on('populate', () => {
  db.wallets.bulkAdd(DEFAULT_WALLETS);
});

// 4. CRUD Helper Services

/**
 * Wallets Repository & Helper
 */
const WalletService = {
  async getAll() {
    return await db.wallets.toArray();
  },

  async getById(id) {
    return await db.wallets.get(Number(id));
  },

  async add(wallet) {
    const newWallet = {
      name: wallet.name.trim(),
      type: wallet.type || 'cash',
      balance: Number(wallet.balance) || 0
    };
    return await db.wallets.add(newWallet);
  },

  async update(id, changes) {
    if (changes.balance !== undefined) {
      changes.balance = Number(changes.balance);
    }
    return await db.wallets.update(Number(id), changes);
  },

  async delete(id) {
    return await db.wallets.delete(Number(id));
  },

  async adjustBalance(walletId, delta) {
    return await db.transaction('rw', db.wallets, async () => {
      const wallet = await db.wallets.get(Number(walletId));
      if (!wallet) throw new Error(`Wallet with ID ${walletId} not found`);
      const newBalance = (wallet.balance || 0) + Number(delta);
      await db.wallets.update(wallet.id, { balance: newBalance });
      return newBalance;
    });
  }
};

/**
 * Transactions Repository & Helper
 */
const TransactionService = {
  async getAll({ limit = 50, offset = 0 } = {}) {
    return await db.transactions
      .orderBy('date')
      .reverse()
      .offset(offset)
      .limit(limit)
      .toArray();
  },

  async getById(id) {
    return await db.transactions.get(Number(id));
  },

  async add(transaction) {
    return await db.transaction('rw', db.wallets, db.transactions, async () => {
      const tx = {
        type: transaction.type, // 'income' | 'expense' | 'transfer'
        amount: Number(transaction.amount) || 0,
        category: transaction.category || 'Umum',
        walletId: Number(transaction.walletId),
        date: transaction.date || new Date().toISOString(),
        note: transaction.note ? transaction.note.trim() : ''
      };

      const txId = await db.transactions.add(tx);

      // Auto-update wallet balance
      if (tx.walletId) {
        const delta = tx.type === 'income' ? tx.amount : -tx.amount;
        const wallet = await db.wallets.get(tx.walletId);
        if (wallet) {
          await db.wallets.update(tx.walletId, {
            balance: (wallet.balance || 0) + delta
          });
        }
      }

      return txId;
    });
  },

  async update(id, changes) {
    return await db.transactions.update(Number(id), changes);
  },

  async delete(id, revertWalletBalance = true) {
    return await db.transaction('rw', db.wallets, db.transactions, async () => {
      const tx = await db.transactions.get(Number(id));
      if (!tx) return false;

      if (revertWalletBalance && tx.walletId) {
        const delta = tx.type === 'income' ? -tx.amount : tx.amount;
        const wallet = await db.wallets.get(tx.walletId);
        if (wallet) {
          await db.wallets.update(tx.walletId, {
            balance: (wallet.balance || 0) + delta
          });
        }
      }

      await db.transactions.delete(Number(id));
      return true;
    });
  },

  async getByWallet(walletId) {
    return await db.transactions
      .where('walletId')
      .equals(Number(walletId))
      .reverse()
      .sortBy('date');
  }
};

/**
 * Split Bills Repository & Helper
 */
const SplitBillService = {
  async getAll() {
    return await db.splitBills.orderBy('date').reverse().toArray();
  },

  async getById(id) {
    return await db.splitBills.get(Number(id));
  },

  async add(splitBill) {
    const bill = {
      ...splitBill,
      title: (splitBill.title || 'Split Bill').trim(),
      date: splitBill.date || new Date().toISOString(),
      totalAmount: Number(splitBill.totalAmount) || 0,
      status: splitBill.status || 'open',
      participants: splitBill.participants || [],
      items: splitBill.items || [],
      taxPercent: Number(splitBill.taxPercent) || 0,
      servicePercent: Number(splitBill.servicePercent) || 0,
      flatFee: Number(splitBill.flatFee) || 0,
      paymentInfo: splitBill.paymentInfo || ''
    };
    return await db.splitBills.add(bill);
  },

  async update(id, changes) {
    const cleanChanges = { ...changes };
    if (cleanChanges.totalAmount !== undefined) {
      cleanChanges.totalAmount = Number(cleanChanges.totalAmount);
    }
    return await db.splitBills.update(Number(id), cleanChanges);
  },

  async delete(id) {
    return await db.splitBills.delete(Number(id));
  }
};

/**
 * Initialize DB and verify seed
 */
async function initDB() {
  await db.open();
  await seedInitialData();
  console.log('[PocketLedgerDB] Ready. Tables initialized.');
  return db;
}

// Global attachment for convenience in non-module or debugging environments
if (typeof window !== 'undefined') {
  window.PocketLedgerDB = {
    db,
    WalletService,
    TransactionService,
    SplitBillService,
    initDB,
    seedInitialData
  };
}


/* --- End: js/db.js --- */

/* --- Start: js/components/expense.js --- */
/**
 * PocketLedger - Expense & Transaction Component
 * Menangani card ringkasan, quick add bottom sheet modal, dan riwayat transaksi harian
 */




// Kategori & Pengaturan Warna
const CATEGORY_DEFINITIONS = {
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

function getCategoryMeta(categoryName, type = 'expense') {
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

class ExpenseComponent {
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


/* --- End: js/components/expense.js --- */

/* --- Start: js/components/splitbill.js --- */
/**
 * PocketLedger - Split Bill Component
 * Menangani pembuatan sesi split bill itemized, kalkulasi proporsional,
 * penyimpanan ke IndexedDB, dan pembagian ke WhatsApp.
 */





/**
 * Logika Perhitungan Proporsional Split Bill
 * @param {object} session
 * @returns {object}
 */
function calculateSplitBill(session) {
  const participants = session.participants || [];
  const items = session.items || [];
  const taxPercent = Number(session.taxPercent) || 0;
  const servicePercent = Number(session.servicePercent) || 0;
  const flatFee = Number(session.flatFee) || 0;
  const numParticipants = participants.length;

  // Inisialisasi map hasil per peserta
  const participantMap = {};
  participants.forEach(pName => {
    participantMap[pName] = {
      name: pName,
      items: [],
      subtotal: 0,
      tax: 0,
      service: 0,
      flatFee: 0,
      total: 0
    };
  });

  let totalSubtotal = 0;

  // 1. Hitung porsi makanan per item
  items.forEach(item => {
    const itemPrice = Number(item.price) || 0;
    const consumerNames = (item.participants || []).filter(name => participantMap[name]);
    const consumerCount = consumerNames.length;

    if (consumerCount > 0 && itemPrice > 0) {
      const portionPrice = itemPrice / consumerCount;
      totalSubtotal += itemPrice;

      consumerNames.forEach(name => {
        participantMap[name].items.push({
          name: item.name || 'Menu',
          price: itemPrice,
          portionPrice: portionPrice,
          sharedCount: consumerCount
        });
        participantMap[name].subtotal += portionPrice;
      });
    }
  });

  // 2. Hitung Pajak dan Service secara Proporsional terhadap subtotal individu
  const taxRate = taxPercent / 100;
  const serviceRate = servicePercent / 100;
  const flatPerPerson = numParticipants > 0 ? flatFee / numParticipants : 0;

  let grandTotal = 0;
  let totalTax = 0;
  let totalService = 0;

  const resultParticipants = participants.map(name => {
    const p = participantMap[name];
    const pSubtotal = p.subtotal;
    const pTax = Math.round(pSubtotal * taxRate);
    const pService = Math.round(pSubtotal * serviceRate);
    const pFlat = Math.round(flatPerPerson);
    const pTotal = Math.round(pSubtotal + pTax + pService + pFlat);

    p.tax = pTax;
    p.service = pService;
    p.flatFee = pFlat;
    p.total = pTotal;

    totalTax += pTax;
    totalService += pService;
    grandTotal += pTotal;

    return p;
  });

  return {
    participants: resultParticipants,
    totalSubtotal,
    totalTax,
    totalService,
    totalFlatFee: flatFee,
    grandTotal
  };
}

class SplitBillComponent {
  constructor({ onDataChanged }) {
    this.onDataChanged = onDataChanged || (() => {});
    this.savedSessions = [];
    this.activeView = 'editor'; // 'editor' | 'history'
    this.toastMessage = null;
    this.deleteConfirmSessionId = null;

    // State Sesi Aktif
    this.session = this.createNewSessionState();
  }

  createNewSessionState() {
    return {
      id: null,
      title: 'Makan Bersama',
      date: new Date().toISOString().split('T')[0],
      taxPercent: 10,
      servicePercent: 0,
      flatFee: 0,
      paymentInfo: '',
      participants: ['Ahmad', 'Budi'],
      items: [
        { id: 1, name: 'Makanan / Paket 1', price: 45000, participants: ['Ahmad'] },
        { id: 2, name: 'Makanan / Paket 2', price: 50000, participants: ['Budi'] },
        { id: 3, name: 'Camilan Bareng', price: 30000, participants: ['Ahmad', 'Budi'] }
      ]
    };
  }

  setSavedSessions(sessions) {
    this.savedSessions = sessions || [];
  }

  showToast(message) {
    this.toastMessage = message;
    this.onDataChanged();
    setTimeout(() => {
      this.toastMessage = null;
      this.onDataChanged();
    }, 2800);
  }

  /**
   * Render Komponen Utama Tab Split Bill
   */
  render() {
    const calcResult = calculateSplitBill(this.session);

    return `
      <div class="space-y-4 animate-fade-in pb-20">
        
        <!-- TOP VIEW SELECTOR TABS -->
        <div class="flex items-center justify-between bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
          <button id="btn-view-editor" type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all ${this.activeView === 'editor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}">
            <span class="flex items-center justify-center gap-1.5">
              <i data-lucide="calculator" class="w-3.5 h-3.5"></i>
              Kalkulator Sesi
            </span>
          </button>
          <button id="btn-view-history" type="button" class="flex-1 py-2 rounded-xl text-xs font-bold transition-all ${this.activeView === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}">
            <span class="flex items-center justify-center gap-1.5">
              <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
              Riwayat Tersimpan (${this.savedSessions.length})
            </span>
          </button>
        </div>

        ${this.activeView === 'editor' ? this.renderEditorView(calcResult) : this.renderHistoryView()}

        <!-- TOAST NOTIFICATION -->
        ${this.toastMessage ? `
          <div class="fixed top-16 inset-x-4 max-w-sm mx-auto bg-emerald-600 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 z-50 animate-fade-in">
            <i data-lucide="check-circle-2" class="w-4 h-4 flex-shrink-0"></i>
            <span>${this.toastMessage}</span>
          </div>
        ` : ''}

        <!-- DIALOG KONFIRMASI HAPUS SESI -->
        ${this.deleteConfirmSessionId ? this.renderDeleteConfirmDialog() : ''}

      </div>
    `;
  }

  /**
   * Render Tampilan Editor & Kalkulator
   */
  renderEditorView(calcResult) {
    const isNew = !this.session.id;

    return `
      <!-- 1. HEADER INFORMASI SESI -->
      <div class="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-4 shadow-xl space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <i data-lucide="receipt-cent" class="w-4 h-4"></i>
            <span>${isNew ? 'Sesi Split Bill Baru' : 'Edit Sesi Split Bill'}</span>
          </div>
          <button id="btn-new-session" type="button" class="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
            Reset Form
          </button>
        </div>

        <div class="space-y-2">
          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Nama Acara / Tempat</label>
            <input
              type="text"
              id="session-title"
              value="${this.session.title}"
              placeholder="Misal: Makan Siang Resto X"
              class="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">Pajak (%)</label>
              <input
                type="number"
                id="session-tax"
                inputmode="decimal"
                min="0"
                max="100"
                value="${this.session.taxPercent}"
                class="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-white text-center outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">Servis (%)</label>
              <input
                type="number"
                id="session-service"
                inputmode="decimal"
                min="0"
                max="100"
                value="${this.session.servicePercent}"
                class="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-white text-center outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">Biaya Flat (Rp)</label>
              <input
                type="text"
                id="session-flat-fee"
                inputmode="numeric"
                value="${formatInputDigits(this.session.flatFee)}"
                placeholder="0"
                class="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-2 text-xs text-white text-center outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-semibold text-slate-400 mb-1">Info Rekening / E-Wallet Pembayaran</label>
            <input
              type="text"
              id="session-payment-info"
              value="${this.session.paymentInfo}"
              placeholder="Contoh: BCA 123456 a.n Budi / GoPay 08123..."
              class="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <!-- 2. DAFTAR PESERTA -->
      <div class="bg-slate-800/70 border border-slate-700/80 rounded-3xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <i data-lucide="users" class="w-4 h-4 text-emerald-400"></i>
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200">Peserta (${this.session.participants.length})</h3>
          </div>
          <span class="text-[10px] text-slate-400">Minimal 2 orang</span>
        </div>

        <!-- Input Tambah Peserta -->
        <div class="flex gap-2">
          <input
            type="text"
            id="input-new-participant"
            placeholder="Tambah nama peserta..."
            class="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
          />
          <button id="btn-add-participant" type="button" class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            Tambah
          </button>
        </div>

        <!-- Chips Peserta -->
        <div class="flex flex-wrap gap-2 pt-1">
          ${this.session.participants.map(name => `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 text-slate-200">
              ${name}
              ${this.session.participants.length > 2 ? `
                <button type="button" data-remove-participant="${name}" class="text-slate-500 hover:text-rose-400 ml-0.5" title="Hapus">
                  <i data-lucide="x" class="w-3 h-3"></i>
                </button>
              ` : ''}
            </span>
          `).join('')}
        </div>
      </div>

      <!-- 3. DAFTAR PESANAN / ITEM (ITEMIZED) -->
      <div class="bg-slate-800/70 border border-slate-700/80 rounded-3xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <i data-lucide="utensils" class="w-4 h-4 text-amber-400"></i>
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-200">Pesanan / Menu Itemized</h3>
          </div>
          <button id="btn-add-item" type="button" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
            + Tambah Menu
          </button>
        </div>

        <!-- List Item -->
        <div class="space-y-3">
          ${this.session.items.map((item, idx) => `
            <div class="bg-slate-900/80 border border-slate-700/70 rounded-2xl p-3 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <input
                  type="text"
                  data-item-field="name"
                  data-item-idx="${idx}"
                  value="${item.name}"
                  placeholder="Nama menu (misal: Nasi Goreng)"
                  class="flex-1 bg-slate-800/90 border border-slate-700/70 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-medium"
                />
                <div class="relative w-32">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    data-item-field="price"
                    data-item-idx="${idx}"
                    value="${formatInputDigits(item.price)}"
                    placeholder="0"
                    class="w-full bg-slate-800/90 border border-slate-700/70 rounded-xl py-1.5 pl-8 pr-2.5 text-xs text-white font-mono font-bold outline-none focus:border-indigo-500 text-right"
                  />
                </div>
                ${this.session.items.length > 1 ? `
                  <button type="button" data-remove-item-idx="${idx}" class="p-1.5 text-slate-500 hover:text-rose-400" title="Hapus menu">
                    <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                  </button>
                ` : ''}
              </div>

              <!-- Centang Peserta Yang Menikmati Item Ini -->
              <div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Dipesan / Dimakan oleh:</span>
                  <button type="button" data-select-all-idx="${idx}" class="text-indigo-400 hover:text-indigo-300 font-semibold">
                    ${item.participants.length === this.session.participants.length ? 'Batal Semua' : 'Pilih Semua'}
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  ${this.session.participants.map(pName => {
                    const isSelected = item.participants.includes(pName);
                    return `
                      <button
                        type="button"
                        data-toggle-participant="${pName}"
                        data-toggle-item-idx="${idx}"
                        class="text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${isSelected ? 'bg-emerald-600 border-emerald-500 text-white font-bold shadow-sm' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'}"
                      >
                        ${pName}
                      </button>
                    `;
                  }).join('')}
                </div>
                ${item.participants.length === 0 ? `
                  <div class="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                    <i data-lucide="alert-circle" class="w-3 h-3"></i>
                    Pilih minimal 1 orang yang memesan menu ini.
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 4. HASIL PERHITUNGAN PROPORSIONAL (SUMMARY) -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl space-y-4">
        
        <div class="flex items-center justify-between pb-3 border-b border-slate-700/70">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Tagihan Bersama</div>
            <div class="text-2xl font-black text-white font-mono mt-0.5">
              ${formatRupiah(calcResult.grandTotal)}
            </div>
          </div>
          <div class="text-right text-[11px] text-slate-400 space-y-0.5">
            <div>Subtotal: <span class="font-mono text-slate-200">${formatRupiah(calcResult.totalSubtotal)}</span></div>
            ${calcResult.totalTax > 0 ? `<div>Pajak (${this.session.taxPercent}%): <span class="font-mono text-slate-200">${formatRupiah(calcResult.totalTax)}</span></div>` : ''}
            ${calcResult.totalService > 0 ? `<div>Servis (${this.session.servicePercent}%): <span class="font-mono text-slate-200">${formatRupiah(calcResult.totalService)}</span></div>` : ''}
            ${calcResult.totalFlatFee > 0 ? `<div>Biaya Flat: <span class="font-mono text-slate-200">${formatRupiah(calcResult.totalFlatFee)}</span></div>` : ''}
          </div>
        </div>

        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">Rincian Per Individu (Proporsional)</h4>

        <!-- Cards Rincian Per Orang -->
        <div class="space-y-3">
          ${calcResult.participants.map(p => `
            <div class="bg-slate-900/90 border border-slate-700/60 rounded-2xl p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <div class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">
                    ${p.name.charAt(0).toUpperCase()}
                  </div>
                  ${p.name}
                </span>
                <span class="text-sm font-black font-mono text-emerald-400">
                  ${formatRupiah(p.total)}
                </span>
              </div>

              <!-- List item yang dinikmati -->
              <div class="text-[11px] text-slate-400 space-y-1 pl-1 border-l-2 border-slate-700/60 ml-2">
                ${p.items.length === 0 ? `
                  <div class="italic text-slate-500">Tidak ada menu yang dicentang</div>
                ` : p.items.map(it => `
                  <div class="flex justify-between">
                    <span class="truncate pr-2">${it.name} ${it.sharedCount > 1 ? `<span class="text-[9px] text-indigo-400">(bagi ${it.sharedCount})</span>` : ''}</span>
                    <span class="font-mono text-slate-300">${formatRupiah(it.portionPrice)}</span>
                  </div>
                `).join('')}

                <div class="pt-1 mt-1 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                  <span>Subtotal Makanan</span>
                  <span class="font-mono">${formatRupiah(p.subtotal)}</span>
                </div>
                ${(p.tax + p.service) > 0 ? `
                  <div class="text-[10px] text-slate-400 flex justify-between">
                    <span>Porsi Pajak & Servis</span>
                    <span class="font-mono">+${formatRupiah(p.tax + p.service)}</span>
                  </div>
                ` : ''}
                ${p.flatFee > 0 ? `
                  <div class="text-[10px] text-slate-400 flex justify-between">
                    <span>Porsi Biaya Flat (Parkir/Ongkir)</span>
                    <span class="font-mono">+${formatRupiah(p.flatFee)}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 5. TOMBOL BAGIKAN & SIMPAN -->
        <div class="pt-2 space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              id="btn-copy-wa"
              type="button"
              class="w-full py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all"
            >
              <i data-lucide="copy" class="w-4 h-4"></i>
              Salin Format WA
            </button>
            <button
              id="btn-open-wa"
              type="button"
              class="w-full py-3 px-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all"
            >
              <i data-lucide="send" class="w-4 h-4"></i>
              Kirim via WhatsApp
            </button>
          </div>

          <button
            id="btn-save-session"
            type="button"
            class="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold shadow-lg shadow-indigo-950/40 flex items-center justify-center gap-2 transition-all"
          >
            <i data-lucide="save" class="w-4 h-4"></i>
            Simpan Sesi ke Database Offline
          </button>
        </div>

      </div>
    `;
  }

  /**
   * Render Tampilan Riwayat Sesi Tersimpan
   */
  renderHistoryView() {
    return `
      <div class="space-y-4 animate-fade-in">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">Riwayat Sesi Tersimpan</h3>
          <button id="btn-create-from-history" type="button" class="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
            Buat Sesi Baru
          </button>
        </div>

        ${this.savedSessions.length === 0 ? `
          <div class="bg-slate-800/40 border border-dashed border-slate-700/80 rounded-3xl p-8 text-center">
            <div class="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <i data-lucide="receipt" class="w-7 h-7 text-indigo-400"></i>
            </div>
            <p class="text-sm font-bold text-slate-200">Belum Ada Sesi Tersimpan</p>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Sesi yang Anda simpan di kalkulator akan muncul di sini untuk dilihat atau dibagikan kembali.</p>
          </div>
        ` : `
          <div class="space-y-3">
            ${this.savedSessions.map(session => `
              <div class="bg-slate-800/70 border border-slate-700/70 rounded-2xl p-4 space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="text-sm font-bold text-white">${session.title}</h4>
                    <p class="text-[11px] text-slate-400 mt-0.5">${formatDateIndo(session.date)}</p>
                    <div class="flex items-center gap-2 mt-1.5">
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        ${(session.participants || []).length} Peserta
                      </span>
                      <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${session.status === 'settled' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}">
                        ${session.status === 'settled' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-extrabold font-mono text-white">${formatRupiah(session.totalAmount)}</div>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/50">
                  <button type="button" data-delete-session-id="${session.id}" class="text-xs font-semibold text-rose-400 hover:text-rose-300 py-1.5 px-2.5 rounded-xl hover:bg-rose-500/10 transition-colors">
                    Hapus
                  </button>
                  <button type="button" data-load-session-id="${session.id}" class="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 py-1.5 px-3 rounded-xl shadow-sm transition-all flex items-center gap-1">
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                    Buka Sesi
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  /**
   * Render Dialog Konfirmasi Hapus Sesi
   */
  renderDeleteConfirmDialog() {
    return `
      <div id="delete-session-backdrop" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>

          <div class="text-center">
            <h4 class="text-sm font-bold text-white">Hapus Sesi Split Bill?</h4>
            <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Sesi tagihan ini akan dihapus permanen dari IndexedDB.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2">
            <button id="btn-cancel-delete-session" type="button" class="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors">
              Batal
            </button>
            <button id="btn-confirm-delete-session" type="button" class="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md transition-colors">
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind Semua Event Listener
   */
  bindEvents(container) {
    if (!container) return;

    // View Switcher Tabs
    const btnViewEditor = container.querySelector('#btn-view-editor');
    if (btnViewEditor) {
      btnViewEditor.addEventListener('click', () => {
        this.activeView = 'editor';
        this.onDataChanged();
      });
    }

    const btnViewHistory = container.querySelector('#btn-view-history');
    if (btnViewHistory) {
      btnViewHistory.addEventListener('click', () => {
        this.activeView = 'history';
        this.onDataChanged();
      });
    }

    const btnCreateFromHistory = container.querySelector('#btn-create-from-history');
    if (btnCreateFromHistory) {
      btnCreateFromHistory.addEventListener('click', () => {
        this.session = this.createNewSessionState();
        this.activeView = 'editor';
        this.onDataChanged();
      });
    }

    const btnNewSession = container.querySelector('#btn-new-session');
    if (btnNewSession) {
      btnNewSession.addEventListener('click', () => {
        if (confirm('Mulai sesi split bill baru? Perubahan belum tersimpan akan dibersihkan.')) {
          this.session = this.createNewSessionState();
          this.onDataChanged();
        }
      });
    }

    // Input Info Sesi
    const titleInput = container.querySelector('#session-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.session.title = e.target.value;
      });
    }

    const taxInput = container.querySelector('#session-tax');
    if (taxInput) {
      taxInput.addEventListener('input', (e) => {
        this.session.taxPercent = Number(e.target.value) || 0;
        this.onDataChanged();
      });
    }

    const serviceInput = container.querySelector('#session-service');
    if (serviceInput) {
      serviceInput.addEventListener('input', (e) => {
        this.session.servicePercent = Number(e.target.value) || 0;
        this.onDataChanged();
      });
    }

    const flatFeeInput = container.querySelector('#session-flat-fee');
    if (flatFeeInput) {
      flatFeeInput.addEventListener('input', (e) => {
        const parsed = parseNumberInput(e.target.value);
        this.session.flatFee = parsed;
        e.target.value = formatInputDigits(parsed);
        this.onDataChanged();
      });
    }

    const paymentInfoInput = container.querySelector('#session-payment-info');
    if (paymentInfoInput) {
      paymentInfoInput.addEventListener('input', (e) => {
        this.session.paymentInfo = e.target.value;
      });
    }

    // Tambah Peserta
    const btnAddParticipant = container.querySelector('#btn-add-participant');
    const inputNewParticipant = container.querySelector('#input-new-participant');

    const handleAddParticipant = () => {
      const name = inputNewParticipant ? inputNewParticipant.value.trim() : '';
      if (name) {
        if (this.session.participants.map(p => p.toLowerCase()).includes(name.toLowerCase())) {
          alert('Nama peserta sudah ada.');
          return;
        }
        this.session.participants.push(name);
        if (inputNewParticipant) inputNewParticipant.value = '';
        this.onDataChanged();
      }
    };

    if (btnAddParticipant) {
      btnAddParticipant.addEventListener('click', handleAddParticipant);
    }
    if (inputNewParticipant) {
      inputNewParticipant.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddParticipant();
        }
      });
    }

    // Hapus Peserta
    const removeParticipantBtns = container.querySelectorAll('[data-remove-participant]');
    removeParticipantBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const nameToRemove = btn.getAttribute('data-remove-participant');
        if (this.session.participants.length <= 2) {
          alert('Minimal 2 orang peserta untuk split bill.');
          return;
        }
        this.session.participants = this.session.participants.filter(p => p !== nameToRemove);
        // Hapus juga dari item yang dicentang
        this.session.items.forEach(it => {
          it.participants = it.participants.filter(p => p !== nameToRemove);
        });
        this.onDataChanged();
      });
    });

    // Tambah Item Menu Baru
    const btnAddItem = container.querySelector('#btn-add-item');
    if (btnAddItem) {
      btnAddItem.addEventListener('click', () => {
        const newId = (this.session.items.length > 0 ? Math.max(...this.session.items.map(i => i.id || 0)) : 0) + 1;
        this.session.items.push({
          id: newId,
          name: '',
          price: 0,
          participants: [...this.session.participants] // default pilih semua
        });
        this.onDataChanged();
      });
    }

    // Update Field Item (Name / Price)
    const itemInputs = container.querySelectorAll('[data-item-field]');
    itemInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const field = input.getAttribute('data-item-field');
        const idx = Number(input.getAttribute('data-item-idx'));
        if (this.session.items[idx]) {
          if (field === 'price') {
            const parsed = parseNumberInput(e.target.value);
            this.session.items[idx].price = parsed;
            e.target.value = formatInputDigits(parsed);
          } else {
            this.session.items[idx][field] = e.target.value;
          }
          this.onDataChanged();
        }
      });
    });

    // Hapus Item
    const removeItemBtns = container.querySelectorAll('[data-remove-item-idx]');
    removeItemBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-remove-item-idx'));
        if (this.session.items.length <= 1) {
          alert('Minimal harus ada 1 item pesanan.');
          return;
        }
        this.session.items.splice(idx, 1);
        this.onDataChanged();
      });
    });

    // Toggle Centang Peserta pada Item Tertentu
    const toggleParticipantBtns = container.querySelectorAll('[data-toggle-participant]');
    toggleParticipantBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const pName = btn.getAttribute('data-toggle-participant');
        const itemIdx = Number(btn.getAttribute('data-toggle-item-idx'));
        const item = this.session.items[itemIdx];
        if (item) {
          const pIndex = item.participants.indexOf(pName);
          if (pIndex >= 0) {
            item.participants.splice(pIndex, 1);
          } else {
            item.participants.push(pName);
          }
          this.onDataChanged();
        }
      });
    });

    // Pilih / Batal Semua Peserta pada Item
    const selectAllBtns = container.querySelectorAll('[data-select-all-idx]');
    selectAllBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const itemIdx = Number(btn.getAttribute('data-select-all-idx'));
        const item = this.session.items[itemIdx];
        if (item) {
          if (item.participants.length === this.session.participants.length) {
            item.participants = [];
          } else {
            item.participants = [...this.session.participants];
          }
          this.onDataChanged();
        }
      });
    });

    // Tombol Salin Format WA
    const btnCopyWA = container.querySelector('#btn-copy-wa');
    if (btnCopyWA) {
      btnCopyWA.addEventListener('click', async () => {
        const calcResult = calculateSplitBill(this.session);
        const text = generateWhatsAppSplitBillText(this.session, calcResult);
        const success = await copyToClipboard(text);
        if (success) {
          this.showToast('Format rincian berhasil disalin! Tinggal tempel di grup WhatsApp.');
        } else {
          alert('Gagal menyalin otomatis. Silakan izinkan akses clipboard browser Anda.');
        }
      });
    }

    // Tombol Kirim Langsung via WA
    const btnOpenWA = container.querySelector('#btn-open-wa');
    if (btnOpenWA) {
      btnOpenWA.addEventListener('click', () => {
        const calcResult = calculateSplitBill(this.session);
        const text = generateWhatsAppSplitBillText(this.session, calcResult);
        openWhatsAppWithText(text);
      });
    }

    // Tombol Simpan Sesi ke IndexedDB
    const btnSaveSession = container.querySelector('#btn-save-session');
    if (btnSaveSession) {
      btnSaveSession.addEventListener('click', async () => {
        const calcResult = calculateSplitBill(this.session);
        const sessionPayload = {
          ...this.session,
          totalAmount: calcResult.grandTotal,
          status: 'open',
          date: this.session.date || new Date().toISOString()
        };

        if (this.session.id) {
          await SplitBillService.update(this.session.id, sessionPayload);
          this.showToast('Sesi split bill berhasil diperbarui di database offline!');
        } else {
          const newId = await SplitBillService.add(sessionPayload);
          this.session.id = newId;
          this.showToast('Sesi split bill berhasil disimpan ke database offline!');
        }

        this.onDataChanged(true); // reload saved list from DB
      });
    }

    // Tombol Buka Sesi dari Riwayat
    const loadSessionBtns = container.querySelectorAll('[data-load-session-id]');
    loadSessionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-load-session-id'));
        const found = await SplitBillService.getById(id);
        if (found) {
          this.session = {
            id: found.id,
            title: found.title || 'Makan Bersama',
            date: (found.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
            taxPercent: Number(found.taxPercent) || 0,
            servicePercent: Number(found.servicePercent) || 0,
            flatFee: Number(found.flatFee) || 0,
            paymentInfo: found.paymentInfo || '',
            participants: found.participants || ['Ahmad', 'Budi'],
            items: found.items || []
          };
          this.activeView = 'editor';
          this.onDataChanged();
        }
      });
    });

    // Tombol Hapus Sesi dari Riwayat
    const deleteSessionBtns = container.querySelectorAll('[data-delete-session-id]');
    deleteSessionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-delete-session-id'));
        this.deleteConfirmSessionId = id;
        this.onDataChanged();
      });
    });

    const btnCancelDeleteSession = container.querySelector('#btn-cancel-delete-session');
    if (btnCancelDeleteSession) {
      btnCancelDeleteSession.addEventListener('click', () => {
        this.deleteConfirmSessionId = null;
        this.onDataChanged();
      });
    }

    const btnConfirmDeleteSession = container.querySelector('#btn-confirm-delete-session');
    if (btnConfirmDeleteSession) {
      btnConfirmDeleteSession.addEventListener('click', async () => {
        if (this.deleteConfirmSessionId) {
          await SplitBillService.delete(this.deleteConfirmSessionId);
          if (this.session.id === this.deleteConfirmSessionId) {
            this.session = this.createNewSessionState();
          }
          this.deleteConfirmSessionId = null;
          this.showToast('Sesi berhasil dihapus dari database.');
          this.onDataChanged(true);
        }
      });
    }
  }
}


/* --- End: js/components/splitbill.js --- */

/* --- Start: js/components/analytics.js --- */
/**
 * PocketLedger - Analytics Component
 * Analisis alokasi pengeluaran per kategori, diagram lingkaran (Doughnut Chart) SVG murni,
 * dan filter periode bulan/tahun.
 */




// Palet warna cerah untuk segment diagram SVG
const CATEGORY_COLORS = {
  'makanan & minuman': '#f59e0b', // amber-500
  'transportasi': '#3b82f6',     // blue-500
  'belanja': '#a855f7',          // purple-500
  'tagihan & utilitas': '#eab308', // yellow-500
  'hiburan': '#ec4899',          // pink-500
  'kesehatan': '#ef4444',        // red-500
  'pendidikan': '#06b6d4',       // cyan-500
  'lainnya': '#64748b'           // slate-500
};

const DEFAULT_COLOR = '#10b981'; // emerald-500

class AnalyticsComponent {
  constructor({ onDataChanged }) {
    this.onDataChanged = onDataChanged || (() => {});
    this.transactions = [];

    const now = new Date();
    this.selectedYear = now.getFullYear();
    this.selectedMonth = now.getMonth(); // 0 = Januari, 11 = Desember
  }

  setTransactions(transactions) {
    this.transactions = transactions || [];
  }

  /**
   * Filter transaksi pengeluaran berdasarkan bulan dan tahun terpilih
   */
  getFilteredExpenses() {
    return this.transactions.filter(tx => {
      if (tx.type !== 'expense') return false;
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return false;

      const matchYear = d.getFullYear() === this.selectedYear;
      const matchMonth = this.selectedMonth === 'all' || d.getMonth() === Number(this.selectedMonth);
      return matchYear && matchMonth;
    });
  }

  /**
   * Agregasi pengeluaran per kategori diurutkan dari terbesar ke terkecil
   */
  getCategoryBreakdown() {
    const expenses = this.getFilteredExpenses();
    const map = {};
    let totalExpense = 0;

    expenses.forEach(tx => {
      const catName = (tx.category || 'Lainnya').trim();
      const amount = Number(tx.amount) || 0;
      totalExpense += amount;

      if (!map[catName]) {
        const key = catName.toLowerCase();
        const color = CATEGORY_COLORS[key] || DEFAULT_COLOR;
        const meta = getCategoryMeta(catName, 'expense');

        map[catName] = {
          name: catName,
          amount: 0,
          count: 0,
          color: color,
          icon: meta.icon || 'tag',
          bg: meta.bg || 'bg-slate-800',
          text: meta.text || 'text-slate-200'
        };
      }

      map[catName].amount += amount;
      map[catName].count += 1;
    });

    const list = Object.values(map)
      .map(item => ({
        ...item,
        percentage: totalExpense > 0 ? (item.amount / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      list,
      totalExpense,
      totalTransactions: expenses.length
    };
  }

  /**
   * Render Diagram Lingkaran (Doughnut Chart) SVG Murni
   */
  renderSvgDoughnut(breakdownList, totalExpense) {
    const size = 200;
    const radius = 70;
    const strokeWidth = 26;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    if (!breakdownList || breakdownList.length === 0 || totalExpense === 0) {
      return `
        <div class="relative flex items-center justify-center py-4">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90">
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="transparent"
              stroke="#1e293b"
              stroke-width="${strokeWidth}"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <span class="text-xs font-semibold text-slate-400">Belum Ada</span>
            <span class="text-[11px] text-slate-500">Pengeluaran</span>
          </div>
        </div>
      `;
    }

    let accumulatedOffset = 0;
    const segments = breakdownList.map(item => {
      const dashLength = (item.percentage / 100) * circumference;
      const dashSpace = circumference - dashLength;
      const strokeDasharray = `${dashLength.toFixed(2)} ${dashSpace.toFixed(2)}`;
      const strokeDashoffset = (-accumulatedOffset).toFixed(2);
      accumulatedOffset += dashLength;

      return `
        <circle
          cx="${center}"
          cy="${center}"
          r="${radius}"
          fill="transparent"
          stroke="${item.color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${strokeDasharray}"
          stroke-dashoffset="${strokeDashoffset}"
          class="transition-all duration-500 hover:opacity-90 cursor-pointer"
        >
          <title>${item.name}: ${formatRupiah(item.amount)} (${item.percentage.toFixed(1)}%)</title>
        </circle>
      `;
    }).join('');

    return `
      <div class="relative flex items-center justify-center py-3">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="transform -rotate-90 filter drop-shadow-md">
          <!-- Background track -->
          <circle
            cx="${center}"
            cy="${center}"
            r="${radius}"
            fill="transparent"
            stroke="#1e293b"
            stroke-width="${strokeWidth}"
          />
          ${segments}
        </svg>

        <!-- Center Text: Total Pengeluaran -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
          <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Pengeluaran</span>
          <span class="text-sm font-extrabold text-white font-mono mt-0.5 max-w-[110px] truncate">
            ${formatRupiah(totalExpense)}
          </span>
          <span class="text-[9px] text-slate-400 mt-0.5">${breakdownList.length} Kategori</span>
        </div>
      </div>
    `;
  }

  /**
   * Render Komponen Utama Analisis
   */
  render() {
    const { list, totalExpense, totalTransactions } = this.getCategoryBreakdown();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const topCategory = list.length > 0 ? list[0] : null;

    return `
      <div class="space-y-4 animate-fade-in pb-20">
        
        <!-- HEADER & FILTER PERIODE -->
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-4 shadow-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <i data-lucide="pie-chart" class="w-4 h-4"></i>
              </div>
              <div>
                <h2 class="text-sm font-bold text-white">Analisis Alokasi</h2>
                <p class="text-[10px] text-slate-400">Diagram pengeluaran offline</p>
              </div>
            </div>

            <!-- Tombol Cepat: Bulan Ini -->
            <button id="btn-quick-this-month" type="button" class="text-[10px] font-semibold px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all">
              Bulan Ini
            </button>
          </div>

          <!-- Selector Bulan dan Tahun -->
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/60">
            <div>
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">Pilih Bulan</label>
              <select id="select-month" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-medium cursor-pointer">
                <option value="all" ${this.selectedMonth === 'all' ? 'selected' : ''}>Sepanjang Tahun</option>
                ${months.map((m, idx) => `
                  <option value="${idx}" ${this.selectedMonth === idx ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-semibold text-slate-400 mb-1">Pilih Tahun</label>
              <select id="select-year" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-medium cursor-pointer">
                ${years.map(y => `
                  <option value="${y}" ${this.selectedYear === y ? 'selected' : ''}>${y}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- DIAGRAM LINGKARAN (DOUGHNUT) SVG -->
        <div class="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-5 shadow-xl text-center">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">Proporsi Pengeluaran</h3>
          <p class="text-[11px] text-slate-400 mb-2">
            Periode: ${this.selectedMonth === 'all' ? 'Sepanjang Tahun' : months[this.selectedMonth]} ${this.selectedYear}
          </p>

          ${this.renderSvgDoughnut(list, totalExpense)}

          <!-- Quick Metrics Bar -->
          <div class="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-700/60 text-left">
            <div class="bg-slate-900/60 rounded-2xl p-2.5 border border-slate-800">
              <span class="text-[10px] font-medium text-slate-400 block">Kategori Terbesar</span>
              <span class="text-xs font-bold text-amber-400 truncate block mt-0.5">
                ${topCategory ? `${topCategory.name} (${topCategory.percentage.toFixed(0)}%)` : '-'}
              </span>
            </div>
            <div class="bg-slate-900/60 rounded-2xl p-2.5 border border-slate-800">
              <span class="text-[10px] font-medium text-slate-400 block">Frekuensi Catatan</span>
              <span class="text-xs font-bold text-slate-200 block mt-0.5 font-mono">
                ${totalTransactions} Transaksi
              </span>
            </div>
          </div>
        </div>

        <!-- DAFTAR PERSENTASE KATEGORI (TERBESAR KE TERKECIL) -->
        <div class="bg-slate-800/70 border border-slate-700/80 rounded-3xl p-4 space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-300">Rincian Per Kategori</h3>
            <span class="text-[11px] text-slate-400 font-mono">${list.length} Kategori</span>
          </div>

          ${list.length === 0 ? `
            <div class="py-6 text-center text-slate-400 space-y-2">
              <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <i data-lucide="inbox" class="w-6 h-6"></i>
              </div>
              <p class="text-xs font-medium text-slate-300">Tidak ada pengeluaran pada periode ini</p>
              <p class="text-[11px] text-slate-500">Ubah filter bulan di atas atau catat pengeluaran di tab Transaksi.</p>
            </div>
          ` : `
            <div class="space-y-3">
              ${list.map((cat, idx) => `
                <div class="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${cat.color}25; color: ${cat.color}">
                        <i data-lucide="${cat.icon}" class="w-4 h-4"></i>
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                          <span>${cat.name}</span>
                          <span class="text-[10px] text-slate-500 font-normal">(${cat.count}x)</span>
                        </div>
                        <div class="text-[11px] font-mono text-slate-400">${formatRupiah(cat.amount)}</div>
                      </div>
                    </div>

                    <div class="text-right flex-shrink-0">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono" style="background-color: ${cat.color}20; color: ${cat.color}">
                        ${cat.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <!-- Progress Bar Proporsional -->
                  <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      class="h-2 rounded-full transition-all duration-500"
                      style="width: ${cat.percentage}%; background-color: ${cat.color}"
                    ></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }

  /**
   * Bind Event Listeners
   */
  bindEvents(container) {
    if (!container) return;

    const selectMonth = container.querySelector('#select-month');
    if (selectMonth) {
      selectMonth.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value === 'all' ? 'all' : Number(e.target.value);
        this.onDataChanged();
      });
    }

    const selectYear = container.querySelector('#select-year');
    if (selectYear) {
      selectYear.addEventListener('change', (e) => {
        this.selectedYear = Number(e.target.value);
        this.onDataChanged();
      });
    }

    const btnThisMonth = container.querySelector('#btn-quick-this-month');
    if (btnThisMonth) {
      btnThisMonth.addEventListener('click', () => {
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth();
        this.onDataChanged();
      });
    }
  }
}


/* --- End: js/components/analytics.js --- */

/* --- Start: js/components/backup.js --- */
/**
 * PocketLedger - Backup & Settings Component
 * Manajemen Dompet, Zero-Server Backup (Ekspor & Impor JSON), dan Reset Data Pabrik.
 */




class BackupSettingsComponent {
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


/* --- End: js/components/backup.js --- */

/* --- Start: js/app.js --- */
/**
 * PocketLedger Application Bootstrap & State Router
 * Menangani routing antar tab tanpa reload, Service Worker PWA, dan reaktivitas saldo
 */








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

        // Paksa periksa pembaruan berkas sw.js pada setiap muat ulang
        if (typeof reg.update === 'function') {
          reg.update().catch(() => {});
        }

        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] Versi baru tersedia, mengaktifkan Service Worker...');
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  console.log('[PWA] Konten berhasil dicache untuk penggunaan offline.');
                }
              }
            };
          }
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
   * Helper aman untuk mengubah styling class pada elemen HTML maupun SVG
   * Mencegah "TypeError: Cannot set property className of #<SVGElement> which has only a getter"
   */
  setElementClasses(element, className) {
    if (!element) return;
    try {
      if (typeof element.setAttribute === 'function') {
        element.setAttribute('class', className);
      } else if (element.classList) {
        element.setAttribute('class', className);
      }
    } catch (err) {
      console.warn('[Nav] Gagal mengatur class elemen:', err);
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

    // Update styling tombol bottom navigation bar dengan aman (mendukung elemen HTML & SVG)
    Object.entries(this.tabButtons).forEach(([key, btn]) => {
      if (!btn) return;
      try {
        const icon = btn.querySelector('.tab-icon') || btn.querySelector('svg') || btn.querySelector('i');
        const label = btn.querySelector('.tab-label') || btn.querySelector('span');

        if (key === target) {
          this.setElementClasses(btn, 'tab-btn flex flex-col items-center justify-center py-2 px-3 text-emerald-400 font-medium transition-colors relative');
          if (icon) {
            this.setElementClasses(icon, 'tab-icon w-5 h-5 mb-1 text-emerald-400 stroke-[2.5]');
          }
          if (label) {
            this.setElementClasses(label, 'tab-label text-xs font-semibold text-emerald-400');
          }
        } else {
          this.setElementClasses(btn, 'tab-btn flex flex-col items-center justify-center py-2 px-3 text-slate-400 hover:text-slate-200 transition-colors relative');
          if (icon) {
            this.setElementClasses(icon, 'tab-icon w-5 h-5 mb-1 text-slate-400 stroke-[1.8]');
          }
          if (label) {
            this.setElementClasses(label, 'tab-label text-xs text-slate-400');
          }
        }
      } catch (navErr) {
        console.warn(`[Nav] Gagal memperbarui tombol tab ${key}:`, navErr);
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
    try {
      const initialHash = window.location.hash.replace('#', '');
      this.navigateTo(initialHash || 'transaksi', false);
    } catch (navErr) {
      console.warn('[PocketLedger] Initial navigation warning:', navErr);
      this.currentTab = 'transaksi';
      this.renderCurrentView();
    }
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

const _defaultExport = app;

/* --- End: js/app.js --- */

  // Ekspos ke global window untuk debugging & integrasi luar jika diperlukan
  if (typeof window !== 'undefined') {
    window.PocketLedgerApp = app;
  }
})();
