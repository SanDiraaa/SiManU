/**
 * PocketLedger - Analytics Component
 * Analisis alokasi pengeluaran per kategori, diagram lingkaran (Doughnut Chart) SVG murni,
 * dan filter periode bulan/tahun.
 */

import { formatRupiah } from '../utils/formatters.js';
import { CATEGORY_DEFINITIONS, getCategoryMeta } from './expense.js';

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

export class AnalyticsComponent {
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

