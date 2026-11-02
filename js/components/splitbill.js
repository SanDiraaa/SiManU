/**
 * PocketLedger - Split Bill Component
 * Menangani pembuatan sesi split bill itemized, kalkulasi proporsional,
 * penyimpanan ke IndexedDB, dan pembagian ke WhatsApp.
 */

import { SplitBillService } from '../db.js';
import { formatRupiah, parseNumberInput, formatInputDigits, formatDateIndo } from '../utils/formatters.js';
import { generateWhatsAppSplitBillText, copyToClipboard, openWhatsAppWithText } from '../utils/share.js';

/**
 * Logika Perhitungan Proporsional Split Bill
 * @param {object} session
 * @returns {object}
 */
export function calculateSplitBill(session) {
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

export class SplitBillComponent {
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

