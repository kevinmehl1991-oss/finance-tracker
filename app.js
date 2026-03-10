// ============================================================
// app.js — Finance Tracker
// ============================================================

const state = {
  transactions: [],
  fromCache:    false,
  selectedMonth: "",
  theme:        CONFIG.DEFAULT_THEME,
  chart:        null
};

// ─── Helpers ─────────────────────────────────────────────────
function fmt(amount) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}
function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}
function fmtMonthLabel(yyyyMM) {
  if (!yyyyMM) return "";
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}
function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function getCategoryMeta(id) {
  return CONFIG.CATEGORIES.find(c => c.id === id || c.label === id) || { label: id || "Sonstiges", emoji: "📋" };
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ─── Cache ───────────────────────────────────────────────────
function saveToCache(list) {
  try { localStorage.setItem(CONFIG.CACHE_KEY_TRANSACTIONS, JSON.stringify(list)); } catch (_) {}
}
function loadFromCache() {
  try { const r = localStorage.getItem(CONFIG.CACHE_KEY_TRANSACTIONS); return r ? JSON.parse(r) : null; }
  catch (_) { return null; }
}

// ─── API ─────────────────────────────────────────────────────
async function apiRequest(url, options = {}) {
  const res = await fetch(url, { headers: CONFIG.API_HEADERS, ...options });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();
  if (!text || text.trim() === "") return [];
  return JSON.parse(text);
}
async function loadTransactions() {
  setLoading(true);
  try {
    const data = await apiRequest(CONFIG.API_GET_TRANSACTIONS);
    const list = Array.isArray(data) ? data : (data.transactions || []);
    state.transactions = list;
    state.fromCache = false;
    saveToCache(list);
    showBanner(null);
  } catch (err) {
    console.warn("API unavailable:", err.message);
    const cached = loadFromCache();
    if (cached) {
      state.transactions = cached;
      state.fromCache = true;
      showBanner("⚠️ Offline – Daten aus dem Cache.", "warning");
    } else {
      state.transactions = [];
      // Leere Table ist kein Fehler
      showBanner(null);
    }
  } finally {
    setLoading(false);
    renderAll();
  }
}
async function submitTransaction(payload) {
  if (!navigator.onLine) {
    showBanner("📵 Offline – Speichern nicht möglich.", "error");
    return false;
  }
  try {
    await apiRequest(CONFIG.API_ADD_TRANSACTION, { method: "POST", body: JSON.stringify(payload) });
    await loadTransactions();
    return true;
  } catch (err) {
    showBanner(`❌ Fehler: ${err.message}`, "error");
    return false;
  }
}

// ─── Filtering ───────────────────────────────────────────────
function filteredTransactions() {
  const m = state.selectedMonth;
  return m ? state.transactions.filter(t => (t.date || "").startsWith(m)) : state.transactions;
}

// ─── Render All ──────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderTransactionList();
  renderCategories();
}

// ─── Dashboard ───────────────────────────────────────────────
function renderDashboard() {
  const list    = filteredTransactions();
  const income  = list.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expense;

  document.getElementById("kpi-income").textContent  = fmt(income);
  document.getElementById("kpi-expense").textContent = fmt(expense);
  document.getElementById("kpi-count").textContent   = list.length;

  const balEl = document.getElementById("kpi-balance");
  balEl.textContent = fmt(balance);
  balEl.classList.toggle("positive", balance >= 0);
  balEl.classList.toggle("negative", balance < 0);

  const sub = document.getElementById("dashboard-month-label");
  if (sub) sub.textContent = fmtMonthLabel(state.selectedMonth);

  renderChart(list);
}

