import { createClient } from "@supabase/supabase-js";

const KEY = "bns-inventory-v1";
const IMPORTED = "bns-imported-v1";
const TABLES = ["items", "movements", "expenses", "upcoming", "investors"];

const REMEMBER = "bns-remember";

const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const secretKey = supabaseKey.startsWith("sb_secret_");

function remembered() {
  return localStorage.getItem(REMEMBER) !== "0";
}

const authStorage = {
  getItem(key) {
    return (remembered() ? localStorage : sessionStorage).getItem(key);
  },
  setItem(key, value) {
    const keep = remembered() ? localStorage : sessionStorage;
    const drop = remembered() ? sessionStorage : localStorage;
    drop.removeItem(key);
    keep.setItem(key, value);
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

const supabase = supabaseUrl && supabaseKey && !secretKey
  ? createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage,
    },
  })
  : null;

const $ = (sel) => document.querySelector(sel);

const moneyFmt = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const dateFmt = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" });

const pesos = (amount) => Math.round(amount * 100);

function money(cents) {
  return moneyFmt.format((Number(cents) || 0) / 100);
}

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function int(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function uid() {
  return crypto.randomUUID();
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function marginPct(cost, price) {
  if (!price) return null;
  return Math.round(((price - cost) / price) * 100);
}

function statusOf(item) {
  if (item.quantity <= 0) return "out";
  if (item.reorderAt > 0 && item.quantity <= item.reorderAt) return "low";
  return "ok";
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return dateFmt.format(date);
}

function formatDay(day) {
  if (!day) return "";
  return formatWhen(`${day}T12:00:00.000Z`);
}

function dayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function todayKey() {
  return dayKey(new Date());
}

function needsReprice(item) {
  return item.quantity > 0 && item.price <= item.cost;
}

function daysUntil(day) {
  if (!day) return Number.NaN;
  const due = new Date(`${day}T12:00:00`);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((due - now) / 86400000);
}

function dueFlag(day) {
  const days = daysUntil(day);
  if (!Number.isFinite(days)) return "";
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days <= 14) return "Soon";
  return "";
}

function inThisMonth(day) {
  if (!day) return false;
  const now = new Date();
  const [year, month] = day.split("-").map(Number);
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function sumAmount(rows) {
  return rows.reduce((sum, row) => sum + (row.amount || 0), 0);
}

function textMatch(query, ...parts) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.join(" ").toLowerCase().includes(needle);
}

const TABS = ["dashboard", "inventory", "sales", "expenses", "upcoming", "investors"];

const TAB_TITLES = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  sales: "Sell log",
  expenses: "Expenses",
  upcoming: "Upcoming expenses",
  investors: "Investors",
};

const TAB_ACTIONS = {
  inventory: "Add item",
  expenses: "Add expense",
  upcoming: "Add upcoming",
  investors: "Add investor",
};

const RECORD = {
  expense: {
    eyebrow: "Expense",
    create: "New expense",
    edit: "Edit expense",
    amount: "Amount",
    date: "Paid on",
    category: true,
    share: false,
    save: "Save expense",
    list: "expenses",
  },
  upcoming: {
    eyebrow: "Upcoming",
    create: "New upcoming expense",
    edit: "Edit upcoming expense",
    amount: "Amount",
    date: "Due on",
    category: true,
    share: false,
    save: "Save upcoming",
    list: "upcoming",
  },
  investor: {
    eyebrow: "Investor",
    create: "New investor",
    edit: "Edit investor",
    amount: "Invested",
    date: "Since",
    category: false,
    share: true,
    save: "Save investor",
    list: "investors",
  },
};

function seed() {
  const items = [
    { id: "desk", name: "Oak writing desk", category: "Furniture", quantity: 2, cost: pesos(180), price: pesos(340), reorderAt: 1, notes: "Refinished top. Left drawer sticks." },
    { id: "candles", name: "Brass candlesticks, pair", category: "Home", quantity: 3, cost: pesos(22), price: pesos(58), reorderAt: 1, notes: "" },
    { id: "coat", name: "Wool overcoat, charcoal", category: "Apparel", quantity: 4, cost: pesos(45), price: pesos(120), reorderAt: 2, notes: "" },
    { id: "lamp", name: "Ceramic table lamp", category: "Home", quantity: 0, cost: pesos(28), price: pesos(75), reorderAt: 1, notes: "Last one sold. Buy again if the glaze matches." },
    { id: "throw", name: "Linen throw, oat", category: "Textiles", quantity: 5, cost: pesos(18), price: pesos(42), reorderAt: 6, notes: "" },
    { id: "sideboard", name: "Mid-century sideboard", category: "Furniture", quantity: 1, cost: pesos(310), price: pesos(540), reorderAt: 0, notes: "" },
    { id: "binoculars", name: "Field binoculars", category: "Sporting", quantity: 2, cost: pesos(60), price: pesos(115), reorderAt: 2, notes: "" },
  ];

  const buy = (id, itemId, itemName, quantity, unitCost, at) => ({
    id, type: "buy", itemId, itemName, quantity, unitCost, unitPrice: null, profit: null, at,
  });
  const sell = (id, itemId, itemName, quantity, unitCost, unitPrice, at, terms) => ({
    id, type: "sell", itemId, itemName, quantity, unitCost, unitPrice, profit: (unitPrice - unitCost) * quantity, at,
    ...(terms ? { terms } : {}),
  });

  const movements = [
    buy("m1", "desk", "Oak writing desk", 3, pesos(180), "2026-10-12T12:00:00.000Z"),
    buy("m2", "binoculars", "Field binoculars", 3, pesos(60), "2026-10-14T12:00:00.000Z"),
    buy("m3", "lamp", "Ceramic table lamp", 1, pesos(28), "2026-10-16T12:00:00.000Z"),
    buy("m4", "coat", "Wool overcoat, charcoal", 5, pesos(45), "2026-10-18T12:00:00.000Z"),
    buy("m5", "throw", "Linen throw, oat", 5, pesos(18), "2026-10-20T12:00:00.000Z"),
    buy("m6", "candles", "Brass candlesticks, pair", 3, pesos(22), "2026-10-22T12:00:00.000Z"),
    buy("m7", "sideboard", "Mid-century sideboard", 1, pesos(310), "2026-10-24T12:00:00.000Z"),
    sell("m8", "coat", "Wool overcoat, charcoal", 1, pesos(45), pesos(120), "2026-10-28T12:00:00.000Z"),
    sell("m9", "desk", "Oak writing desk", 1, pesos(180), pesos(340), "2026-10-30T12:00:00.000Z"),
    sell("m10", "lamp", "Ceramic table lamp", 1, pesos(28), pesos(75), "2026-11-02T12:00:00.000Z"),
    sell("m11", "binoculars", "Field binoculars", 1, pesos(60), pesos(115), "2026-11-05T12:00:00.000Z", "cod"),
  ];

  const expenses = [
    { id: "e1", name: "Market booth", category: "Selling", amount: pesos(45), date: "2026-10-18", notes: "Sunday square." },
    { id: "e2", name: "Shipping labels", category: "Fulfillment", amount: pesos(22.4), date: "2026-10-26", notes: "" },
    { id: "e3", name: "Packing paper", category: "Supplies", amount: pesos(16), date: "2026-11-01", notes: "" },
  ];

  const upcoming = [
    { id: "u1", name: "Storage unit", category: "Rent", amount: pesos(120), date: "2026-11-15", notes: "Month to month." },
    { id: "u2", name: "Liability insurance", category: "Insurance", amount: pesos(86), date: "2026-12-01", notes: "" },
    { id: "u3", name: "Domain renewal", category: "Admin", amount: pesos(18), date: "2027-01-12", notes: "" },
  ];

  const investors = [
    { id: "i1", name: "Mara Ellison", amount: pesos(2000), share: 40, date: "2026-06-01", notes: "Silent partner." },
    { id: "i2", name: "Jonah Peck", amount: pesos(1500), share: 25, date: "2026-08-12", notes: "" },
  ];

  return { items, movements, expenses, upcoming, investors };
}

