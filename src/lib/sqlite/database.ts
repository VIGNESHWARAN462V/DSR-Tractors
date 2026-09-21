import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = await SQLite.openDatabaseAsync('dsr_tractors.db');
  await initDatabaseSchema(dbInstance);
  return dbInstance;
}

export async function initDatabaseSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- Customers Table
    CREATE TABLE IF NOT EXISTS offline_customers (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      phone TEXT,
      location TEXT,
      village TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Machinery & Services Master
    CREATE TABLE IF NOT EXISTS offline_services (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      rate REAL NOT NULL,
      has_worker_types INTEGER DEFAULT 0,
      worker_rate REAL,
      no_worker_rate REAL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    -- Service Transactions (Bills Header)
    CREATE TABLE IF NOT EXISTS offline_service_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT NOT NULL,
      service_date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      user_id TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    -- Service Transaction Items
    CREATE TABLE IF NOT EXISTS offline_service_transaction_items (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL,
      service_id TEXT,
      service_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      worker_type TEXT,
      rate REAL NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT
    );

    -- Payments Table
    CREATE TABLE IF NOT EXISTS offline_payments (
      id TEXT PRIMARY KEY NOT NULL,
      customer_id TEXT NOT NULL,
      service_transaction_id TEXT,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT,
      user_id TEXT,
      created_at TEXT
    );

    -- Tractors Fleet
    CREATE TABLE IF NOT EXISTS offline_tractors (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      current_fuel_litres REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );

    -- Diesel Transactions
    CREATE TABLE IF NOT EXISTS offline_diesel_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      tractor_id TEXT NOT NULL,
      input_mode TEXT NOT NULL,
      diesel_amount REAL,
      diesel_price REAL NOT NULL,
      initial_fuel_litres REAL NOT NULL,
      total_working_hours REAL NOT NULL,
      consumption_rate REAL NOT NULL DEFAULT 4.00,
      diesel_consumed REAL NOT NULL,
      remaining_fuel REAL NOT NULL,
      transaction_date TEXT NOT NULL,
      notes TEXT,
      user_id TEXT,
      created_at TEXT
    );

    -- Diesel Timings
    CREATE TABLE IF NOT EXISTS offline_diesel_timings (
      id TEXT PRIMARY KEY NOT NULL,
      diesel_transaction_id TEXT NOT NULL,
      timing_hours REAL NOT NULL,
      timing_label TEXT,
      created_at TEXT
    );

    -- Settings Key-Value Store
    CREATE TABLE IF NOT EXISTS offline_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT
    );

    -- Sync Queue Table
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

/**
 * Generate a standard UUID v4 string for offline records
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