function renderChart(list) {
  const canvas  = document.getElementById("chart-canvas");
  const emptyEl = document.getElementById("chart-empty");
  if (!canvas) return;

  const expMap = {};
  list.filter(t => t.type === "expense").forEach(t => {
    const k = t.category || "other";
    expMap[k] = (expMap[k] || 0) + Number(t.amount);
  });

  const labels = Object.keys(expMap);
  const data   = Object.values(expMap);

  if (state.chart) { state.chart.destroy(); state.chart = null; }

  if (!labels.length) {
    canvas.style.display = "none";
    emptyEl.classList.add("visible");
    return;
  }
  canvas.style.display = "block";
  emptyEl.classList.remove("visible");

  // Pastel purple palette for chart segments
  const palette = [
    "#8b6dfe","#ae96ff","#c4b5fd","#a5b4fc","#86efac",
    "#fca5a5","#fcd34d","#93c5fd","#e879f9","#6ee7b7"
  ];

  state.chart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: labels.map(l => { const m = getCategoryMeta(l); return `${m.emoji} ${m.label}`; }),
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 3,
        borderColor: "#0e0f1c",
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#7872a8",
            font: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: "500" },
            padding: 18,
            boxWidth: 11,
            borderRadius: 3,
            useBorderRadius: true
          }
        },
        tooltip: {
          callbacks: { label: ctx => `  ${fmt(ctx.parsed)}` },
          backgroundColor: "#13142a",
          titleColor: "#f0eeff",
          bodyColor: "#c4bef0",
          borderColor: "rgba(139,109,254,0.2)",
          borderWidth: 1,
          padding: 14,
          cornerRadius: 12
        }
      },
      animation: { animateRotate: true, duration: 700 },
      cutout: "68%"
    }
  });
}

