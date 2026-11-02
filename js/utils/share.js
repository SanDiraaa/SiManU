/**
 * PocketLedger - WhatsApp Share & Clipboard Utility
 * Menghasilkan teks terstruktur untuk dibagikan ke grup WhatsApp
 */

import { formatRupiah, formatDateIndo } from './formatters.js';

/**
 * Buat format teks rapi untuk dibagikan via WhatsApp
 * @param {object} session
 * @param {object} calcResult
 * @returns {string}
 */
export function generateWhatsAppSplitBillText(session, calcResult) {
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
export async function copyToClipboard(text) {
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
export function openWhatsAppWithText(text) {
  const encoded = encodeURIComponent(text);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

