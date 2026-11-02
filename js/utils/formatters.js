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
export function formatRupiah(amount, options = {}) {
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
export function parseNumberInput(rawValue) {
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
export function formatInputDigits(value) {
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
export function formatDateIndo(dateStr, options = { withDay: true, shortMonth: false }) {
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
export function formatRelativeDate(dateStr) {
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
export function getDateGroupKey(dateStr) {
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
export function formatTimeIndo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