// ─── Transaction List ────────────────────────────────────────
function renderTransactionList() {
  const list    = filteredTransactions();
  const emptyEl = document.getElementById("transaction-empty");
  const badge   = document.getElementById("tx-count-badge");

  if (!list.length) {
    emptyEl.style.display = "";
    if (badge) badge.style.display = "none";
    clearTxViews();
    return;
  }
  emptyEl.style.display = "none";
  if (badge) { badge.textContent = `${list.length} Buchung${list.length !== 1 ? "en" : ""}`; badge.style.display = ""; }

  const sorted = [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  renderDesktopTable(sorted);
  renderMobileCards(sorted);
}

function clearTxViews() {
  const tb = document.getElementById("tx-table-body");
  const ml = document.getElementById("tx-mobile-list");
  if (tb) tb.innerHTML = "";
  if (ml) ml.innerHTML = "";
}

function renderDesktopTable(sorted) {
  const tbody = document.getElementById("tx-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  sorted.forEach(t => {
    const meta = getCategoryMeta(t.category || "other");
    const isIncome = t.type === "income";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="tx-date">${fmtDate(t.date)}</td>
      <td>
        <span class="tx-desc-cell">${escHtml(t.description || "—")}</span>
        ${t.note ? `<span class="tx-note-small">${escHtml(t.note)}</span>` : ""}
      </td>
      <td><span class="cat-badge">${meta.emoji} ${escHtml(meta.label)}</span></td>
      <td><span class="badge ${isIncome ? "badge-income" : "badge-expense"}">${isIncome ? "Einnahme" : "Ausgabe"}</span></td>
      <td class="tx-amount-cell ${isIncome ? "income-amt" : "expense-amt"}">
        ${isIncome ? "+" : "−"}${fmt(Math.abs(Number(t.amount)))}
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderMobileCards(sorted) {
  const container = document.getElementById("tx-mobile-list");
  if (!container) return;
  container.innerHTML = "";
  sorted.forEach(t => {
    const meta = getCategoryMeta(t.category || "other");
    const isIncome = t.type === "income";
    const card = document.createElement("div");
    card.className = `tx-mobile-card ${isIncome ? "is-income" : "is-expense"}`;
    card.innerHTML = `
      <div class="tx-cat-icon">${meta.emoji}</div>
      <div class="tx-info-col">
        <div class="tx-mobile-desc">${escHtml(t.description || "—")}</div>
        <div class="tx-mobile-meta">${fmtDate(t.date)} · ${escHtml(meta.label)}${t.note ? ` · <em>${escHtml(t.note)}</em>` : ""}</div>
      </div>
      <div class="tx-mobile-amt ${isIncome ? "income-amt" : "expense-amt"}">
        ${isIncome ? "+" : "−"}${fmt(Math.abs(Number(t.amount)))}
      </div>`;
    container.appendChild(card);
  });
}

// ─── Categories ──────────────────────────────────────────────
function renderCategories() {
  const container = document.getElementById("category-list");
  const emptyEl   = document.getElementById("category-empty");
  container.innerHTML = "";

  const expMap = {};
  filteredTransactions().filter(t => t.type === "expense").forEach(t => {
    const k = t.category || "other";
    expMap[k] = (expMap[k] || 0) + Number(t.amount);
  });

  const entries = Object.entries(expMap).sort((a, b) => b[1] - a[1]);
  if (!entries.length) { emptyEl.style.display = ""; return; }
  emptyEl.style.display = "none";

  const total = entries.reduce((s, [, v]) => s + v, 0);
  entries.forEach(([cat, amount]) => {
    const meta = getCategoryMeta(cat);
    const pct  = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
    const row  = document.createElement("div");
    row.className = "cat-row";
    row.innerHTML = `
      <div class="cat-left">
        <div class="cat-emoji-bubble">${meta.emoji}</div>
        <span class="cat-name">${escHtml(meta.label || cat)}</span>
      </div>
      <div class="cat-right">
        <span class="cat-amount">${fmt(amount)}</span>
        <span class="cat-pct">${pct}%</span>
      </div>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:0%" data-target="${pct}"></div>
      </div>`;
    container.appendChild(row);
  });

  requestAnimationFrame(() => {
    container.querySelectorAll(".cat-bar-fill").forEach(b => { b.style.width = b.dataset.target + "%"; });
  });
}

// ─── Form Validation ─────────────────────────────────────────
const fieldRules = {
  "f-date":     { errId: "err-date",     check: v => v ? null : "Datum ist erforderlich." },
  "f-desc":     { errId: "err-desc",     check: v => v.trim() ? null : "Beschreibung ist erforderlich." },
  "f-amount":   { errId: "err-amount",   check: v => (!isNaN(v) && Number(v) > 0) ? null : "Betrag muss eine positive Zahl sein." },
  "f-category": { errId: "err-category", check: v => v ? null : "Bitte eine Kategorie auswählen." }
};

function validateField(id) {
  const rule = fieldRules[id]; if (!rule) return true;
  const el = document.getElementById(id);
  const errEl = document.getElementById(rule.errId);
  const msg = rule.check(el.value);
  el.classList.toggle("is-error", !!msg);
  errEl.textContent = msg || "";
  errEl.classList.toggle("visible", !!msg);
  return !msg;
}
function validateAll() { return Object.keys(fieldRules).map(validateField).every(Boolean); }
function clearFormErrors() {
  Object.keys(fieldRules).forEach(id => {
    document.getElementById(id)?.classList.remove("is-error");
    const r = fieldRules[id];
    const e = r && document.getElementById(r.errId);
    if (e) { e.textContent = ""; e.classList.remove("visible"); }
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateAll()) return;

  const btn = document.getElementById("form-submit-btn");
  btn.disabled = true;
  btn.classList.add("is-loading");

  const payload = {
    id:          generateId(),
    date:        document.getElementById("f-date").value,
    description: document.getElementById("f-desc").value.trim(),
    amount:      parseFloat(document.getElementById("f-amount").value),
    type:        document.getElementById("f-type").value,
    category:    document.getElementById("f-category").value,
    note:        document.getElementById("f-note").value.trim(),
    createdAt:   new Date().toISOString()
  };

  const ok = await submitTransaction(payload);
  btn.disabled = false;
  btn.classList.remove("is-loading");

  if (ok) {
    document.getElementById("tx-form").reset();
    clearFormErrors();
    setDefaultDate();
    resetTypeToggle();
    showBanner("✅ Transaktion gespeichert.", "success");
    showSection("dashboard");
  }
}

// ─── Type Toggle ─────────────────────────────────────────────
function initTypeToggle() {
  document.getElementById("type-toggle").addEventListener("click", e => {
    const btn = e.target.closest(".type-btn");
    if (!btn) return;
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("f-type").value = btn.dataset.type;
  });
}
function resetTypeToggle() {
  document.querySelectorAll(".type-btn").forEach(b => b.classList.toggle("active", b.dataset.type === "expense"));
  document.getElementById("f-type").value = "expense";
}

// ─── Theme ───────────────────────────────────────────────────
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("icon-sun").style.display  = theme === "dark"  ? "block" : "none";
  document.getElementById("icon-moon").style.display = theme === "light" ? "block" : "none";
  try { localStorage.setItem(CONFIG.CACHE_KEY_THEME, theme); } catch (_) {}
  if (state.chart) renderChart(filteredTransactions());
}

// ─── Navigation ──────────────────────────────────────────────
function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.getElementById(`section-${id}`)?.classList.add("active");
  document.querySelectorAll(".nav-item, .mobile-nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.section === id);
  });
}

// ─── Banner ──────────────────────────────────────────────────
let bannerTimer = null;
function showBanner(msg, type = "info") {
  const el = document.getElementById("banner");
  if (bannerTimer) clearTimeout(bannerTimer);
  if (!msg) { el.style.display = "none"; return; }
  el.textContent = msg;
  el.className = `banner banner-${type}`;
  el.style.display = "block";
  if (type === "success") bannerTimer = setTimeout(() => { el.style.display = "none"; }, 3500);
}

// ─── Online / Offline ────────────────────────────────────────
function updateOnlineStatus() {
  const dot  = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  dot.className    = navigator.onLine ? "status-dot online"  : "status-dot offline";
  text.textContent = navigator.onLine ? "Online" : "Offline";
}

// ─── Month Selector ──────────────────────────────────────────
function initMonthSelector() {
  const sel = document.getElementById("month-select");
  let saved; try { saved = localStorage.getItem(CONFIG.CACHE_KEY_MONTH); } catch (_) {}
  state.selectedMonth = saved || currentMonthStr();
  sel.value = state.selectedMonth;
  sel.addEventListener("change", () => {
    state.selectedMonth = sel.value;
    try { localStorage.setItem(CONFIG.CACHE_KEY_MONTH, sel.value); } catch (_) {}
    renderAll();
  });
}

// ─── Category Select ─────────────────────────────────────────
function populateCategorySelect() {
  const sel = document.getElementById("f-category");
  sel.innerHTML = `<option value="">Kategorie wählen…</option>`;
  CONFIG.CATEGORIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = `${c.emoji} ${c.label}`;
    sel.appendChild(opt);
  });
}

