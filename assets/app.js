/* ===============================
   CONFIG
================================ */
const WA_NUMBER = "6289505674504";
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

// ✅ URL CLOUDFARE WORKER (WAJIB INI)
const WORKER_URL = "https://vannnstore-payment.serli3266.workers.dev";

/* ===============================
   STATE
================================ */
const state = {
  products: [],
  cart: loadCart(),
  lastOrder: null // { orderId, amount }
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
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.querySelector(".toast-box").textContent = text;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 1400);
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
    card.innerHTML = `
      <div class="card-img">
        <img src="${escapeHtml(p.image || "assets/images/no-image.png")}">
      </div>
      <div class="name">${escapeHtml(p.name)}</div>
      <p class="price">${rupiah(p.price)}</p>
      <button class="smallbtn" data-add="${p.id}">+ Keranjang</button>
    `;
    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.onclick = () => addToCart(btn.dataset.add);
  });

  el("cartCount").textContent = cartCount();
  el("cartTotal").textContent = rupiah(cartTotal());
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

/* ===============================
   QRIS PAYMENT (FIXED)
================================ */
async function openQrisPayment() {
  if (!Object.keys(state.cart).length) {
    alert("Keranjang kosong");
    return;
  }

  const orderId = "ORDER-" + Date.now();
  const amount = cartTotal();
  state.lastOrder = { orderId, amount };

  el("qrisTotalText").textContent = rupiah(amount);
  el("qrisModal").classList.remove("hidden");

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, amount })
    });

    const data = await res.json();

    if (!data.success || !data.data?.qr_url) {
      alert("Gagal membuat QRIS");
      console.log(data);
      return;
    }

    document.querySelector(".qris-img img").src = data.data.qr_url;

  } catch (err) {
    alert("Gagal koneksi ke server pembayaran");
    console.error(err);
  }
}

/* ===============================
   WHATSAPP
================================ */
function checkoutWA() {
  const lines = [];
  for (const [id, qty] of Object.entries(state.cart)) {
    const p = state.products.find(x => x.id === id);
    if (p) lines.push(`- ${p.name} x${qty} = ${rupiah(p.price * qty)}`);
  }

  const msg =
    WA_TEXT_PREFIX +
    lines.join("\n") +
    `\n\nTotal: ${rupiah(cartTotal())}\nOrder ID: ${state.lastOrder?.orderId || "-"}`;

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`);
}

/* ===============================
   INIT
================================ */
async function init() {
  el("buyNow")?.addEventListener("click", openQrisPayment);
  el("confirmWA")?.addEventListener("click", checkoutWA);

  const res = await fetch("products.json");
  state.products = await res.json();
  render();
}

init();