function mapExpense(raw) {
  if (!raw || raw.id == null || !raw.name) return null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: String(raw.category || "General"),
    amount: Math.max(0, Math.round(Number(raw.amount) || 0)),
    date: String(raw.date || "").slice(0, 10),
    notes: String(raw.notes || ""),
  };
}

function mapInvestor(raw) {
  if (!raw || raw.id == null || !raw.name) return null;
  let share = null;
  if (raw.share != null && raw.share !== "") {
    const parsed = Number(raw.share);
    if (Number.isFinite(parsed)) share = Math.min(100, Math.max(0, Math.round(parsed * 10) / 10));
  }
  return {
    id: String(raw.id),
    name: String(raw.name),
    amount: Math.max(0, Math.round(Number(raw.amount) || 0)),
    share,
    date: String(raw.date || "").slice(0, 10),
    notes: String(raw.notes || ""),
  };
}

function normalize(data) {
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.movements)) return null;

  const items = [];
  for (const raw of data.items) {
    if (!raw || raw.id == null || !raw.name) continue;
    items.push({
      id: String(raw.id),
      name: String(raw.name),
      category: String(raw.category || "General"),
      quantity: Math.max(0, int(raw.quantity)),
      cost: Math.max(0, Math.round(Number(raw.cost) || 0)),
      price: Math.max(0, Math.round(Number(raw.price) || 0)),
      reorderAt: Math.max(0, int(raw.reorderAt)),
      notes: String(raw.notes || ""),
    });
  }

  const movements = [];
  for (const raw of data.movements) {
    if (!raw || !raw.itemName) continue;
    if (raw.type !== "buy" && raw.type !== "sell" && raw.type !== "recount") continue;
    movements.push({
      id: String(raw.id || uid()),
      type: raw.type,
      itemId: String(raw.itemId || ""),
      itemName: String(raw.itemName),
      quantity: Math.max(0, int(raw.quantity)),
      unitCost: raw.unitCost == null ? null : Math.round(Number(raw.unitCost) || 0),
      unitPrice: raw.unitPrice == null ? null : Math.round(Number(raw.unitPrice) || 0),
      profit: raw.profit == null ? null : Math.round(Number(raw.profit) || 0),
      at: String(raw.at || ""),
      ...(raw.type === "sell" && (raw.terms === "cop" || raw.terms === "cod") ? { terms: raw.terms } : {}),
    });
  }

  return {
    items,
    movements,
    expenses: Array.isArray(data.expenses) ? data.expenses.map(mapExpense).filter(Boolean) : null,
    upcoming: Array.isArray(data.upcoming) ? data.upcoming.map(mapExpense).filter(Boolean) : null,
    investors: Array.isArray(data.investors) ? data.investors.map(mapInvestor).filter(Boolean) : null,
  };
}

function emptyLedger() {
  return { items: [], movements: [], expenses: [], upcoming: [], investors: [] };
}

function ledgerSignature(ledger) {
  return JSON.stringify({
    items: ledger.items,
    movements: ledger.movements,
    expenses: ledger.expenses || [],
    upcoming: ledger.upcoming || [],
    investors: ledger.investors || [],
  });
}

function readLocalLedger() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const normalized = normalize(JSON.parse(raw));
    if (!normalized) return null;
    for (const key of ["expenses", "upcoming", "investors"]) {
      if (normalized[key] == null) normalized[key] = [];
    }
    return normalized;
  } catch (_) {
    return null;
  }
}

function ledgerIsEmpty(ledger) {
  return TABLES.every((table) => ledger[table].length === 0);
}

function itemRow(item, userId) {
  return {
    user_id: userId,
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    cost: item.cost,
    price: item.price,
    reorder_at: item.reorderAt,
    notes: item.notes,
  };
}

function movementRow(movement, userId) {
  return {
    user_id: userId,
    id: movement.id,
    type: movement.type,
    item_id: movement.itemId || "",
    item_name: movement.itemName,
    quantity: movement.quantity,
    unit_cost: movement.unitCost,
    unit_price: movement.unitPrice,
    profit: movement.profit,
    terms: movement.terms === "cop" || movement.terms === "cod" ? movement.terms : null,
    at: movement.at || new Date().toISOString(),
  };
}

function storedExpense(row, userId) {
  return {
    user_id: userId,
    id: row.id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    date: row.date || null,
    notes: row.notes,
  };
}

function investorRow(row, userId) {
  return {
    user_id: userId,
    id: row.id,
    name: row.name,
    amount: row.amount,
    share: row.share,
    date: row.date || null,
    notes: row.notes,
  };
}

function rowsFor(table, ledger, userId) {
  if (table === "items") return ledger.items.map((item) => itemRow(item, userId));
  if (table === "movements") return ledger.movements.map((movement) => movementRow(movement, userId));
  if (table === "investors") return ledger.investors.map((row) => investorRow(row, userId));
  return ledger[table].map((row) => storedExpense(row, userId));
}

function fromRemote(table, rows) {
  if (table === "items") {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity,
      cost: row.cost,
      price: row.price,
      reorderAt: row.reorder_at,
      notes: row.notes,
    }));
  }
  if (table === "movements") {
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      itemId: row.item_id,
      itemName: row.item_name,
      quantity: row.quantity,
      unitCost: row.unit_cost,
      unitPrice: row.unit_price,
      profit: row.profit,
      terms: row.terms,
      at: row.at,
    }));
  }
  if (table === "investors") {
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      share: row.share,
      date: row.date || "",
      notes: row.notes,
    }));
  }
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    date: row.date || "",
    notes: row.notes,
  }));
}