// ─── Misc ────────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById("loading-overlay").style.display = on ? "flex" : "none";
}
function setDefaultDate() {
  const f = document.getElementById("f-date");
  if (f) f.value = new Date().toISOString().split("T")[0];
}

// ─── Login ───────────────────────────────────────────────────
function initLogin() {
  const overlay  = document.getElementById("login-overlay");
  const input    = document.getElementById("login-input");
  const btn      = document.getElementById("login-btn");
  const errEl    = document.getElementById("login-err");

  // Bereits eingeloggt?
  try {
    if (localStorage.getItem(CONFIG.CACHE_KEY_AUTH) === "ok") {
      overlay.classList.add("hidden");
      return;
    }
  } catch (_) {}

  overlay.classList.remove("hidden");

  function tryLogin() {
    if (input.value === CONFIG.APP_PASSWORD) {
      try { localStorage.setItem(CONFIG.CACHE_KEY_AUTH, "ok"); } catch (_) {}
      overlay.classList.add("hidden");
    } else {
      errEl.textContent = "Falsches Passwort. Versuch es nochmal.";
      input.classList.add("shake");
      input.value = "";
      setTimeout(() => input.classList.remove("shake"), 400);
    }
  }

  btn.addEventListener("click", tryLogin);
  input.addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
}

// ─── Init ────────────────────────────────────────────────────
function init() {
  initLogin();

  let saved; try { saved = localStorage.getItem(CONFIG.CACHE_KEY_THEME); } catch (_) {}
  applyTheme(saved || CONFIG.DEFAULT_THEME);

  initMonthSelector();
  setDefaultDate();
  initCatManagement();
  initEditModal();
  loadCategories();
  initTypeToggle();

  updateOnlineStatus();
  window.addEventListener("online",  updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  document.querySelectorAll(".nav-item, .mobile-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });
  document.getElementById("theme-toggle").addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
  });
  document.getElementById("reload-btn").addEventListener("click", loadTransactions);
  document.getElementById("tx-form").addEventListener("submit", handleFormSubmit);

  Object.keys(fieldRules).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("blur", () => validateField(id));
    el.addEventListener("input", () => { if (el.classList.contains("is-error")) validateField(id); });
  });

  document.getElementById("form-reset-btn").addEventListener("click", () => {
    document.getElementById("tx-form").reset();
    clearFormErrors();
    setDefaultDate();
    resetTypeToggle();
  });

  loadTransactions();
  showSection("dashboard");
}

