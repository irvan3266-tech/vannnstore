/* ===============================
   CONFIG
================================ */
const WA_NUMBER = "6289505674504";
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

// Google Sheets CSV (gid sesuaikan kalau tab produk bukan gid=0)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/12OfXcpE5Me4jRu6_RrYmIL5miG8zykdAUIBH55VVtlk/gviz/tq?tqx=out:csv&gid=0";

/* ===============================
   STATE
================================ */
const state = {
  products: [],
  cart: loadCart() // { [id]: qty }
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

/* image resolver:
   - kalau isinya "gmail.png" => jadi "assets/images/gmail.png"
   - kalau sudah "assets/images/..." biarkan
   - kalau URL https://... biarkan
*/
function resolveImageUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "assets/images/no-image.png";
  if (/^https?:\/\//i.test(s)) return s;

  // normalize backslashes and spaces
  const clean = s.replaceAll("\\", "/").replaceAll(" ", "%20");

  if (clean.startsWith("assets/")) return clean;
  if (clean.startsWith("/assets/")) return clean.slice(1);

  // kalau cuma nama file
  return `assets/images/${clean}`;
}

/* ===============================
   TOAST
   butuh HTML:
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
  setTimeout(() => toast.classList.add("hidden"), 1300);
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
    const img = resolveImageUrl(p.image);

    card.innerHTML = `
      <div class="card-img">
        <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name || "Produk")}" loading="lazy"
             onerror="this.onerror=null;this.src='assets/images/no-image.png';">
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

  const cc = cartCount();
  if (el("cartCount")) el("cartCount").textContent = cc;
  if (el("cartTotal")) el("cartTotal").textContent = rupiah(cartTotal());
  if (el("cartMeta")) el("cartMeta").textContent = `${cc} item`;

  renderCartItems();
}

/* ===============================
   CART ACTIONS
================================ */
function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  render();
  showToast();
}

function incCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  render();
}

function decCart(id) {
  const cur = state.cart[id] || 0;
  if (cur <= 1) delete state.cart[id];
  else state.cart[id] = cur - 1;
  saveCart();
  render();
}

function removeCart(id) {
  delete state.cart[id];
  saveCart();
  render();
}

function clearCart() {
  if (!Object.keys(state.cart).length) return;
  if (!confirm("Kosongkan keranjang?")) return;
  state.cart = {};
  saveCart();
  render();
}

/* ===============================
   CART RENDER (dengan + / - / hapus)
================================ */
function renderCartItems() {
  const wrap = el("cartItems");
  if (!wrap) return;

  wrap.innerHTML = "";

  const map = new Map(state.products.map((p) => [p.id, p]));
  const ids = Object.keys(state.cart);

  if (!ids.length) {
    wrap.innerHTML = `<p class="muted">Keranjang kosong</p>`;
    return;
  }

  for (const id of ids) {
    const p = map.get(id);
    if (!p) continue;

    const qty = state.cart[id];

    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <div class="cart-name">${escapeHtml(p.name)}</div>
      <div class="cart-meta">${rupiah(p.price)} • ${escapeHtml(p.category || "")}</div>

      <div class="qtyrow">
        <div class="qtyctrl">
          <button class="qbtn" type="button" data-dec="${escapeHtml(id)}">−</button>
          <strong>${qty}</strong>
          <button class="qbtn" type="button" data-inc="${escapeHtml(id)}">+</button>
        </div>
        <button class="btn ghost" type="button" data-rm="${escapeHtml(id)}">Hapus</button>
      </div>
    `;
    wrap.appendChild(div);
  }

  wrap.querySelectorAll("[data-inc]").forEach((b) =>
    b.addEventListener("click", () => incCart(b.getAttribute("data-inc")))
  );
  wrap.querySelectorAll("[data-dec]").forEach((b) =>
    b.addEventListener("click", () => decCart(b.getAttribute("data-dec")))
  );
  wrap.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", () => removeCart(b.getAttribute("data-rm")))
  );
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
   QRIS MANUAL
================================ */
function openQris() {
  if (!Object.keys(state.cart).length) {
    alert("Keranjang masih kosong");
    return;
  }
  const t = el("qrisTotalText");
  if (t) t.textContent = rupiah(cartTotal());
  el("qrisModal")?.classList.remove("hidden");
  el("qrisModal")?.setAttribute("aria-hidden", "false");
}
function closeQris() {
  el("qrisModal")?.classList.add("hidden");
  el("qrisModal")?.setAttribute("aria-hidden", "true");
}

/* ===============================
   WHATSAPP
================================ */
function checkoutWA() {
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

  if (!lines.length) {
    alert("Keranjang masih kosong.");
    return;
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
  // drawer
  el("openCart") && (el("openCart").onclick = openDrawer);
  el("closeCart") && (el("closeCart").onclick = closeDrawer);
  el("drawerBackdrop") && (el("drawerBackdrop").onclick = closeDrawer);

  // tombol bawah drawer
  el("buyNow") && (el("buyNow").onclick = openQris);
  el("confirmWA") && (el("confirmWA").onclick = checkoutWA);
  el("checkout") && (el("checkout").onclick = checkoutWA);

  // ✅ tombol "Kosongkan"
  el("clearCart") && (el("clearCart").onclick = clearCart);

  // load products from Sheets
  try {
    const csvRes = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);
    state.products = rowsToProducts(rows);

    if (!state.products.length) {
      alert("Produk kosong / gagal terbaca. Pastikan sheet publik (Viewer) & header kolom benar.");
      console.log("CSV RAW:", csvText);
    }
  } catch (e) {
    alert("Gagal mengambil data dari Google Sheets. Pastikan sheet public (Viewer).");
    console.error(e);
  }

  render();
});

// biar tombol X modal kamu (onclick="closeQris()") tetap jalan
window.closeQris = closeQris;

