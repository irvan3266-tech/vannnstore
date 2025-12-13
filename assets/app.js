const WA_NUMBER = "6289505674504"; 
const WA_TEXT_PREFIX = "Halo admin vannnstore, saya mau order:\n\n";

const state = {
  products: [],
  cart: loadCart(), // { [id]: qty }
};

const el = (id) => document.getElementById(id);

function rupiah(n){
  return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(n);
}

function loadCart(){
  try { return JSON.parse(localStorage.getItem("vannnstore_cart") || "{}"); }
  catch { return {}; }
}
function saveCart(){
  localStorage.setItem("vannnstore_cart", JSON.stringify(state.cart));
}

function cartCount(){
  return Object.values(state.cart).reduce((a,b)=>a+b,0);
}
function cartTotal(){
  const map = new Map(state.products.map(p => [p.id, p]));
  let total = 0;
  for (const [id, qty] of Object.entries(state.cart)){
    const p = map.get(id);
    if (p) total += p.price * qty;
  }
  return total;
}

function filteredProducts(){
  const q = el("search").value.trim().toLowerCase();
  const onlyStock = el("onlyInStock").checked;
  let items = state.products.slice();

  if (q){
    items = items.filter(p =>
      (p.name||"").toLowerCase().includes(q) ||
      (p.category||"").toLowerCase().includes(q)
    );
  }
    const cat = (el("category")?.value || "all").trim();
  if (cat !== "all"){
    items = items.filter(p => normalizeCategory(p.category) === cat);
  }

  if (onlyStock){
    items = items.filter(p => (p.stock ?? 0) > 0);
  }

  const sort = el("sort").value;
  if (sort === "low") items.sort((a,b)=>a.price-b.price);
  else if (sort === "high") items.sort((a,b)=>b.price-a.price);
  else if (sort === "az") items.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  // "popular" biarkan urutan file products.json

  return items;
}

function render(){
  el("year").textContent = new Date().getFullYear();

  const items = filteredProducts();
  const grid = el("grid");
  grid.innerHTML = "";

  if (!items.length){
    el("empty").classList.remove("hidden");
  } else {
    el("empty").classList.add("hidden");
  }

  for (const p of items){
    const card = document.createElement("div");
    card.className = "card";

    const inStock = (p.stock ?? 0) > 0;
    const notes = Array.isArray(p.notes) ? p.notes : [];

    card.innerHTML = `
      <div class="card-top">
        <div class="kat">${escapeHtml(p.category || "Produk")}</div>
        ${p.badge ? `<div class="tag">${escapeHtml(p.badge)}</div>` : ``}
      </div>
      <div class="name">${escapeHtml(p.name || "Tanpa Nama")}</div>
      <p class="price">${rupiah(p.price || 0)}</p>
      <div class="unit">${escapeHtml(p.unit || "")}</div>
      ${notes.length ? `<ul class="notes">${notes.map(n=>`<li>${escapeHtml(n)}</li>`).join("")}</ul>` : ``}
      <div class="card-foot">
        <div class="stock">${inStock ? `Stok: ${p.stock}` : `Stok habis`}</div>
        <button class="smallbtn" ${inStock ? "" : "disabled"} data-add="${p.id}">+ Keranjang</button>
      </div>
    `;

    grid.appendChild(card);
  }

  // bind add-to-cart buttons
  grid.querySelectorAll("[data-add]").forEach(btn=>{
    btn.addEventListener("click", () => addToCart(btn.getAttribute("data-add")));
  });

  // cart UI
  el("cartCount").textContent = cartCount();
  el("cartMeta").textContent = `${cartCount()} item`;
  el("cartTotal").textContent = rupiah(cartTotal());
  renderCartItems();
}

function addToCart(id){
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart();
  render();
}

function decFromCart(id){
  const cur = state.cart[id] || 0;
  if (cur <= 1) delete state.cart[id];
  else state.cart[id] = cur - 1;
  saveCart();
  render();
}