document.addEventListener("DOMContentLoaded", init);


// ─── Kategorie API ───────────────────────────────────────────
async function loadCategories() {
  try {
    const data = await apiRequest(CONFIG.API_GET_CATEGORIES);
    const list = Array.isArray(data) ? data : (data.categories || []);
    if (list.length > 0) {
      CONFIG.CATEGORIES = list.map(c => ({
        id: c.cat_id || c.id,
        label: c.label,
        emoji: c.emoji || "📋"
      }));
    }
  } catch (err) {
    console.warn("Kategorien konnten nicht geladen werden:", err.message);
  }
  populateCategorySelect();
  renderCatManageList();
}

async function apiAddCategory(cat) {
  return apiRequest(CONFIG.API_ADD_CATEGORY, {
    method: "POST",
    body: JSON.stringify({ cat_id: cat.id, label: cat.label, emoji: cat.emoji })
  });
}

async function apiUpdateCategory(cat) {
  return apiRequest(CONFIG.API_UPDATE_CATEGORY, {
    method: "PUT",
    body: JSON.stringify({ cat_id: cat.id, label: cat.label, emoji: cat.emoji })
  });
}

async function apiDeleteCategory(catId) {
  return apiRequest(CONFIG.API_DELETE_CATEGORY + "?cat_id=" + encodeURIComponent(catId), {
    method: "DELETE"
  });
}