function currentTab() {
  const id = location.hash.slice(1);
  return TABS.includes(id) ? id : "dashboard";
}

let state = emptyLedger();
let userId = null;
let loadToken = 0;
let authMode = "sign-in";
let saving = false;
let dirty = false;
let saveDone = Promise.resolve();
const ui = { query: "", filter: "all", sort: "name", dir: "asc", flashId: null, tab: currentTab() };
let editingId = null;
let tradeId = null;
let removeArmed = false;
let recordKind = "expense";
let recordId = null;
let recordRemoveArmed = false;
let toastTimer = 0;
let flashTimer = 0;
let lastFocus = null;

async function replaceTable(id, table, rows) {
  let query = supabase.from(table).select("id").eq("user_id", id);
  const existing = await query;
  if (existing.error) return existing.error;
  if (rows.length) {
    const written = await supabase.from(table).upsert(rows, { onConflict: "user_id,id" });
    if (written.error) return written.error;
  }
  const keep = new Set(rows.map((row) => row.id));
  const stale = (existing.data || []).map((row) => row.id).filter((rowId) => !keep.has(rowId));
  if (!stale.length) return null;
  const removed = await supabase.from(table).delete().eq("user_id", id).in("id", stale);
  return removed.error;
}

async function writeLedger(id, ledger) {
  const errors = await Promise.all(TABLES.map((table) => replaceTable(id, table, rowsFor(table, ledger, id))));
  return errors.find(Boolean) || null;
}

function save() {
  if (!userId) return false;
  dirty = true;
  if (!saving) {
    saving = true;
    saveDone = flush();
  }
  return true;
}

async function flush() {
  try {
    while (dirty && userId) {
      dirty = false;
      const id = userId;
      const snapshot = structuredClone(state);
      const error = await writeLedger(id, snapshot);
      if (error) {
        notify(`Could not save. ${error.message}`);
        break;
      }
    }
  } finally {
    saving = false;
    if (dirty && userId) {
      saving = true;
      saveDone = flush();
    }
  }
}

async function fetchLedger(id) {
  const results = await Promise.all(TABLES.map((table) => {
    let query = supabase.from(table).select("*").eq("user_id", id);
    if (table === "movements") query = query.order("at", { ascending: true });
    return query;
  }));
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(failed.error.message);
  const data = {};
  TABLES.forEach((table, index) => {
    data[table] = fromRemote(table, results[index].data || []);
  });
  const normalized = normalize(data);
  if (!normalized) throw new Error("Could not read the ledger.");
  for (const key of ["expenses", "upcoming", "investors"]) {
    if (normalized[key] == null) normalized[key] = [];
  }
  return normalized;
}

async function maybeImportLocal(id, remote) {
  if (localStorage.getItem(IMPORTED)) return remote;
  if (!ledgerIsEmpty(remote)) {
    localStorage.setItem(IMPORTED, "1");
    return remote;
  }
  const local = readLocalLedger();
  const sample = normalize(seed());
  for (const key of ["expenses", "upcoming", "investors"]) {
    if (sample[key] == null) sample[key] = [];
  }
  if (!local || ledgerSignature(local) === ledgerSignature(sample)) {
    localStorage.setItem(IMPORTED, "1");
    return remote;
  }
  const error = await writeLedger(id, local);
  if (error) throw new Error(error.message);
  localStorage.setItem(IMPORTED, "1");
  localStorage.removeItem(KEY);
  return local;
}

function showSetup() {
  $("#boot").hidden = true;
  $("#auth").hidden = false;
  $("#authForm").hidden = true;
  $("#authSwitch").hidden = true;
  $("#authHeading").textContent = "Connect Supabase";
  $("#authMessage").textContent = secretKey
    ? "Use the publishable key from Supabase, not the secret key. Put it in VITE_SUPABASE_ANON_KEY on Vercel, then redeploy."
    : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel, then redeploy. Locally, put them in .env and restart.";
}

function showAuth() {
  loadToken += 1;
  userId = null;
  $("#boot").hidden = true;
  $("#auth").hidden = false;
  $("#app").hidden = true;
  $("#authForm").remember.checked = remembered();
}

function setAuthMode(mode) {
  authMode = mode;
  const signIn = mode === "sign-in";
  $("#authHeading").textContent = signIn ? "Sign in" : "Create an account";
  $("#authSubmit").textContent = signIn ? "Sign in" : "Create account";
  $("#authSwitch").textContent = signIn ? "Create an account" : "Already have an account? Sign in";
  $("#authMessage").textContent = "";
  $("#authForm").password.autocomplete = signIn ? "current-password" : "new-password";
}

function showApp() {
  $("#boot").hidden = true;
  $("#auth").hidden = true;
  $("#app").hidden = false;
}

async function openLedger(session) {
  const token = ++loadToken;
  const id = session.user.id;
  if (id === userId) {
    showApp();
    return;
  }
  $("#boot").hidden = false;
  $("#auth").hidden = true;
  $("#app").hidden = true;
  try {
    let ledger = await fetchLedger(id);
    if (token !== loadToken) return;
    ledger = await maybeImportLocal(id, ledger);
    if (token !== loadToken) return;
    userId = id;
    state = ledger;
    showApp();
    render();
  } catch (error) {
    if (token !== loadToken) return;
    showAuth();
    $("#authMessage").textContent = error.message || "Could not load the ledger.";
  }
}

function boot() {
  if (!supabase) {
    showSetup();
    return;
  }
  showAuth();
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) openLedger(session);
    else showAuth();
  });
}

function itemById(id) {
  return state.items.find((item) => item.id === id) || null;
}

function pushMovement(movement) {
  state.movements.push({ id: uid(), at: new Date().toISOString(), ...movement });
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.textContent = "";
  }, 3600);
}

function flash(id) {
  ui.flashId = id;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    ui.flashId = null;
    const row = document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (row) row.classList.remove("flash");
  }, 1200);
}

function rememberFocus() {
  lastFocus = document.activeElement;
}

function restoreFocus() {
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
}

function stats() {
  let quantity = 0;
  let cost = 0;
  let list = 0;
  for (const item of state.items) {
    quantity += item.quantity;
    cost += item.quantity * item.cost;
    list += item.quantity * item.price;
  }
  const profit = state.movements.reduce((sum, movement) => {
    return sum + (movement.type === "sell" ? movement.profit || 0 : 0);
  }, 0);
  return { quantity, cost, list, profit };
}

function matchesQuery(item) {
  const query = ui.query.trim().toLowerCase();
  if (!query) return true;
  return `${item.name} ${item.category} ${item.notes}`.toLowerCase().includes(query);
}

