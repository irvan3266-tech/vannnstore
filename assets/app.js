/* ===============================
   CONFIG
================================ */
const WA_NUMBER = "6289505674504";
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

// Endpoint API (di-route ke Cloudflare Worker)
const API_CREATE = "/api/create";

/* ===============================
   STATE
================================ */
const state = {
  products: [],
  cart: loadCart(),     // { [id]: qty }
  lastOrder: null       // { orderId, amount, reference }
};

const el = (id) => document.getElementById(id);

/* ===============================
   HELPERS
================================ */
function rupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n || 0));
}

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("vannnstore_cart") || "{}");
  } catch {
    return {};
  }
}
function saveCart() {
  localStorage.setItem("vannnstore_cart", JSON.stringify(state.cart));
}

function cartCount() {
  return Object.values(state.cart).reduce((a, b) => a + b, 0);
}

function cartTotal() {
  const map = new Map(state.products.map((p) => [p.id, p]));
  let total = 0;
  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    if (p) total += (p.price || 0) * qty;
  }
  return total;
}

function normalizeCategory(s) {
  return String(s || "").trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ===============================
   TOAST (notif tengah)
   BUTUH HTML:
   <div id="toast" class="toast hidden">
     <div class="toast-box">✅ Ditambahkan ke keranjang</div>
   </div>
================================ */
function showToast(text = "✅ Ditambahkan ke keranjang") {
  const toast = el("toast");
  if (!toast) return;
  const box = toast.querySelector(".toast-box");
  if (box) box.textContent = text;

  toast.classList.remove("hidden");

  // reset animasi
  if (box) {
    box.style.animation = "none";
    box.offsetHeight;
    box.style.animation = null;
  }

  setTimeout(() => toast.classList.add("hidden"), 1400);
}

/* ===============================
   CATEGORIES / FILTER
================================ */
function buildCategoryOptions() {
  const sel = el("category");
  if (!sel) return;

  const cats = Array.from(
    new Set(state.products.map((p) => normalizeCategory(p.category)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  sel.innerHTML =
    `<option value="all">Semua Kategori</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function filteredProducts() {
  const q = (el("search")?.value || "").trim().toLowerCase();
  const onlyStock = !!el("onlyInStock")?.checked;

  let items = state.products.slice();

  if (q) {
    items = items.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    );
  }

  const cat = normalizeCategory(el("category")?.value || "all");
  if (cat !== "all") items = items.filter((p) => normalizeCategory(p.category) === cat);

  if (onlyStock) items = items.filter((p) => (p.stock ?? 0) > 0);

  const sort = el("sort")?.value || "popular";
  if (sort === "low") items.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sort === "high") items.sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (sort === "az") items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return items;
}

/* ===============================
   CART RENDER
================================ */
function renderCartItems() {
  const wrap = el("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";
  const map = new Map(state.products.map((p) => [p.id, p]));
  const ids = Object.keys(state.cart);

  if (!ids.length) {
    wrap.innerHTML = `<div class="empty"><h3>Keranjang kosong</h3><p>Tambahkan produk dulu ya.</p></div>`;
    return;
  }

  for (const id of ids) {
    const p = map.get(id);
    if (!p) continue;

    const qty = state.cart[id];

    const item = document.createElement("div");
    item.className = "cart-item";
    item.innerHTML = `
      <div class="cart-name">${escapeHtml(p.name)}</div>
      <div class="cart-meta">${rupiah(p.price || 0)} • ${escapeHtml(p.category || "")}</div>
      <div class="qtyrow">
        <div class="qtyctrl">
          <button class="qbtn" type="button" data-dec="${escapeHtml(id)}">−</button>
          <strong>${qty}</strong>
          <button class="qbtn" type="button" data-inc="${escapeHtml(id)}">+</button>
        </div>
        <button class="btn ghost" type="button" data-rm="${escapeHtml(id)}">Hapus</button>
      </div>
    `;
    wrap.appendChild(item);
  }

  wrap.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => addToCart(b.getAttribute("data-inc")))
  );
  wrap.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => decFromCart(b.getAttribute("data-dec")))
  );
  wrap.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => removeFromCart(b.getAttribute("data-rm")))
  );
}

/* ===============================
   MAIN RENDER
================================ */
function render() {
  const year = el("year");
  if (year) year.textContent = new Date().getFullYear();

  const items = filteredProducts();
  const grid = el("grid");
  const empty = el("empty");
  if (!grid) return;

  grid.innerHTML = "";

  if (!items.length) empty?.classList.remove("hidden");
  else empty?.classList.add("hidden");

  for (const p of items) {
    const card = document.createElement("div");
    card.className = "card";

    const inStock = (p.stock ?? 0) > 0;
    const notes = Array.isArray(p.notes) ? p.notes : [];
    const img = p.image ? p.image : "assets/images/no-image.png";

    card.innerHTML = `
      <div class="card-img">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name || "Produk")}" loading="lazy">
      </div>
      <div class="card-top">
        <div class="kat">${escapeHtml(p.category || "Produk")}</div>
        ${p.badge ? `<div class="tag">${escapeHtml(p.badge)}</div>` : ``}
      </div>
      <div class="name">${escapeHtml(p.name || "Tanpa Nama")}</div>
      <p class="price">${rupiah(p.price || 0)}</p>
      <div class="unit">${escapeHtml(p.unit || "")}</div>
      ${notes.length ? `<ul class="notes">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : ``}
      <div class="card-foot">
        <div class="stock">${inStock ? `Stok: ${p.stock}` : `Stok habis`}</div>
        <button class="smallbtn" type="button" ${inStock ? "" : "disabled"} data-add="${escapeHtml(p.id)}">
          + Keranjang
        </button>
      </div>
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => addToCart(btn.getAttribute("data-add")));
  });

  el("cartCount") && (el("cartCount").textContent = String(cartCount()));
  el("cartMeta") && (el("cartMeta").textContent = `${cartCount()} item`);
  el("cartTotal") && (el("cartTotal").textContent = rupiah(cartTotal()));

  renderCartItems();
}

/* ===============================
   CART ACTIONS
================================ */
function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  render();
  showToast("✅ Ditambahkan ke keranjang");
}
function decFromCart(id) {
  const cur = state.cart[id] || 0;
  if (cur <= 1) delete state.cart[id];
  else state.cart[id] = cur - 1;
  saveCart();
  render();
}
function removeFromCart(id) {
  delete state.cart[id];
  saveCart();
  render();
}

/* ===============================
   DRAWER
================================ */
function openDrawer() {
  el("drawer")?.classList.remove("hidden");
  el("drawerBackdrop")?.classList.remove("hidden");
  el("drawer")?.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  el("drawer")?.classList.add("hidden");
  el("drawerBackdrop")?.classList.add("hidden");
  el("drawer")?.setAttribute("aria-hidden", "true");
}

/* ===============================
   QRIS MODAL
================================ */
function openQrisModal() {
  el("qrisModal")?.classList.remove("hidden");
  el("qrisModal")?.setAttribute("aria-hidden", "false");
}
function closeQris() {
  el("qrisModal")?.classList.add("hidden");
  el("qrisModal")?.setAttribute("aria-hidden", "true");
}

/* ===============================
   WA MESSAGE
================================ */
function buildOrderLines() {
  const map = new Map(state.products.map((p) => [p.id, p]));
  const lines = [];
  let total = 0;

  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    if (!p) continue;
    const sub = (p.price || 0) * qty;
    total += sub;
    lines.push(`- ${p.name} x${qty} = ${rupiah(sub)}`);
  }
  return { lines, total };
}

function checkoutWA(method = "QRIS", extra = "") {
  const { lines, total } = buildOrderLines();
  if (!lines.length) return alert("Keranjang masih kosong.");

  const orderIdText = state.lastOrder?.orderId ? `\nOrder ID: ${state.lastOrder.orderId}` : "";
  const refText = state.lastOrder?.reference ? `\nReference: ${state.lastOrder.reference}` : "";

  const msg =
    WA_TEXT_PREFIX +
    lines.join("\n") +
    `\n\nTotal: ${rupiah(total)}\nMetode Pembayaran: ${method}${orderIdText}${refText}\n${extra}\n\nNama:\nCatatan:`;

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
}

/* ===============================
   TRIPAY QRIS: CREATE PAYMENT
================================ */
async function openQrisPayment() {
  if (!Object.keys(state.cart).length) return alert("Keranjang masih kosong");

  const orderId = "ORDER-" + Date.now();
  const amount = cartTotal();

  state.lastOrder = { orderId, amount, reference: null };

  el("qrisTotalText") && (el("qrisTotalText").textContent = rupiah(amount));

  const imgEl = document.querySelector(".qris-img img");
  if (imgEl) imgEl.src = ""; // kosongin biar gak nampilin QR lama

  openQrisModal();

  // items untuk Tripay
  const map = new Map(state.products.map((p) => [p.id, p]));
  const items = Object.entries(state.cart).map(([id, qty]) => {
    const p = map.get(id);
    return {
      sku: id,
      name: p?.name || id,
      price: Number(p?.price || 0),
      quantity: Number(qty || 1)
    };
  });

  try {
    const res = await fetch(API_CREATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, amount, items })
    });

    // kalau server balas bukan JSON, tetep kebaca
    const raw = await res.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!res.ok || !data || data.success !== true) {
      console.log("Create QRIS failed:", { status: res.status, raw, data });
      closeQris(); // ✅ biar modal gak “ngunci” layar → keranjang bisa dipencet lagi
      alert("Gagal membuat QRIS. Cek console (Create QRIS failed).");
      return;
    }

    const qrUrl = data?.data?.qr_url || data?.data?.qr_image || data?.data?.qr;
    const reference = data?.data?.reference || data?.data?.ref;

    state.lastOrder.reference = reference || null;

    if (!qrUrl) {
      console.log("No QR url in response:", data);
      closeQris();
      alert("QRIS tidak ditemukan di response. Cek console.");
      return;
    }

    if (imgEl) imgEl.src = qrUrl;

  } catch (err) {
    console.error(err);
    closeQris(); // ✅ jangan biarin modal nutupin layar
    alert("Koneksi ke server gagal. Cek console.");
  }
}

/* ===============================
   INIT
================================ */
async function init() {
  ["search", "onlyInStock", "category", "sort"].forEach((id) => {
    el(id)?.addEventListener("input", render);
    el(id)?.addEventListener("change", render);
  });

  el("openCart")?.addEventListener("click", openDrawer);
  el("closeCart")?.addEventListener("click", closeDrawer);
  el("drawerBackdrop")?.addEventListener("click", closeDrawer);

  el("checkout")?.addEventListener("click", () => checkoutWA("WhatsApp"));
  el("buyNow")?.addEventListener("click", openQrisPayment);

  el("confirmWA")?.addEventListener("click", () => {
    checkoutWA("QRIS", "Saya sudah bayar, mohon dicek ya.");
  });

  el("clearCart")?.addEventListener("click", () => {
    if (confirm("Kosongkan keranjang?")) {
      state.cart = {};
      saveCart();
      render();
    }
  });

  const res = await fetch("products.json", { cache: "no-store" });
  state.products = await res.json();

  buildCategoryOptions();
  render();
}

// pastiin jalan setelah DOM siap
document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    alert("Gagal memuat produk. Cek products.json dan app.js.");
  });
});