// ─── Kategorie Verwaltung UI ─────────────────────────────────
function renderCatManageList() {
  const list = document.getElementById("cat-manage-list");
  if (!list) return;
  list.innerHTML = "";

  CONFIG.CATEGORIES.forEach((cat, idx) => {
    const row = document.createElement("div");
    row.className = "cat-manage-row";
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="cat-manage-emoji">${cat.emoji}</div>
      <div class="cat-manage-name">${escHtml(cat.label)}</div>
      <div class="cat-inline-edit">
        <input type="text" class="form-input cat-emoji-input" value="${cat.emoji}" maxlength="2" data-field="emoji"/>
        <input type="text" class="form-input" value="${escHtml(cat.label)}" placeholder="Name…" data-field="label" style="flex:1;min-width:120px"/>
        <button class="btn btn-primary btn-sm cat-save-btn">✓</button>
        <button class="btn btn-ghost btn-sm cat-cancel-btn">✕</button>
      </div>
      <div class="cat-manage-actions">
        <button class="cat-icon-btn edit-btn" title="Bearbeiten">✏️</button>
        <button class="cat-icon-btn delete" title="Löschen">🗑️</button>
      </div>`;

    row.querySelector(".edit-btn").addEventListener("click", () => {
      row.classList.toggle("is-editing");
    });

    row.querySelector(".cat-cancel-btn").addEventListener("click", () => {
      row.classList.remove("is-editing");
    });

    row.querySelector(".cat-save-btn").addEventListener("click", async () => {
      const newEmoji = row.querySelector("[data-field='emoji']").value.trim() || cat.emoji;
      const newLabel = row.querySelector("[data-field='label']").value.trim();
      if (!newLabel) return;
      const updated = { ...cat, emoji: newEmoji, label: newLabel };
      try {
        await apiUpdateCategory(updated);
        CONFIG.CATEGORIES[idx] = updated;
        populateCategorySelect();
        renderCatManageList();
        renderAll();
        showBanner("✅ Kategorie aktualisiert.", "success");
      } catch (err) {
        showBanner("❌ Fehler beim Speichern: " + err.message, "error");
      }
    });

    row.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm(`Kategorie "${cat.label}" wirklich löschen?`)) return;
      try {
        await apiDeleteCategory(cat.id);
        CONFIG.CATEGORIES.splice(idx, 1);
        populateCategorySelect();
        renderCatManageList();
        renderAll();
        showBanner("✅ Kategorie gelöscht.", "success");
      } catch (err) {
        showBanner("❌ Fehler beim Löschen: " + err.message, "error");
      }
    });

    list.appendChild(row);
  });
}

function initCatManagement() {
  const addBtn     = document.getElementById("cat-add-btn");
  const newForm    = document.getElementById("cat-new-form");
  const saveBtn    = document.getElementById("cat-new-save-btn");
  const cancelBtn  = document.getElementById("cat-new-cancel-btn");
  const emojiInput = document.getElementById("cat-new-emoji");
  const nameInput  = document.getElementById("cat-new-name");
  const errEl      = document.getElementById("cat-new-err");

  addBtn.addEventListener("click", () => {
    newForm.style.display = "block";
    emojiInput.value = "";
    nameInput.value = "";
    errEl.textContent = "";
    nameInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    newForm.style.display = "none";
    errEl.textContent = "";
  });

  saveBtn.addEventListener("click", async () => {
    const emoji = emojiInput.value.trim() || "📋";
    const label = nameInput.value.trim();
    if (!label) { errEl.textContent = "Bitte einen Namen eingeben."; return; }
    const id = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") + "_" + Date.now();
    const newCat = { id, label, emoji };
    try {
      await apiAddCategory(newCat);
      CONFIG.CATEGORIES.push(newCat);
      populateCategorySelect();
      renderCatManageList();
      renderAll();
      newForm.style.display = "none";
      emojiInput.value = "";
      nameInput.value = "";
      errEl.textContent = "";
      showBanner("✅ Kategorie hinzugefügt.", "success");
    } catch (err) {
      errEl.textContent = "Fehler: " + err.message;
    }
  });

  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click(); });
  renderCatManageList();
}

// ─── Transaction Edit / Delete ───────────────────────────────
function openEditModal(tx) {
  const modal = document.getElementById("edit-modal");
  modal.style.display = "flex";

  // Fill fields
  document.getElementById("edit-id").value       = tx.id;
  document.getElementById("edit-amount").value   = tx.amount;
  document.getElementById("edit-desc").value     = tx.description || "";
  document.getElementById("edit-note").value     = tx.note || "";
  document.getElementById("edit-type").value     = tx.type || "expense";

  // Type toggle
  document.querySelectorAll("#edit-type-toggle .type-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.type === tx.type);
  });

  // Category select
  const sel = document.getElementById("edit-category");
  sel.innerHTML = "";
  CONFIG.CATEGORIES.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.emoji + " " + c.label;
    if (c.id === tx.category) opt.selected = true;
    sel.appendChild(opt);
  });
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
}

async function saveEditedTransaction() {
  const btn = document.getElementById("modal-save-btn");
  btn.disabled = true;
  btn.classList.add("is-loading");

  const payload = {
    id:          document.getElementById("edit-id").value,
    description: document.getElementById("edit-desc").value.trim(),
    amount:      parseFloat(document.getElementById("edit-amount").value),
    type:        document.getElementById("edit-type").value,
    category:    document.getElementById("edit-category").value,
    note:        document.getElementById("edit-note").value.trim()
  };

  try {
    await apiRequest(CONFIG.API_UPDATE_TRANSACTION, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    closeEditModal();
    await loadTransactions();
    showBanner("✅ Transaktion aktualisiert.", "success");
  } catch (err) {
    showBanner("❌ Fehler: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}

async function deleteTransaction(id) {
  if (!confirm("Transaktion wirklich löschen?")) return;
  try {
    await apiRequest(CONFIG.API_DELETE_TRANSACTION + "?id=" + encodeURIComponent(id), {
      method: "DELETE"
    });
    closeEditModal();
    await loadTransactions();
    showBanner("✅ Transaktion gelöscht.", "success");
  } catch (err) {
    showBanner("❌ Fehler: " + err.message, "error");
  }
}

function initEditModal() {
  document.getElementById("modal-close-btn").addEventListener("click", closeEditModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeEditModal);
  document.getElementById("edit-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("edit-modal")) closeEditModal();
  });
  document.getElementById("modal-save-btn").addEventListener("click", saveEditedTransaction);
  document.getElementById("modal-delete-btn").addEventListener("click", () => {
    deleteTransaction(document.getElementById("edit-id").value);
  });

  // Type toggle in modal
  document.getElementById("edit-type-toggle").addEventListener("click", e => {
    const btn = e.target.closest(".type-btn");
    if (!btn) return;
    document.querySelectorAll("#edit-type-toggle .type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("edit-type").value = btn.dataset.type;
  });
}