function removeFromCart(id){
  delete state.cart[id];
  saveCart();
  render();
}

function renderCartItems(){
  const wrap = el("cartItems");
  wrap.innerHTML = "";

  const map = new Map(state.products.map(p => [p.id, p]));
  const ids = Object.keys(state.cart);

  if (!ids.length){
    wrap.innerHTML = `<div class="empty"><h3>Keranjang kosong</h3><p>Tambahkan produk dulu ya.</p></div>`;
    return;
  }

  for (const id of ids){
    const p = map.get(id);
    if (!p) continue;

    const qty = state.cart[id];
    const item = document.createElement("div");
    item.className = "cart-item";
    item.innerHTML = `
      <div class="cart-name">${escapeHtml(p.name)}</div>
      <div class="cart-meta">${rupiah(p.price)} • ${escapeHtml(p.category || "")}</div>
      <div class="qtyrow">
        <div class="qtyctrl">
          <button class="qbtn" data-dec="${id}">−</button>
          <strong>${qty}</strong>
          <button class="qbtn" data-inc="${id}">+</button>
        </div>
        <button class="btn ghost" data-rm="${id}">Hapus</button>
      </div>
    `;
    wrap.appendChild(item);
  }

  wrap.querySelectorAll("[data-inc]").forEach(b=>b.addEventListener("click", ()=>addToCart(b.getAttribute("data-inc"))));
  wrap.querySelectorAll("[data-dec]").forEach(b=>b.addEventListener("click", ()=>decFromCart(b.getAttribute("data-dec"))));
  wrap.querySelectorAll("[data-rm]").forEach(b=>b.addEventListener("click", ()=>removeFromCart(b.getAttribute("data-rm"))));
}

function checkoutWA(){
  const map = new Map(state.products.map(p => [p.id, p]));
  const lines = [];
  let total = 0;

  for (const [id, qty] of Object.entries(state.cart)){
    const p = map.get(id);
    if (!p) continue;
    const sub = p.price * qty;
    total += sub;
    lines.push(`- ${p.name} x${qty} = ${rupiah(sub)}`);
  }

  if (!lines.length){
    alert("Keranjang masih kosong.");
    return;
  }

  const msg = WA_TEXT_PREFIX + lines.join("\n") + `\n\nTotal: ${rupiah(total)}\n\nNama:\nMetode pembayaran:\nCatatan:`;
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// Drawer controls
function openDrawer(){
  el("drawer").classList.remove("hidden");
  el("drawerBackdrop").classList.remove("hidden");
  el("drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer(){
  el("drawer").classList.add("hidden");
  el("drawerBackdrop").classList.add("hidden");
  el("drawer").setAttribute("aria-hidden", "true");
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function normalizeCategory(s){
  return String(s || "").trim();
}

function buildCategoryOptions(){
  const sel = el("category");
  if (!sel) return;

  // Ambil kategori unik dari produk
  const cats = Array.from(new Set(
    state.products
      .map(p => normalizeCategory(p.category))
      .filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b));

  // Reset options
  sel.innerHTML = `<option value="all">Semua Kategori</option>` +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

async function init(){
  // events
["search","onlyInStock","category","sort"].forEach(id=>{
  el(id)?.addEventListener("input", render);
  el(id)?.addEventListener("change", render);
});
  
  el("openCart").addEventListener("click", openDrawer);
  el("closeCart").addEventListener("click", closeDrawer);
  el("drawerBackdrop").addEventListener("click", closeDrawer);

  el("checkout").addEventListener("click", checkoutWA);
  el("clearCart").addEventListener("click", ()=>{
    if (confirm("Kosongkan keranjang?")){
      state.cart = {};
      saveCart();
      render();
    }
  });

  // load products
  const res = await fetch("products.json", { cache: "no-store" });
state.products = await res.json();
buildCategoryOptions();
render();


init().catch(err=>{
  console.error(err);
  alert("Gagal memuat produk. Pastikan products.json valid.");
});
