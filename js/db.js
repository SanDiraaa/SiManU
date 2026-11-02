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
export const db = new Dexie('PocketLedgerDB');

// 2. Define Database Schema
db.version(1).stores({
  wallets: '++id, name, type, balance',
  transactions: '++id, type, amount, category, walletId, date, note',
  splitBills: '++id, title, date, totalAmount, status'
});

// 3. Seed Default Data
export const DEFAULT_WALLETS = [
  { name: 'Tunai', type: 'cash', balance: 0 },
  { name: 'BCA', type: 'bank', balance: 0 },
  { name: 'GoPay', type: 'ewallet', balance: 0 }
];

export async function seedInitialData() {
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
export const WalletService = {
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
export const TransactionService = {
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
export const SplitBillService = {
  async getAll() {
    return await db.splitBills.orderBy('date').reverse().toArray();
  },

  async getById(id) {
    return await db.splitBills.get(Number(id));
  },

  async add(splitBill) {
    const bill = {
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
    // Sertakan ID hanya jika berupa angka valid (misal saat restore backup), jangan sertakan jika null/undefined
    if (splitBill.id && !isNaN(Number(splitBill.id))) {
      bill.id = Number(splitBill.id);
    }
    return await db.splitBills.add(bill);
  },

  async update(id, changes) {
    const cleanChanges = { ...changes };
    delete cleanChanges.id; // Primary key tidak boleh diubah
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
export async function initDB() {
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

