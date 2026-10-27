// Shared frontend helpers: API calls, auth, cart, header, toasts
const App = (() => {
  const TOKEN_KEY = 'shop_token';
  const USER_KEY = 'shop_user';
  const CART_KEY = 'shop_cart';

  // ---------- Auth ----------
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  };
  function setSession({ token, user }) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    location.href = '/';
  }

  // ---------- API ----------
  async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ---------- Cart (stored in the browser) ----------
  const getCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  };
  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
  }
  function addToCart(product, qty = 1) {
    const cart = getCart();
    const line = cart.find((l) => l.id === product.id);
    const current = line ? line.quantity : 0;
    const wanted = Math.min(current + qty, product.stock);
    if (wanted <= current) {
      toast(`No more stock for "${product.name}".`, 'error');
      return;
    }
    if (line) line.quantity = wanted;
    else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, color: product.color, stock: product.stock, quantity: wanted });
    saveCart(cart);
    toast(`Added "${product.name}" to cart`);
  }
  function setQty(id, qty) {
    let cart = getCart();
    const line = cart.find((l) => l.id === id);
    if (!line) return;
    if (qty <= 0) cart = cart.filter((l) => l.id !== id);
    else line.quantity = Math.min(qty, line.stock);
    saveCart(cart);
  }
  const clearCart = () => saveCart([]);
  const cartCount = () => getCart().reduce((s, l) => s + l.quantity, 0);
  const cartTotal = () => getCart().reduce((s, l) => s + l.price * l.quantity, 0);

  // ---------- UI helpers ----------
  const money = (n) => `${Number(n).toFixed(2)} TND`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function productThumb(p, size = '') {
    return `<div class="thumb ${size}" style="--c:${esc(p.color)}"><span>${esc(p.image)}</span></div>`;
  }

  function toast(msg, type = 'ok') {
    let box = document.getElementById('toasts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toasts';
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('hide'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function updateCartBadge() {
    const b = document.getElementById('cart-count');
    if (b) {
      const n = cartCount();
      b.textContent = n;
      b.hidden = n === 0;
    }
  }

  function renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const user = getUser();
    el.innerHTML = `
      <div class="container nav">
        <a href="/" class="logo">🛍️ <b>Souk</b>Store</a>
        <nav>
          <a href="/">Shop</a>
          ${user ? `<a href="/orders.html">My Orders</a>` : ''}
          ${user && user.role === 'admin' ? `<a href="/admin.html">Admin</a>` : ''}
          <a href="/cart.html" class="cart-link">🛒 Cart <span id="cart-count" class="badge" hidden>0</span></a>
          ${user
            ? `<span class="hello">Hi, ${esc(user.name.split(' ')[0])}</span><button class="btn ghost sm" id="logout-btn">Logout</button>`
            : `<a href="/login.html" class="btn ghost sm">Login</a><a href="/register.html" class="btn sm">Sign up</a>`}
        </nav>
      </div>`;
    const lo = document.getElementById('logout-btn');
    if (lo) lo.onclick = logout;
    updateCartBadge();
  }

  function requireLogin() {
    if (!getToken()) {
      location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
      return false;
    }
    return true;
  }

  document.addEventListener('DOMContentLoaded', renderHeader);

  return {
    api, getUser, getToken, setSession, logout, requireLogin,
    getCart, addToCart, setQty, clearCart, cartCount, cartTotal,
    money, esc, productThumb, toast,
  };
})();
