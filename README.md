# 🛍️ SoukStore — Simple E-commerce Store

**CodeAlpha Full Stack Development Internship — Task 1**

A complete e-commerce web app: product catalogue, product details, shopping cart, user registration/login, order processing, and an admin dashboard.

## ✨ Features

| Area | What it does |
|---|---|
| **Product listing** | Grid of products with search, category filter and sorting (price / name / newest) |
| **Product details** | Dedicated page with description, live stock status, quantity picker and related products |
| **Shopping cart** | Add / remove / change quantities, persistent across reloads, live total and cart badge |
| **Auth** | Register & login with hashed passwords (bcrypt) and JWT tokens |
| **Order processing** | Checkout with shipping details; server re-checks stock and prices inside a single DB transaction, then decrements stock |
| **My orders** | Order history with status badges; customers can cancel pending orders (stock is restored) |
| **Admin dashboard** | Manage order statuses (pending → processing → shipped → delivered) and add / edit / delete products |

## 🧱 Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript (no framework)
- **Backend:** Node.js + Express.js (REST API)
- **Database:** SQLite (Node's built-in `node:sqlite`) — tables: `users`, `products`, `orders`, `order_items`
- **Security:** bcrypt password hashing, JWT auth, server-side price & stock validation, input validation, HTML escaping on the frontend

## 🚀 Getting started

Requirements: **Node.js 22.13+** (uses the built-in `node:sqlite` module, so there is nothing native to compile)

```bash
npm install
npm start
```

Open **http://localhost:3000**

The database (`data/store.db`) is created and seeded automatically on first run with 12 products and a demo admin:

- **Admin:** `admin@store.com` / `admin123`

To reset the database: `npm run seed`

### Optional environment variables

| Variable | Default |
|---|---|
| `PORT` | `3000` |
| `JWT_SECRET` | `dev-secret-change-me` (change it in production) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@store.com` / `admin123` |

## 📁 Project structure

```
├── server.js            # Express app entry point
├── db.js                # SQLite schema + seed data
├── middleware/auth.js   # JWT helpers, requireAuth / requireAdmin
├── routes/
│   ├── auth.js          # /api/auth   — register, login, me
│   ├── products.js      # /api/products — list, details, CRUD (admin)
│   └── orders.js        # /api/orders — checkout, my orders, cancel, admin status
└── public/              # Frontend (served statically)
    ├── index.html       # Shop / product listing
    ├── product.html     # Product details
    ├── cart.html        # Cart + checkout
    ├── login.html / register.html
    ├── orders.html      # Order history
    ├── admin.html       # Admin dashboard
    ├── css/style.css
    └── js/app.js        # Shared API, auth & cart helpers
```

## 🔌 API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create account → `{ token, user }` |
| POST | `/api/auth/login` | – | Login → `{ token, user }` |
| GET | `/api/auth/me` | User | Current user |
| GET | `/api/products?search=&category=&sort=` | – | List products |
| GET | `/api/products/categories` | – | All categories |
| GET | `/api/products/:id` | – | Product + related products |
| POST / PUT / DELETE | `/api/products[/:id]` | Admin | Manage products |
| POST | `/api/orders` | User | Place order `{ items:[{productId,quantity}], shipping:{name,address,phone} }` |
| GET | `/api/orders/mine` | User | My orders |
| POST | `/api/orders/:id/cancel` | User | Cancel a pending order |
| GET | `/api/orders` | Admin | All orders |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |

---

Built by **Feriel Bourass** for the CodeAlpha Full Stack Development Internship.