function visibleItems() {
  const items = state.items.filter((item) => {
    if (!matchesQuery(item)) return false;
    const status = statusOf(item);
    if (ui.filter === "stocked") return status !== "out";
    if (ui.filter === "low") return status === "low";
    if (ui.filter === "out") return status === "out";
    return true;
  });

  const dir = ui.dir === "asc" ? 1 : -1;
  items.sort((a, b) => {
    let cmp = 0;
    if (ui.sort === "name") cmp = a.name.localeCompare(b.name);
    else if (ui.sort === "quantity") cmp = a.quantity - b.quantity;
    else if (ui.sort === "cost") cmp = a.cost - b.cost;
    else if (ui.sort === "price") cmp = a.price - b.price;
    else if (ui.sort === "margin") {
      cmp = (marginPct(a.cost, a.price) ?? -9999) - (marginPct(b.cost, b.price) ?? -9999);
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return cmp * dir;
  });
  return items;
}

function rowHTML(item) {
  const status = statusOf(item);
  const pct = marginPct(item.cost, item.price);
  const margin = pct === null ? "—" : `${pct}%`;
  const flag = status === "low"
    ? '<span class="flag">Low</span>'
    : status === "out"
      ? '<span class="flag out">Out</span>'
      : "";
  const classes = [
    status === "ok" ? "" : `is-${status}`,
    ui.flashId === item.id ? "flash" : "",
  ].filter(Boolean).join(" ");
  const id = esc(item.id);
  const name = esc(item.name);

  return `<tr data-id="${id}" class="${classes}">
    <td class="item" data-label="">
      <button type="button" class="item-name" data-action="edit" data-id="${id}">${name}</button>
      <span class="category">${esc(item.category)}</span>
    </td>
    <td class="num" data-label="On hand"><span class="qty-wrap">${item.quantity}${flag}</span></td>
    <td class="num" data-label="Cost">${money(item.cost)}</td>
    <td class="num" data-label="List">${money(item.price)}</td>
    <td class="num${pct !== null && pct < 0 ? " neg" : ""}" data-label="Margin">${margin}</td>
    <td class="actions" data-label="">
      <button type="button" class="texty" data-action="sell" data-id="${id}" ${item.quantity < 1 ? "disabled" : ""} aria-label="Sell ${name}">Sell</button>
      <span class="dot" aria-hidden="true">·</span>
      <button type="button" class="texty" data-action="restock" data-id="${id}" aria-label="Restock ${name}">Restock</button>
      <span class="dot" aria-hidden="true">·</span>
      <button type="button" class="texty" data-action="edit" data-id="${id}" aria-label="Edit ${name}">Edit</button>
    </td>
  </tr>`;
}

function renderStats() {
  const summary = stats();
  const projected = summary.list - summary.cost;
  $("#stat-qty").textContent = String(summary.quantity);
  $("#stat-cost").textContent = money(summary.cost);
  const profitEl = $("#stat-profit");
  profitEl.textContent = money(projected);
  profitEl.classList.toggle("neg", projected < 0);
  $("#stat-reprice").textContent = String(state.items.filter(needsReprice).length);
}

function renderFilters() {
  const matched = state.items.filter(matchesQuery);
  const counts = { all: matched.length, stocked: 0, low: 0, out: 0 };
  for (const item of matched) {
    const status = statusOf(item);
    if (status === "out") counts.out += 1;
    else counts.stocked += 1;
    if (status === "low") counts.low += 1;
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === ui.filter));
  });
  document.querySelectorAll("[data-count]").forEach((span) => {
    span.textContent = String(counts[span.dataset.count] ?? 0);
  });
}

function renderSort() {
  document.querySelectorAll("thead th").forEach((th) => {
    const key = th.querySelector("[data-sort]")?.dataset.sort;
    if (!key) return;
    const active = key === ui.sort;
    th.setAttribute("aria-sort", active ? (ui.dir === "asc" ? "ascending" : "descending") : "none");
  });
}

function renderRows() {
  const items = visibleItems();
  const tbody = $("#rows");
  if (items.length === 0) {
    const message = state.items.length === 0
      ? "No items yet. Add the first piece you buy."
      : "Nothing in this view.";
    tbody.innerHTML = `<tr><td class="empty" colspan="6">${message}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(rowHTML).join("");
}

function movementText(movement) {
  const each = movement.quantity > 1 ? " each" : "";
  if (movement.type === "sell") {
    const pending = isPending(movement) ? ` · ${movement.terms.toUpperCase()} pending` : "";
    return `Sold ${movement.quantity} × ${movement.itemName} at ${money(movement.unitPrice)} · profit ${money(movement.profit)}${pending}`;
  }
  if (movement.type === "buy") {
    return `Bought ${movement.quantity} × ${movement.itemName} at ${money(movement.unitCost)}${each}`;
  }
  return `Recounted ${movement.itemName} to ${movement.quantity}`;
}

function renderMovements() {
  const changes = state.movements.filter((movement) => movement.type !== "sell");
  const latest = changes.slice(-8).reverse();
  $("#moveHeading").textContent = changes.length > 8 ? "Latest stock changes" : "Stock changes";
  const list = $("#movementList");
  list.replaceChildren();

  if (latest.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "Purchases and recounts will be listed here.";
    list.append(item);
    return;
  }

  for (const movement of latest) {
    const item = document.createElement("li");
    const text = document.createElement("p");
    text.textContent = movementText(movement);
    const time = document.createElement("time");
    time.dateTime = movement.at;
    time.textContent = formatWhen(movement.at);
    item.append(text, time);
    list.append(item);
  }
}

function renderChrome() {
  const title = TAB_TITLES[ui.tab] || "Dashboard";
  $("#pageTitle").textContent = title;
  document.title = `BNS · ${title}`;
  const action = TAB_ACTIONS[ui.tab];
  const button = $("#addBtn");
  button.hidden = !action;
  if (action) button.textContent = action;

  for (const id of TABS) {
    $(`#panel-${id}`).hidden = id !== ui.tab;
    $(`#tab-${id}`).setAttribute("aria-selected", String(id === ui.tab));
  }
}

function salesList() {
  return state.movements.filter((movement) => movement.type === "sell");
}

function isPending(sale) {
  return sale.terms === "cop" || sale.terms === "cod";
}

function saleTotal(sale) {
  return (sale.unitPrice || 0) * sale.quantity;
}

function salesTotals(list) {
  return list.reduce((totals, sale) => {
    totals.revenue += saleTotal(sale);
    totals.profit += sale.profit || 0;
    totals.count += 1;
    return totals;
  }, { revenue: 0, profit: 0, count: 0 });
}

function purchaseSpend() {
  return state.movements.reduce((sum, movement) => {
    if (movement.type !== "buy") return sum;
    return sum + (movement.unitCost || 0) * movement.quantity;
  }, 0);
}

