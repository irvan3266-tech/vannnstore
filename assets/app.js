/* ===============================
   CONFIG
================================ */
const WA_NUMBER = "6289505674504";
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

/* ===============================
   STATE
================================ */
const state = {
  products: [],
  cart: loadCart()
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

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ===============================
   TOAST
================================ */
function showToast(text = "✅ Ditambahkan ke keranjang") {
  const toast = el("toast");
  if (!toast) return;

  toast.querySelector(".toast-box").textContent = text;
  toast.classList.remove("hidden");

  setTimeout(() => toast.classList.add("hidden"), 1300);
}

/* ===============================
   RENDER PRODUK
================================ */
function render() {
  const grid = el("grid");
  if (!grid) return;

  grid.innerHTML = "";

  for (const p of state.products) {
    const card = document.createElement("div");
    card.className = "card";

    const inStock = (p.stock ?? 0) > 0;
    const img = p.image || "assets/images/no-image.png";

    card.innerHTML = `
      <div class="card-img">
        <img src="${escapeHtml(img)}">
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
      <p class="price">${rupiah(p.price)}</p>
      <div class="card-foot">
        <span class="stock">${inStock ? `Stok: ${p.stock}` : "Stok habis"}</span>
        <button class="smallbtn" ${inStock ? "" : "disabled"} data-add="${p.id}">
          + Keranjang
        </button>
      </div>
    `;

    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.onclick = () => addToCart(btn.dataset.add);
  });

  el("cartCount").textContent = cartCount();
  el("cartTotal").textContent = rupiah(cartTotal());
  el("cartMeta").textContent = `${cartCount()} item`;

  renderCartItems();
}

/* ===============================
   CART
================================ */
function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  render();
  showToast();
}

function renderCartItems() {
  const wrap = el("cartItems");
  wrap.innerHTML = "";

  const map = new Map(state.products.map(p => [p.id, p]));

  if (!Object.keys(state.cart).length) {
    wrap.innerHTML = `<p class="muted">Keranjang kosong</p>`;
    return;
  }

  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    if (!p) continue;

    wrap.innerHTML += `
      <div class="cart-item">
        <b>${p.name}</b><br>
        ${rupiah(p.price)} x ${qty}
      </div>
    `;
  }
}

/* ===============================
   DRAWER
================================ */
function openDrawer() {
  el("drawer").classList.remove("hidden");
  el("drawerBackdrop").classList.remove("hidden");
}
function closeDrawer() {
  el("drawer").classList.add("hidden");
  el("drawerBackdrop").classList.add("hidden");
}

/* ===============================
   QRIS MANUAL
================================ */
function openQris() {
  if (!Object.keys(state.cart).length) {
    alert("Keranjang masih kosong");
    return;
  }
  el("qrisTotalText").textContent = rupiah(cartTotal());
  el("qrisModal").classList.remove("hidden");
}

function closeQris() {
  el("qrisModal").classList.add("hidden");
}

/* ===============================
   WHATSAPP
================================ */
function checkoutWA() {
  const map = new Map(state.products.map(p => [p.id, p]));
  let lines = [];
  let total = 0;

  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    const sub = p.price * qty;
    total += sub;
    lines.push(`- ${p.name} x${qty} = ${rupiah(sub)}`);
  }

  const msg =
    WA_TEXT_PREFIX +
    lines.join("\n") +
    `\n\nTotal: ${rupiah(total)}\nPembayaran: QRIS\n\nNama:\nCatatan:`;

  window.open(
    `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  el("openCart").onclick = openDrawer;
  el("closeCart").onclick = closeDrawer;
  el("drawerBackdrop").onclick = closeDrawer;

  el("buyNow").onclick = openQris;
  el("confirmWA").onclick = checkoutWA;
  el("checkout").onclick = checkoutWA;

  const res = await fetch("products.json");
  state.products = await res.json();

  render();
});
