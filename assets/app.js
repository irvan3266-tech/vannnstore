/* ===============================
   CONFIG
================================ */
const WA_NUMBER = "6289505674504";
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

// ✅ Google Sheets CSV (pakai gviz). Kalau sheet produk bukan gid=0, ganti gid-nya.
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/12OfXcpE5Me4jRu6_RrYmIL5miG8zykdAUIBH55VVtlk/gviz/tq?tqx=out:csv&gid=0";

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
   CSV PARSER (Google Sheets)
================================ */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

function rowsToProducts(rows) {
  if (!rows || !rows.length) return [];

  const header = rows[0].map((h) => String(h || "").trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  const iId = idx("id");
  const iName = idx("name");
  const iCategory = idx("category");
  const iPrice = idx("price");
  const iUnit = idx("unit");
  const iStock = idx("stock");
  const iImage = idx("image");
  const iBadge = idx("badge");
  const iNotes = idx("notes");

  return rows
    .slice(1)
    .filter((r) => r && r.some((x) => String(x || "").trim() !== ""))
    .map((r) => {
      const notesRaw = (r[iNotes] ?? "").toString().trim();
      const notes = notesRaw
        ? notesRaw.split("||").map((x) => x.trim()).filter(Boolean)
        : [];

      return {
        id: (r[iId] ?? "").toString().trim(),
        name: (r[iName] ?? "").toString().trim(),
        category: (r[iCategory] ?? "").toString().trim(),
        price: Number((r[iPrice] ?? 0).toString().replace(/[^\d]/g, "")) || 0,
        unit: (r[iUnit] ?? "").toString().trim(),
        stock: Number((r[iStock] ?? 0).toString().replace(/[^\d]/g, "")) || 0,
        image: (r[iImage] ?? "").toString().trim(),
        badge: (r[iBadge] ?? "").toString().trim(),
        notes
      };
    })
    .filter((p) => p.id);
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
        <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name || "Produk")}" loading="lazy">
      </div>
      <div class="name">${escapeHtml(p.name || "")}</div>
      <p class="price">${rupiah(p.price)}</p>
      <div class="card-foot">
        <span class="stock">${inStock ? `Stok: ${p.stock}` : "Stok habis"}</span>
        <button class="smallbtn" type="button" ${inStock ? "" : "disabled"} data-add="${escapeHtml(p.id)}">
          + Keranjang
        </button>
      </div>
    `;

    grid.appendChild(card);
  }

  grid.querySelectorAll("[data-add]").forEach((btn) => {
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

  const map = new Map(state.products.map((p) => [p.id, p]));

  if (!Object.keys(state.cart).length) {
    wrap.innerHTML = `<p class="muted">Keranjang kosong</p>`;
    return;
  }

  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    if (!p) continue;

    wrap.innerHTML += `
      <div class="cart-item">
        <b>${escapeHtml(p.name)}</b><br>
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
  const map = new Map(state.products.map((p) => [p.id, p]));
  let lines = [];
  let total = 0;

  for (const [id, qty] of Object.entries(state.cart)) {
    const p = map.get(id);
    if (!p) continue;
    const sub = (p.price || 0) * qty;
    total += sub;
    lines.push(`- ${p.name} x${qty} = ${rupiah(sub)}`);
  }

  const msg =
    WA_TEXT_PREFIX +
    lines.join("\n") +
    `\n\nTotal: ${rupiah(total)}\nPembayaran: QRIS\n\nNama:\nCatatan:`;

  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
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

  // ✅ Load produk dari Google Sheets CSV
  try {
    const csvRes = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);
    state.products = rowsToProducts(rows);

    if (!state.products.length) {
      alert("Produk kosong / gagal terbaca. Pastikan sheet publik (Viewer) & kolom header benar.");
      console.log("CSV RAW:", csvText);
    }

  } catch (e) {
    alert("Gagal mengambil data dari Google Sheets. Pastikan sheet public (Viewer).");
    console.error(e);
  }

  render();
});

// dipakai tombol X modal di HTML kamu
window.closeQris = closeQris;