function fillTable(tbody, rows, colspan, message, renderRow) {
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(renderRow).join("");
}

function renderLineList(list, rows, emptyText) {
  list.replaceChildren();
  if (rows.length === 0) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = emptyText;
    list.append(item);
    return;
  }
  for (const row of rows) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "line-btn";
    button.dataset.goto = row.tab;
    button.textContent = row.text;
    item.append(button);
    if (row.aside) {
      const aside = document.createElement("span");
      aside.className = "aside";
      aside.textContent = row.aside;
      item.append(aside);
    }
    list.append(item);
  }
}

function renderDashboard() {
  const summary = stats();
  const sales = salesList();
  const collected = salesTotals(sales.filter((sale) => !isPending(sale)));
  const pending = sales.filter(isPending).reduce((sum, sale) => sum + saleTotal(sale), 0);
  const funds = sumAmount(state.investors) + collected.revenue - purchaseSpend() - sumAmount(state.expenses);
  const reprice = state.items.filter(needsReprice);

  const fundsEl = $("#dash-funds");
  fundsEl.textContent = money(funds);
  fundsEl.classList.toggle("neg", funds < 0);
  $("#dash-pending").textContent = money(pending);
  $("#dash-upcoming").textContent = money(sumAmount(state.upcoming));
  $("#dash-reprice").textContent = String(reprice.length);
  $("#dashStock").textContent = `${summary.quantity} on hand · ${money(summary.cost)} total cost`;

  const attention = [];
  for (const item of state.items) {
    if (needsReprice(item)) attention.push({ text: `${item.name} lists at or below cost`, tab: "inventory" });
    const status = statusOf(item);
    if (status === "low") attention.push({ text: `${item.name} is low · ${item.quantity} on hand`, tab: "inventory" });
    if (status === "out") attention.push({ text: `${item.name} is out of stock`, tab: "inventory" });
  }
  for (const sale of [...sales].reverse()) {
    if (!isPending(sale)) continue;
    attention.push({
      text: `${sale.itemName} · ${money(saleTotal(sale))} · ${sale.terms.toUpperCase()}`,
      tab: "sales",
    });
  }
  const bills = [...state.upcoming].sort((a, b) => a.date.localeCompare(b.date));
  for (const bill of bills) {
    const days = daysUntil(bill.date);
    if (days > 14) continue;
    const when = days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "due today" : `due in ${days} days`;
    attention.push({ text: `${bill.name} · ${money(bill.amount)} · ${when}`, tab: "upcoming" });
  }
  renderLineList($("#dashAttention"), attention, "Nothing needs attention.");

  const recent = salesList().slice(-4).reverse().map((sale) => ({
    text: `Sold ${sale.quantity} × ${sale.itemName}${isPending(sale) ? ` · ${sale.terms.toUpperCase()}` : ""}`,
    aside: money(sale.profit || 0),
    tab: "sales",
  }));
  renderLineList($("#dashSales"), recent, "No sales yet.");
}

function renderSales() {
  const query = $("#saleSearch").value;
  const matched = salesList()
    .filter((sale) => textMatch(query, sale.itemName))
    .slice()
    .reverse();
  const totals = salesTotals(query.trim() ? matched : salesList());
  $("#sale-count").textContent = String(totals.count);
  $("#sale-revenue").textContent = money(totals.revenue);
  $("#sale-profit").textContent = money(totals.profit);
  const message = salesList().length === 0
    ? "No sales yet. Record one from Inventory."
    : "Nothing in this view.";
  fillTable($("#saleRows"), matched, 6, message, (sale) => {
    const total = saleTotal(sale);
    const profit = sale.profit || 0;
    const pending = isPending(sale);
    const payment = pending
      ? `<span class="flag">${esc(sale.terms.toUpperCase())}</span> <button type="button" class="texty" data-received="${esc(sale.id)}">Received</button>`
      : "Paid";
    return `<tr>
      <td data-label="Date"><span><time datetime="${esc(sale.at)}">${esc(formatWhen(sale.at))}</time></span></td>
      <td class="item" data-label="">${esc(sale.itemName)}</td>
      <td class="num" data-label="Qty">${sale.quantity}</td>
      <td class="num" data-label="Total">${money(total)}</td>
      <td class="num${profit < 0 ? " neg" : ""}" data-label="Profit">${money(profit)}</td>
      <td data-label="Payment">${payment}</td>
    </tr>`;
  });
}

function expenseRow(row, kind) {
  const flag = kind === "upcoming" ? dueFlag(row.date) : "";
  const overdue = flag === "Overdue";
  const flagHtml = flag ? `<span class="flag">${esc(flag)}</span>` : "";
  const paid = kind === "upcoming"
    ? `<button type="button" class="texty" data-paid="${esc(row.id)}">Mark paid</button><span class="dot" aria-hidden="true">·</span>`
    : "";
  return `<tr class="${overdue ? "is-low" : ""}">
    <td class="item" data-label="">
      <button type="button" class="item-name" data-record="${kind}" data-id="${esc(row.id)}">${esc(row.name)}</button>
      <span class="category">${esc(row.category)}</span>
    </td>
    <td data-label="${kind === "upcoming" ? "Due" : "Paid"}"><span>${esc(formatDay(row.date))} ${flagHtml}</span></td>
    <td class="num" data-label="Amount">${money(row.amount)}</td>
    <td class="actions" data-label="">
      ${paid}
      <button type="button" class="texty" data-record="${kind}" data-id="${esc(row.id)}">Edit</button>
    </td>
  </tr>`;
}

function renderExpenses() {
  const query = $("#expenseSearch").value;
  const matched = state.expenses
    .filter((row) => textMatch(query, row.name, row.category, row.notes))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const source = query.trim() ? matched : state.expenses;
  $("#expense-total").textContent = money(sumAmount(source));
  $("#expense-month").textContent = money(sumAmount(source.filter((row) => inThisMonth(row.date))));
  $("#expense-count").textContent = String(source.length);
  const message = state.expenses.length === 0 ? "No expenses yet." : "Nothing in this view.";
  fillTable($("#expenseRows"), matched, 4, message, (row) => expenseRow(row, "expense"));
}

function renderUpcoming() {
  const query = $("#upcomingSearch").value;
  const matched = state.upcoming
    .filter((row) => textMatch(query, row.name, row.category, row.notes))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const source = query.trim() ? matched : state.upcoming;
  const soon = source.filter((row) => {
    const days = daysUntil(row.date);
    return Number.isFinite(days) && days <= 30;
  });
  const next = [...source].sort((a, b) => a.date.localeCompare(b.date))[0];
  $("#upcoming-total").textContent = money(sumAmount(source));
  $("#upcoming-soon").textContent = money(sumAmount(soon));
  $("#upcoming-next").textContent = next ? formatDay(next.date) : "—";
  const message = state.upcoming.length === 0 ? "Nothing scheduled." : "Nothing in this view.";
  fillTable($("#upcomingRows"), matched, 4, message, (row) => expenseRow(row, "upcoming"));
}

