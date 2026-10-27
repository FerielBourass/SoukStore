const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/products?search=&category=&sort=
router.get('/', (req, res) => {
  const { search = '', category = '', sort = 'newest' } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const orderBy = { price_asc: 'price ASC', price_desc: 'price DESC', name: 'name ASC' }[sort] || 'id DESC';
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${orderBy}`;
  res.json({ products: db.prepare(sql).all(...params) });
});

// GET /api/products/categories
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
  res.json({ categories: rows.map((r) => r.category) });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  const related = db
    .prepare('SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4')
    .all(product.category, product.id);
  res.json({ product, related });
});

function validateProduct(body) {
  const p = {
    name: String(body.name || '').trim(),
    description: String(body.description || '').trim(),
    price: Number(body.price),
    stock: parseInt(body.stock, 10),
    category: String(body.category || 'General').trim() || 'General',
    image: String(body.image || '📦').trim() || '📦',
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#6366f1',
  };
  if (!p.name) return { error: 'Product name is required.' };
  if (!Number.isFinite(p.price) || p.price < 0) return { error: 'Price must be a positive number.' };
  if (!Number.isInteger(p.stock) || p.stock < 0) return { error: 'Stock must be a whole number ≥ 0.' };
  return { product: p };
}

// POST /api/products (admin)
router.post('/', requireAdmin, (req, res) => {
  const { error, product: p } = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  const info = db
    .prepare('INSERT INTO products (name, description, price, stock, category, image, color) VALUES (?,?,?,?,?,?,?)')
    .run(p.name, p.description, p.price, p.stock, p.category, p.image, p.color);
  res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid) });
});

// PUT /api/products/:id (admin)
router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const { error, product: p } = validateProduct(req.body);
  if (error) return res.status(400).json({ error });
  db.prepare(
    'UPDATE products SET name=?, description=?, price=?, stock=?, category=?, image=?, color=? WHERE id=?'
  ).run(p.name, p.description, p.price, p.stock, p.category, p.image, p.color, req.params.id);
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) });
});

// DELETE /api/products/:id (admin)
router.delete('/:id', requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Product not found.' });
  res.json({ ok: true });
});

module.exports = router;
