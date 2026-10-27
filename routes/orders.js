const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

function withItems(order) {
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return order;
}

// POST /api/orders  — place an order from the cart
// body: { items: [{ productId, quantity }], shipping: { name, address, phone } }
router.post('/', requireAuth, (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const shipping = req.body.shipping || {};
  const name = String(shipping.name || '').trim();
  const address = String(shipping.address || '').trim();
  const phone = String(shipping.phone || '').trim();

  if (!items.length) return res.status(400).json({ error: 'Your cart is empty.' });
  if (!name || !address || !phone) return res.status(400).json({ error: 'Please fill in all shipping details.' });

  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');
  const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  const insertOrder = db.prepare(
    'INSERT INTO orders (user_id, total, shipping_name, shipping_address, shipping_phone) VALUES (?,?,?,?,?)'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, unit_price, quantity) VALUES (?,?,?,?,?)'
  );

  try {
    // One transaction: validate stock, decrement it, create the order. All or nothing.
    const orderId = db.transaction(() => {
      const lines = [];
      let total = 0;
      for (const it of items) {
        const qty = parseInt(it.quantity, 10);
        if (!Number.isInteger(qty) || qty < 1) throw new Error('Invalid quantity.');
        const product = getProduct.get(Number(it.productId) || 0);
        if (!product) throw new Error('A product in your cart no longer exists.');
        if (product.stock < qty) throw new Error(`Only ${product.stock} left of "${product.name}".`);
        // Prices always come from the database, never from the client
        lines.push({ product, qty });
        total += product.price * qty;
      }
      total = Math.round(total * 100) / 100;
      const { lastInsertRowid } = insertOrder.run(req.user.id, total, name, address, phone);
      for (const { product, qty } of lines) {
        const r = decStock.run(qty, product.id, qty);
        if (!r.changes) throw new Error(`"${product.name}" just went out of stock.`);
        insertItem.run(lastInsertRowid, product.id, product.name, product.price, qty);
      }
      return lastInsertRowid;
    })();

    const order = withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId));
    res.status(201).json({ order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/orders/mine
router.get('/mine', requireAuth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ orders: orders.map(withItems) });
});

// POST /api/orders/:id/cancel  — customer can cancel while still pending
router.post('/:id/cancel', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled.' });
  db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    // Put the stock back
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
    items.forEach((i) => i.product_id && inc.run(i.quantity, i.product_id));
  })();
  res.json({ order: withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
});

// GET /api/orders  (admin) — all orders
router.get('/', requireAdmin, (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC`
    )
    .all();
  res.json({ orders: orders.map(withItems) });
});

// PATCH /api/orders/:id/status  (admin)
router.patch('/:id/status', requireAdmin, (req, res) => {
  const status = String(req.body.status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status === 'cancelled') return res.status(400).json({ error: 'Cancelled orders cannot be changed.' });
  db.transaction(() => {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
    if (status === 'cancelled') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      const inc = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
      items.forEach((i) => i.product_id && inc.run(i.quantity, i.product_id));
    }
  })();
  res.json({ order: withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
});

module.exports = router;