function renderInvestors() {
  const query = $("#investorSearch").value;
  const matched = state.investors
    .filter((row) => textMatch(query, row.name, row.notes))
    .slice()
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  const source = query.trim() ? matched : state.investors;
  const largest = source.reduce((max, row) => Math.max(max, row.amount), 0);
  $("#investor-capital").textContent = money(sumAmount(source));
  $("#investor-count").textContent = String(source.length);
  $("#investor-largest").textContent = money(largest);
  const message = state.investors.length === 0 ? "No investors yet." : "Nothing in this view.";
  fillTable($("#investorRows"), matched, 5, message, (row) => {
    const share = row.share == null ? "—" : `${row.share}%`;
    const notes = row.notes ? `<span class="category">${esc(row.notes)}</span>` : "";
    return `<tr>
      <td class="item" data-label="">
        <button type="button" class="item-name" data-record="investor" data-id="${esc(row.id)}">${esc(row.name)}</button>
        ${notes}
      </td>
      <td class="num" data-label="Invested">${money(row.amount)}</td>
      <td class="num" data-label="Share">${share}</td>
      <td data-label="Since"><span>${esc(formatDay(row.date))}</span></td>
      <td class="actions" data-label="">
        <button type="button" class="texty" data-record="investor" data-id="${esc(row.id)}">Edit</button>
      </td>
    </tr>`;
  });
}

function render() {
  renderChrome();
  renderDashboard();
  renderStats();
  renderFilters();
  renderSort();
  renderRows();
  renderMovements();
  renderSales();
  renderExpenses();
  renderUpcoming();
  renderInvestors();
}

function fillCategories() {
  const categories = [...new Set(state.items.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  $("#categories").innerHTML = categories.map((category) => `<option value="${esc(category)}"></option>`).join("");
}

function setRemoveArmed(armed) {
  removeArmed = armed;
  const button = $("#removeBtn");
  button.textContent = armed ? "Confirm remove" : "Remove item";
  button.classList.toggle("armed", armed);
}

function updateItemPreview() {
  const form = $("#itemForm");
  const preview = $("#itemPreview");
  const cost = Math.max(0, cents(form.cost.value || 0));
  const price = Math.max(0, cents(form.price.value || 0));
  if (form.price.value === "") {
    preview.textContent = "Margin appears once a list price is set.";
    preview.classList.remove("neg");
    return;
  }
  if (price <= 0) {
    preview.textContent = "List price is zero.";
    preview.classList.remove("neg");
    return;
  }
  const unit = price - cost;
  preview.textContent = `${marginPct(cost, price)}% margin · ${money(unit)} per unit`;
  preview.classList.toggle("neg", unit < 0);
}

function openItemDialog(id) {
  const form = $("#itemForm");
  const item = id ? itemById(id) : null;
  editingId = item ? item.id : null;
  setRemoveArmed(false);
  form.reset();
  $("#itemHeading").textContent = item ? "Edit item" : "New item";
  $("#removeBtn").hidden = !item;
  $("#qtyHint").textContent = item
    ? "Changing on hand records a recount and leaves unit cost as it is. Use Restock when you buy more."
    : "Opening quantity is recorded as a purchase at this unit cost.";

  if (item) {
    form.name.value = item.name;
    form.category.value = item.category;
    form.quantity.value = String(item.quantity);
    form.cost.value = (item.cost / 100).toFixed(2);
    form.price.value = (item.price / 100).toFixed(2);
    form.reorderAt.value = String(item.reorderAt);
    form.notes.value = item.notes;
  } else {
    form.quantity.value = "1";
    form.reorderAt.value = "0";
  }

  fillCategories();
  updateItemPreview();
  rememberFocus();
  $("#itemDialog").showModal();
  form.name.focus();
}

function requireText(input, message) {
  if (input.value.trim()) {
    input.setCustomValidity("");
    return true;
  }
  input.setCustomValidity(message);
  return false;
}

function readItemForm(form) {
  return {
    name: form.name.value.trim(),
    category: form.category.value.trim(),
    quantity: Math.max(0, int(form.quantity.value)),
    cost: Math.max(0, cents(form.cost.value)),
    price: Math.max(0, cents(form.price.value)),
    reorderAt: Math.max(0, int(form.reorderAt.value)),
    notes: form.notes.value.trim(),
  };
}

function onItemSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const nameOk = requireText(form.name, "Enter a name.");
  const categoryOk = requireText(form.category, "Enter a category.");
  if (!nameOk || !categoryOk || !form.reportValidity()) return;

  const draft = readItemForm(form);
  if (editingId) {
    const item = itemById(editingId);
    if (!item) return;
    const previousQty = item.quantity;
    Object.assign(item, draft);
    if (draft.quantity !== previousQty) {
      pushMovement({ type: "recount", itemId: item.id, itemName: item.name, quantity: item.quantity });
      notify(`Recounted ${item.name} to ${item.quantity}.`);
    } else {
      notify(`Updated ${item.name}.`);
    }
    flash(item.id);
  } else {
    const item = { id: uid(), ...draft };
    state.items.push(item);
    if (item.quantity > 0) {
      pushMovement({
        type: "buy",
        itemId: item.id,
        itemName: item.name,
        quantity: item.quantity,
        unitCost: item.cost,
      });
    }
    ui.filter = "all";
    ui.query = "";
    $("#search").value = "";
    flash(item.id);
    notify(`Added ${item.name}.`);
  }

  save();
  render();
  $("#itemDialog").close();
}

function removeItem() {
  if (!editingId) return;
  if (!removeArmed) {
    setRemoveArmed(true);
    return;
  }
  const item = itemById(editingId);
  if (!item) return;
  state.items = state.items.filter((entry) => entry.id !== editingId);
  notify(`Removed ${item.name}.`);
  save();
  render();
  $("#itemDialog").close();
}

function updateSellPreview() {
  const item = itemById(tradeId);
  const preview = $("#sellPreview");
  if (!item) return;
  const form = $("#sellForm");
  const quantity = Math.max(0, int(form.quantity.value));
  const unitPrice = Math.max(0, cents(form.price.value || 0));
  if (quantity < 1) {
    preview.textContent = "Enter a quantity.";
    preview.classList.remove("neg");
    return;
  }
  const profit = (unitPrice - item.cost) * quantity;
  const terms = form.terms.value;
  const waiting = terms === "cop" || terms === "cod" ? ` · ${terms.toUpperCase()} pending` : "";
  preview.textContent = `${money(profit)} profit${waiting}`;
  preview.classList.toggle("neg", profit < 0);
}

function validateSell(form, item) {
  const quantity = int(form.quantity.value);
  if (quantity < 1) form.quantity.setCustomValidity("Enter a quantity of at least 1.");
  else if (quantity > item.quantity) form.quantity.setCustomValidity(`Only ${item.quantity} on hand.`);
  else form.quantity.setCustomValidity("");
}

function openSell(id) {
  const item = itemById(id);
  if (!item || item.quantity < 1) return;
  tradeId = item.id;
  const form = $("#sellForm");
  form.reset();
  form.quantity.max = String(item.quantity);
  form.quantity.value = "1";
  form.quantity.setCustomValidity("");
  form.price.value = (item.price / 100).toFixed(2);
  $("#sellHeading").textContent = item.name;
  $("#sellMeta").textContent = `${item.quantity} on hand · cost ${money(item.cost)}`;
  updateSellPreview();
  rememberFocus();
  $("#sellDialog").showModal();
  form.quantity.focus();
  form.quantity.select();
}

function onSellSubmit(event) {
  event.preventDefault();
  const item = itemById(tradeId);
  if (!item) return;
  const form = event.currentTarget;
  validateSell(form, item);
  if (!form.reportValidity()) return;

  const quantity = int(form.quantity.value);
  const unitPrice = Math.max(0, cents(form.price.value));
  const profit = (unitPrice - item.cost) * quantity;
  const terms = form.terms.value === "cop" || form.terms.value === "cod" ? form.terms.value : "paid";
  item.quantity -= quantity;
  pushMovement({
    type: "sell",
    itemId: item.id,
    itemName: item.name,
    quantity,
    unitCost: item.cost,
    unitPrice,
    profit,
    ...(terms === "paid" ? {} : { terms }),
  });
  flash(item.id);
  notify(terms === "paid"
    ? `Sold ${quantity} × ${item.name}.`
    : `Sold ${quantity} × ${item.name} · ${terms.toUpperCase()} pending.`);
  save();
  render();
  $("#sellDialog").close();
}

function updateRestockPreview() {
  const item = itemById(tradeId);
  const preview = $("#restockPreview");
  if (!item) return;
  const form = $("#restockForm");
  const quantity = Math.max(0, int(form.quantity.value));
  const unitCost = Math.max(0, cents(form.cost.value || 0));
  if (quantity < 1) {
    preview.textContent = "Enter a quantity.";
    return;
  }
  const nextQty = item.quantity + quantity;
  const average = Math.round((item.cost * item.quantity + unitCost * quantity) / nextQty);
  preview.textContent = `${nextQty} on hand · average cost ${money(average)}`;
}

function openRestock(id) {
  const item = itemById(id);
  if (!item) return;
  tradeId = item.id;
  const form = $("#restockForm");
  form.reset();
  form.quantity.value = "1";
  form.cost.value = (item.cost / 100).toFixed(2);
  $("#restockHeading").textContent = item.name;
  $("#restockMeta").textContent = `${item.quantity} on hand · cost ${money(item.cost)}`;
  updateRestockPreview();
  rememberFocus();
  $("#restockDialog").showModal();
  form.quantity.focus();
  form.quantity.select();
}

function onRestockSubmit(event) {
  event.preventDefault();
  const item = itemById(tradeId);
  if (!item) return;
  const form = event.currentTarget;
  if (int(form.quantity.value) < 1) form.quantity.setCustomValidity("Add at least 1.");
  else form.quantity.setCustomValidity("");
  if (!form.reportValidity()) return;

  const quantity = int(form.quantity.value);
  const unitCost = Math.max(0, cents(form.cost.value));
  const nextQty = item.quantity + quantity;
  item.cost = Math.round((item.cost * item.quantity + unitCost * quantity) / nextQty);
  item.quantity = nextQty;
  pushMovement({
    type: "buy",
    itemId: item.id,
    itemName: item.name,
    quantity,
    unitCost,
  });
  flash(item.id);
  notify(`Restocked ${quantity} × ${item.name}.`);
  save();
  render();
  $("#restockDialog").close();
}

function readShare(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, Math.round(parsed * 10) / 10));
}

