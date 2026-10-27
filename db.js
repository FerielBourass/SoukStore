// Database layer: SQLite schema + seed data
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node.js ≥ 22.13 — no native build needed
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'store.db');

if (process.argv.includes('--reset') && fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Old database removed.');
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Small helper: db.transaction(fn)() runs fn inside BEGIN/COMMIT and rolls back on error
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       REAL NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category    TEXT NOT NULL DEFAULT 'General',
  image       TEXT NOT NULL DEFAULT '📦',
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total            REAL NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  shipping_name    TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_phone   TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;

  const products = [
    ['Wireless Headphones', 'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.', 189.0, 25, 'Electronics', '🎧', '#6366f1'],
    ['Smart Watch', 'Fitness tracking, heart-rate monitor, GPS and notifications right on your wrist.', 249.0, 15, 'Electronics', '⌚', '#0ea5e9'],
    ['Mechanical Keyboard', 'RGB backlit keyboard with tactile switches, perfect for coding and gaming.', 129.0, 30, 'Electronics', '⌨️', '#8b5cf6'],
    ['Portable Speaker', 'Waterproof speaker with deep bass, take your music anywhere.', 79.0, 40, 'Electronics', '🔊', '#14b8a6'],
    ['Running Shoes', 'Lightweight running shoes with breathable mesh and cushioned sole.', 119.0, 20, 'Fashion', '👟', '#f97316'],
    ['Leather Backpack', 'Handmade leather backpack with laptop compartment.', 159.0, 12, 'Fashion', '🎒', '#a16207'],
    ['Sunglasses', 'UV400 polarized sunglasses with a timeless design.', 49.0, 50, 'Fashion', '🕶️', '#334155'],
    ['Coffee Maker', 'Brew barista-quality espresso at home in under a minute.', 299.0, 8, 'Home', '☕', '#78350f'],
    ['Desk Lamp', 'LED desk lamp with adjustable brightness and color temperature.', 39.0, 35, 'Home', '💡', '#eab308'],
    ['Indoor Plant', 'Low-maintenance monstera plant in a ceramic pot.', 29.0, 18, 'Home', '🪴', '#16a34a'],
    ['Olive Oil 1L', 'Extra virgin Tunisian olive oil, first cold press.', 25.0, 60, 'Grocery', '🫒', '#65a30d'],
    ['Deglet Nour Dates 1kg', 'Premium dates from the oases of southern Tunisia.', 18.0, 70, 'Grocery', '🌴', '#b45309'],
  ];
  const insert = db.prepare(
    'INSERT INTO products (name, description, price, stock, category, image, color) VALUES (?,?,?,?,?,?,?)'
  );
  db.transaction(() => products.forEach((p) => insert.run(...p)))();

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@store.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?,?,?,?)').run(
    'Store Admin', adminEmail, bcrypt.hashSync(adminPass, 10), 'admin'
  );
  console.log(`Seeded ${products.length} products and admin account (${adminEmail}).`);
}

seed();

module.exports = db;