function fillRecordCategories() {
  const names = new Set();
  for (const row of [...state.expenses, ...state.upcoming]) {
    if (row.category) names.add(row.category);
  }
  const categories = [...names].sort((a, b) => a.localeCompare(b));
  $("#recordCategories").innerHTML = categories.map((category) => `<option value="${esc(category)}"></option>`).join("");
}

function setRecordRemoveArmed(armed) {
  recordRemoveArmed = armed;
  const button = $("#recordRemove");
  button.textContent = armed ? "Confirm remove" : "Remove";
  button.classList.toggle("armed", armed);
}

function updateRecordPreview() {
  const form = $("#recordForm");
  const preview = $("#recordPreview");
  const amount = Math.max(0, cents(form.amount.value || 0));
  if (form.amount.value === "") {
    preview.textContent = "";
    return;
  }
  if (recordKind === "investor") {
    const share = readShare(form.share.value);
    preview.textContent = share == null ? money(amount) : `${money(amount)} · ${share}% share`;
    return;
  }
  const day = form.date.value ? formatDay(form.date.value) : "";
  preview.textContent = day ? `${money(amount)} · ${day}` : money(amount);
}

function openRecord(kind, id) {
  const meta = RECORD[kind];
  const list = state[meta.list];
  const existing = id ? list.find((row) => row.id === id) : null;
  recordKind = kind;
  recordId = existing ? existing.id : null;
  const form = $("#recordForm");
  form.reset();
  form.name.setCustomValidity("");
  form.category.setCustomValidity("");
  form.amount.setCustomValidity("");
  setRecordRemoveArmed(false);
  $("#recordEyebrow").textContent = meta.eyebrow;
  $("#recordHeading").textContent = existing ? meta.edit : meta.create;
  $("#recordSave").textContent = meta.save;
  $("#recordRemove").hidden = !existing;
  $("#field-category").hidden = !meta.category;
  form.category.required = meta.category;
  $("#field-share").hidden = !meta.share;
  $("#amountLabel").textContent = meta.amount;
  $("#dateLabel").textContent = meta.date;
  if (existing) {
    form.name.value = existing.name;
    form.amount.value = (existing.amount / 100).toFixed(2);
    form.date.value = existing.date;
    form.notes.value = existing.notes || "";
    if (meta.category) form.category.value = existing.category || "";
    if (meta.share && existing.share != null) form.share.value = String(existing.share);
  } else {
    form.date.value = todayKey();
  }
  fillRecordCategories();
  updateRecordPreview();
  rememberFocus();
  $("#recordDialog").showModal();
  form.name.focus();
}

function onRecordSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const meta = RECORD[recordKind];
  const nameOk = requireText(form.name, "Enter a name.");
  const categoryOk = meta.category ? requireText(form.category, "Enter a category.") : true;
  if (cents(form.amount.value) <= 0) form.amount.setCustomValidity("Enter an amount greater than zero.");
  else form.amount.setCustomValidity("");
  if (!nameOk || !categoryOk || !form.reportValidity()) return;

  const draft = {
    name: form.name.value.trim(),
    amount: cents(form.amount.value),
    date: form.date.value,
    notes: form.notes.value.trim(),
  };
  if (meta.category) draft.category = form.category.value.trim();
  if (meta.share) draft.share = readShare(form.share.value);

  const list = state[meta.list];
  if (recordId) {
    const row = list.find((entry) => entry.id === recordId);
    if (!row) return;
    Object.assign(row, draft);
    notify(`Updated ${draft.name}.`);
  } else {
    list.push({ id: uid(), ...draft });
    notify(`Added ${draft.name}.`);
  }
  save();
  render();
  $("#recordDialog").close();
}

function removeRecord() {
  if (!recordId) return;
  if (!recordRemoveArmed) {
    setRecordRemoveArmed(true);
    return;
  }
  const meta = RECORD[recordKind];
  const row = state[meta.list].find((entry) => entry.id === recordId);
  state[meta.list] = state[meta.list].filter((entry) => entry.id !== recordId);
  notify(`Removed ${row ? row.name : "record"}.`);
  save();
  render();
  $("#recordDialog").close();
}

function markReceived(id) {
  const sale = state.movements.find((movement) => movement.id === id && movement.type === "sell");
  if (!sale || !isPending(sale)) return;
  delete sale.terms;
  notify(`Received payment for ${sale.itemName}.`);
  save();
  render();
}

function markPaid(id) {
  const bill = state.upcoming.find((row) => row.id === id);
  if (!bill) return;
  state.expenses.push({
    id: uid(),
    name: bill.name,
    category: bill.category,
    amount: bill.amount,
    date: todayKey(),
    notes: bill.notes,
  });
  state.upcoming = state.upcoming.filter((row) => row.id !== id);
  notify(`Paid ${bill.name}.`);
  save();
  render();
}

async function onAuthSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const password = form.password.value;
  localStorage.setItem(REMEMBER, form.remember.checked ? "1" : "0");
  $("#authSubmit").disabled = true;
  $("#authMessage").textContent = "";
  const result = authMode === "sign-in"
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });
  $("#authSubmit").disabled = false;
  if (result.error) {
    $("#authMessage").textContent = result.error.message;
    return;
  }
  if (authMode === "sign-up" && !result.data.session) {
    setAuthMode("sign-in");
    form.email.value = email;
    $("#authMessage").textContent = "Check your email to confirm the account, then sign in.";
  }
}

async function signOut() {
  while (dirty || saving) await saveDone;
  const { error } = await supabase.auth.signOut();
  if (error) notify(error.message);
}

function bind() {
  $("#authForm").addEventListener("submit", onAuthSubmit);
  $("#peekPassword").addEventListener("click", () => {
    const input = $("#authForm").password;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    const button = $("#peekPassword");
    button.textContent = show ? "Hide" : "Show";
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    button.setAttribute("aria-pressed", show ? "true" : "false");
  });
  $("#authSwitch").addEventListener("click", () => {
    setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in");
  });
  $("#signOutBtn").addEventListener("click", signOut);

  $("#addBtn").addEventListener("click", () => {
    if (ui.tab === "inventory") openItemDialog(null);
    else if (ui.tab === "expenses") openRecord("expense");
    else if (ui.tab === "upcoming") openRecord("upcoming");
    else if (ui.tab === "investors") openRecord("investor");
  });

  $("#tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    const id = button.dataset.tab;
    if (location.hash === `#${id}`) return;
    location.hash = id;
  });

  window.addEventListener("hashchange", () => {
    ui.tab = currentTab();
    render();
  });

  $("#search").addEventListener("input", (event) => {
    ui.query = event.target.value;
    render();
  });

  for (const id of ["saleSearch", "expenseSearch", "upcomingSearch", "investorSearch"]) {
    $(`#${id}`).addEventListener("input", () => render());
  }

  $(".filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    ui.filter = button.dataset.filter;
    render();
  });

  $("#inventoryTable thead").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort]");
    if (!button) return;
    const key = button.dataset.sort;
    if (ui.sort === key) ui.dir = ui.dir === "asc" ? "desc" : "asc";
    else {
      ui.sort = key;
      ui.dir = key === "name" ? "asc" : "desc";
    }
    render();
  });

  $("#rows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const { id, action } = button.dataset;
    if (action === "edit") openItemDialog(id);
    else if (action === "sell") openSell(id);
    else if (action === "restock") openRestock(id);
  });

  $("#itemForm").addEventListener("submit", onItemSubmit);
  $("#itemForm").addEventListener("input", (event) => {
    if (event.target.name === "name" || event.target.name === "category") {
      event.target.setCustomValidity("");
    }
    setRemoveArmed(false);
    updateItemPreview();
  });
  $("#removeBtn").addEventListener("click", removeItem);

  $("#sellForm").addEventListener("submit", onSellSubmit);
  $("#sellForm").addEventListener("input", (event) => {
    if (event.target.name === "quantity") event.target.setCustomValidity("");
    updateSellPreview();
  });

  $("#restockForm").addEventListener("submit", onRestockSubmit);
  $("#restockForm").addEventListener("input", (event) => {
    if (event.target.name === "quantity") event.target.setCustomValidity("");
    updateRestockPreview();
  });

  $("#recordForm").addEventListener("submit", onRecordSubmit);
  $("#recordForm").addEventListener("input", (event) => {
    if (event.target.name === "name" || event.target.name === "category" || event.target.name === "amount") {
      event.target.setCustomValidity("");
    }
    setRecordRemoveArmed(false);
    updateRecordPreview();
  });
  $("#recordRemove").addEventListener("click", removeRecord);

  document.body.addEventListener("click", (event) => {
    const destination = event.target.closest("[data-goto]");
    if (destination) {
      location.hash = destination.dataset.goto;
      return;
    }
    const paid = event.target.closest("[data-paid]");
    if (paid) {
      markPaid(paid.dataset.paid);
      return;
    }
    const received = event.target.closest("[data-received]");
    if (received) {
      markReceived(received.dataset.received);
      return;
    }
    const record = event.target.closest("[data-record]");
    if (record) openRecord(record.dataset.record, record.dataset.id);
  });

  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", restoreFocus);
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });

  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.addEventListener("wheel", (event) => {
      if (document.activeElement === input) event.preventDefault();
    }, { passive: false });
  });
}

bind();
boot();
