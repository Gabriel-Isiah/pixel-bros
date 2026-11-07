import { createClient } from "@supabase/supabase-js";

const KEY = "bns-inventory-v1";
const IMPORTED = "bns-imported-v1";
const FUNDS_KEY = "bns-funds-adjustment";
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

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return monthKeyFromDate(date);
}

function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);
  return monthKeyFromDate(new Date(year, month - 1 + delta, 1));
}

const monthLabelFmt = new Intl.DateTimeFormat("en-PH", { month: "short", year: "numeric" });

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return monthLabelFmt.format(new Date(year, month - 1, 1));
}

function calendarDaysBetween(earlierIso, laterIso) {
  const earlier = new Date(earlierIso);
  const later = new Date(laterIso);
  if (Number.isNaN(earlier.getTime()) || Number.isNaN(later.getTime())) return null;
  const start = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  const end = new Date(later.getFullYear(), later.getMonth(), later.getDate());
  return Math.round((end - start) / 86400000);
}

function formatDays(value) {
  if (value == null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? "day" : "days"}`;
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
  sales: "New order",
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
      condition: String(raw.condition || ""),
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
    fundsAdjustment: Math.round(Number(data.fundsAdjustment) || 0),
  };
}

function emptyLedger() {
  return { items: [], movements: [], expenses: [], upcoming: [], investors: [], fundsAdjustment: 0 };
}

function ledgerSignature(ledger) {
  return JSON.stringify({
    items: ledger.items,
    movements: ledger.movements,
    expenses: ledger.expenses || [],
    upcoming: ledger.upcoming || [],
    investors: ledger.investors || [],
    fundsAdjustment: ledger.fundsAdjustment || 0,
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
    condition: item.condition || "",
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
      condition: row.condition || "",
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
let accountId = null;
let loadToken = 0;
let authMode = "sign-in";
let saving = false;
let dirty = false;
let saveDone = Promise.resolve();
const ui = { query: "", sort: "name", dir: "asc", flashId: null, tab: currentTab() };
let editingId = null;
let tradeId = null;
let orderDraft = null;
let saleDeleteArmedId = null;
let removeArmed = false;
let deleteArmedId = null;
let movementDeleteArmedId = null;
let recordKind = "expense";
let recordId = null;
let recordRemoveArmed = false;
let toastTimer = 0;
let flashTimer = 0;
let lastFocus = null;

const loadedIds = Object.fromEntries(TABLES.map((table) => [table, new Set()]));

function rememberLoaded(ledger) {
  for (const table of TABLES) {
    loadedIds[table] = new Set((ledger[table] || []).map((row) => row.id));
  }
}

async function replaceTable(id, table, rows) {
  const existing = await supabase.from(table).select("id").eq("user_id", id);
  if (existing.error) return existing.error;
  if (rows.length) {
    const written = await supabase.from(table).upsert(rows, { onConflict: "user_id,id" });
    if (written.error) return written.error;
  }
  const remote = new Set((existing.data || []).map((row) => row.id));
  const known = loadedIds[table] || new Set();
  const present = new Set(rows.map((row) => row.id));
  const stale = [...known].filter((rowId) => !present.has(rowId) && remote.has(rowId));
  if (stale.length) {
    const removed = await supabase.from(table).delete().eq("user_id", id).in("id", stale);
    if (removed.error) return removed.error;
  }
  loadedIds[table] = present;
  return null;
}

async function writeLedger(id, ledger) {
  const errors = await Promise.all(TABLES.map((table) => replaceTable(id, table, rowsFor(table, ledger, id))));
  return errors.find(Boolean) || null;
}

function fundsStorageKey(id) {
  return `${FUNDS_KEY}:${id}`;
}

function readStoredAdjustment(id) {
  const value = Number(localStorage.getItem(fundsStorageKey(id)));
  return Number.isFinite(value) ? Math.round(value) : 0;
}

async function loadFundsAdjustment(id) {
  const stored = readStoredAdjustment(id);
  const result = await supabase.from("settings").select("funds_adjustment").eq("user_id", id).maybeSingle();
  if (result.error || !result.data) return stored;
  return Math.round(Number(result.data.funds_adjustment) || 0);
}

let fundsRemoteWarned = false;

async function writeFundsAdjustment(id, amount) {
  const value = Math.round(Number(amount) || 0);
  localStorage.setItem(fundsStorageKey(id), String(value));
  const result = await supabase.from("settings").upsert(
    { user_id: id, funds_adjustment: value },
    { onConflict: "user_id" },
  );
  if (result.error && value !== 0 && !fundsRemoteWarned) {
    fundsRemoteWarned = true;
    notify("Total funds are kept in this browser. Run the settings table in supabase/schema.sql to save them with the account.");
  }
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
      await writeFundsAdjustment(id, snapshot.fundsAdjustment || 0);
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
  $("#authExtra").hidden = true;
  $("#authHeading").textContent = "Connect Supabase";
  $("#authMessage").textContent = secretKey
    ? "Use the publishable key from Supabase, not the secret key. Put it in VITE_SUPABASE_ANON_KEY on Vercel, then redeploy."
    : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on Vercel, then redeploy. Locally, put them in .env and restart.";
}

function showAuth() {
  loadToken += 1;
  userId = null;
  accountId = null;
  $("#boot").hidden = true;
  $("#auth").hidden = false;
  $("#app").hidden = true;
  $("#authForm").hidden = false;
  $("#authSwitch").hidden = false;
  $("#authExtra").hidden = true;
  $("#authForm").remember.checked = remembered();
  setAuthMode(authMode);
}

function showWaiting(message) {
  $("#boot").hidden = true;
  $("#auth").hidden = false;
  $("#app").hidden = true;
  $("#authForm").hidden = true;
  $("#authSwitch").hidden = true;
  $("#authExtra").hidden = false;
  $("#authHeading").textContent = "Admin access";
  $("#authMessage").textContent = message;
}

async function ensureShop() {
  const current = await supabase.rpc("shop_context");
  if (current.error) throw current.error;
  if (current.data?.is_admin && current.data.owner_id) return current.data;

  const claim = await supabase.rpc("claim_shop");
  if (!claim.error) {
    const again = await supabase.rpc("shop_context");
    if (again.error) throw again.error;
    if (again.data?.is_admin && again.data.owner_id) return again.data;
  }
  showWaiting(claim.error?.message || "An admin needs to add this email before this account can open the ledger.");
  return null;
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
  const account = session.user.id;
  if (account === accountId && userId) {
    showApp();
    return;
  }
  $("#boot").hidden = false;
  $("#auth").hidden = true;
  $("#app").hidden = true;
  try {
    const shop = await ensureShop();
    if (!shop || token !== loadToken) return;
    let ledger = await fetchLedger(shop.owner_id);
    if (token !== loadToken) return;
    ledger = await maybeImportLocal(shop.owner_id, ledger);
    if (token !== loadToken) return;
    ledger.fundsAdjustment = await loadFundsAdjustment(shop.owner_id);
    accountId = account;
    userId = shop.owner_id;
    state = ledger;
    rememberLoaded(ledger);
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
  return `${item.name} ${item.category} ${item.condition || ""} ${item.notes}`.toLowerCase().includes(query);
}

function visibleItems() {
  const items = state.items.filter(matchesQuery);

  const dir = ui.dir === "asc" ? 1 : -1;
  items.sort((a, b) => {
    let cmp = 0;
    if (ui.sort === "name") cmp = a.name.localeCompare(b.name);
    else if (ui.sort === "type") cmp = a.category.localeCompare(b.category);
    else if (ui.sort === "condition") cmp = (a.condition || "").localeCompare(b.condition || "");
    else if (ui.sort === "quantity") cmp = a.quantity - b.quantity;
    else if (ui.sort === "cost") cmp = a.cost - b.cost;
    else if (ui.sort === "price") cmp = a.price - b.price;
    else if (ui.sort === "profit") cmp = (a.price - a.cost) - (b.price - b.cost);
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return cmp * dir;
  });
  return items;
}

const ICON_PENCIL = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.2 3.3 12.7 6.8 5.5 14H2v-3.5L9.2 3.3Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m7.8 4.7 3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;
const ICON_TRASH = `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 4.5h9.6M6.2 4.5V3h3.6v1.5M4.4 4.5l.6 8.3h6l.6-8.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function rowHTML(item) {
  const status = statusOf(item);
  const profit = item.price - item.cost;
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
  const armed = deleteArmedId === item.id;
  const waitingSales = pendingOrderSales(item);
  const waiting = waitingSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  const credit = waiting > 0
    ? `<button type="button" class="credit-act" data-action="credit" data-id="${id}" aria-label="Credit ${money(waiting)} for ${esc(orderTitle(waitingSales))}">Credit ${money(waiting)}</button>`
    : "";

  return `<tr data-id="${id}" class="${classes}">
    <td class="item" data-label="">
      <button type="button" class="item-name" data-action="edit" data-id="${id}">${name}</button>
    </td>
    <td data-label="Type">${esc(item.category)}</td>
    <td data-label="Condition">${esc(item.condition || "—")}</td>
    <td class="num" data-label="On hand"><span class="qty-wrap">${item.quantity}${flag}</span></td>
    <td class="num" data-label="Buy">${money(item.cost)}</td>
    <td class="num" data-label="Sell">${money(item.price)}</td>
    <td class="num${profit < 0 ? " neg" : ""}" data-label="Profit">${money(profit)}</td>
    <td class="actions" data-label="">
      <div class="row-actions">
        ${credit}
        <button type="button" class="icon-act" data-action="edit" data-id="${id}" aria-label="Edit ${name}">${ICON_PENCIL}</button>
        <button type="button" class="icon-act${armed ? " armed" : ""}" data-action="delete" data-id="${id}" aria-label="${armed ? `Confirm delete ${name}` : `Delete ${name}`}">${ICON_TRASH}</button>
      </div>
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
    tbody.innerHTML = `<tr><td class="empty" colspan="8">${message}</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(rowHTML).join("");
}

function movementText(movement) {
  const each = movement.quantity > 1 ? " each" : "";
  if (movement.type === "sell") {
    const pending = isPending(movement) ? " · COP/COD pending" : "";
    return `Sold ${movement.quantity} × ${movement.itemName} at ${money(movement.unitPrice)} · profit ${money(movement.profit)}${pending}`;
  }
  if (movement.type === "buy") {
    return `Bought ${movement.quantity} × ${movement.itemName} at ${money(movement.unitCost)}${each}`;
  }
  return `Recounted ${movement.itemName} to ${movement.quantity}`;
}

function movementItem(movement) {
  return itemById(movement.itemId) || state.items.find((item) => item.name === movement.itemName) || null;
}

function movementActions(item) {
  const waitingSales = pendingOrderSales(item);
  const waiting = waitingSales.reduce((sum, sale) => sum + saleTotal(sale), 0);
  if (waiting <= 0) return null;
  const wrap = document.createElement("div");
  wrap.className = "row-actions";
  const credit = document.createElement("button");
  credit.type = "button";
  credit.className = "credit-act";
  credit.dataset.action = "credit";
  credit.dataset.id = item.id;
  credit.textContent = `Credit ${money(waiting)}`;
  credit.setAttribute("aria-label", `Credit ${money(waiting)} for ${orderTitle(waitingSales)}`);
  wrap.append(credit);
  return wrap;
}

function undoBuy(item, movement) {
  const nextQty = item.quantity - movement.quantity;
  if (nextQty >= 0) {
    if (nextQty > 0) {
      const total = item.cost * item.quantity - (movement.unitCost || 0) * movement.quantity;
      if (total >= 0) item.cost = Math.round(total / nextQty);
    }
    item.quantity = nextQty;
    return 0;
  }
  item.quantity = 0;
  return -nextQty;
}

function undoRecount(item, movement) {
  if (movement.unitCost == null) return;
  const delta = movement.quantity - movement.unitCost;
  item.quantity = Math.max(0, item.quantity - delta);
}

function deleteStockChange(id) {
  if (movementDeleteArmedId !== id) {
    movementDeleteArmedId = id;
    render();
    return;
  }
  const movement = state.movements.find((entry) => entry.id === id && entry.type !== "sell");
  movementDeleteArmedId = null;
  if (!movement) {
    render();
    return;
  }
  const before = totalFunds();
  const item = movementItem(movement);
  let extra = "";
  if (item && movement.type === "buy") {
    const sold = undoBuy(item, movement);
    if (sold > 0) {
      const was = sold === 1 ? "was" : "were";
      const left = item.quantity === 0 ? "none remain" : `${item.quantity} remain`;
      extra = ` ${sold} ${was} already sold, so ${left} on hand.`;
    }
  } else if (item && movement.type === "recount") {
    undoRecount(item, movement);
  }
  state.movements = state.movements.filter((entry) => entry.id !== id);
  const label = movement.type === "buy"
    ? `Removed the purchase of ${movement.quantity} × ${movement.itemName}.`
    : `Removed the recount of ${movement.itemName}.`;
  notify(`${label}${extra}${fundsChangeNote(before)}`);
  save();
  render();
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
    const side = document.createElement("div");
    side.className = "change-side";
    const stock = movementItem(movement);
    const actions = stock ? movementActions(stock) : null;
    if (actions) side.append(actions);
    const armed = movementDeleteArmedId === movement.id;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = `icon-act${armed ? " armed" : ""}`;
    remove.dataset.movement = movement.id;
    remove.innerHTML = ICON_TRASH;
    remove.setAttribute("aria-label", armed
      ? `Confirm remove this stock change for ${movement.itemName}`
      : `Remove this stock change for ${movement.itemName}`);
    side.append(remove);
    const time = document.createElement("time");
    time.dateTime = movement.at;
    time.textContent = formatWhen(movement.at);
    side.append(time);
    item.append(text, side);
    list.append(item);
  }
}

function placeTabIndicator() {
  const nav = $("#tabs");
  const indicator = $("#tabIndicator");
  const current = nav.querySelector('.tab[aria-selected="true"]');
  if (!indicator || !current) return;
  indicator.style.width = `${current.offsetWidth}px`;
  indicator.style.height = `${current.offsetHeight}px`;
  indicator.style.transform = `translate(${current.offsetLeft}px, ${current.offsetTop}px)`;
}

function renderChrome() {
  const title = TAB_TITLES[ui.tab] || "Dashboard";
  const heading = $("#pageTitle");
  if (heading.textContent !== title) {
    heading.textContent = title;
    heading.classList.remove("title-in");
    void heading.offsetWidth;
    heading.classList.add("title-in");
  }
  document.title = "Pixel Bros BNS";
  const action = TAB_ACTIONS[ui.tab];
  const button = $("#addBtn");
  button.hidden = !action;
  if (action) button.textContent = action;

  for (const id of TABS) {
    $(`#panel-${id}`).hidden = id !== ui.tab;
    $(`#tab-${id}`).setAttribute("aria-selected", String(id === ui.tab));
  }
  requestAnimationFrame(placeTabIndicator);
}

function salesList() {
  return state.movements.filter((movement) => movement.type === "sell");
}

function isPending(sale) {
  return sale.terms === "cop" || sale.terms === "cod";
}

// Lines of one order share an id prefix: `${orderId}~${lineId}`.
// Older sales have no "~", so each one stays its own row.
function orderKey(sale) {
  const id = String(sale.id || "");
  const mark = id.indexOf("~");
  return mark === -1 ? id : id.slice(0, mark);
}

function orderGroups(sales) {
  const groups = new Map();
  for (const sale of sales) {
    const id = orderKey(sale);
    let order = groups.get(id);
    if (!order) {
      order = { id, at: sale.at, lines: [] };
      groups.set(id, order);
    }
    if (String(sale.at) < String(order.at)) order.at = sale.at;
    order.lines.push(sale);
  }
  return [...groups.values()].sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function saleTitle(sale) {
  const item = itemById(sale.itemId) || saleItem(sale);
  const name = sale.itemName || item?.name || "Item";
  return item?.condition ? `${name} · ${item.condition}` : name;
}

function orderTitle(lines) {
  return lines.map(saleTitle).join(", ");
}

function pendingOrderSales(item) {
  const keys = new Set(pendingSales(item).map(orderKey));
  if (!keys.size) return [];
  return salesList().filter((sale) => keys.has(orderKey(sale)) && isPending(sale));
}

function saleMatchesItem(sale, item) {
  if (sale.itemId) return sale.itemId === item.id;
  return sale.itemName === item.name;
}

function pendingSales(item) {
  return salesList().filter((sale) => isPending(sale) && saleMatchesItem(sale, item));
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

function computedFunds() {
  const collected = salesTotals(salesList().filter((sale) => !isPending(sale)));
  return sumAmount(state.investors) + collected.revenue - purchaseSpend() - sumAmount(state.expenses);
}

function totalFunds() {
  return computedFunds() + (state.fundsAdjustment || 0);
}

function fundsChangeNote(before) {
  const delta = totalFunds() - before;
  if (!delta) return "";
  const sign = delta > 0 ? "+" : "−";
  return ` Total funds ${sign}${money(Math.abs(delta))}.`;
}

function fillTable(tbody, rows, colspan, message, renderRow) {
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td class="empty" colspan="${colspan}">${message}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(renderRow).join("");
}

function saleItem(sale) {
  return state.items.find((item) => item.id === sale.itemId)
    || state.items.find((item) => item.name === sale.itemName)
    || null;
}

function monthBucket(key) {
  const sales = salesList().filter((sale) => monthKey(sale.at) === key);
  const totals = salesTotals(sales);
  const units = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  return { units, revenue: totals.revenue, profit: totals.profit };
}

function monthKeys() {
  const current = monthKeyFromDate(new Date());
  const keys = new Set([current, shiftMonth(current, -1)]);
  for (const sale of salesList()) {
    const key = monthKey(sale.at);
    if (key) keys.add(key);
  }
  return [...keys].sort((a, b) => b.localeCompare(a)).slice(0, 12);
}

function changeCell(current, previous) {
  const diff = current - previous;
  if (diff === 0) return `<td class="num" data-label="Vs prior">Even</td>`;
  const sign = diff > 0 ? "+" : "−";
  const pct = previous > 0 ? ` · ${sign}${Math.abs(Math.round((diff / previous) * 100))}%` : "";
  const cls = diff < 0 ? "num neg" : "num";
  return `<td class="${cls}" data-label="Vs prior">${sign}${money(Math.abs(diff))}${pct}</td>`;
}

function rankGroups(keyOf, labelOf) {
  const groups = new Map();
  for (const sale of salesList()) {
    const key = keyOf(sale);
    let row = groups.get(key);
    if (!row) {
      row = { label: labelOf(sale), units: 0, revenue: 0, profit: 0 };
      groups.set(key, row);
    }
    row.label = labelOf(sale);
    row.units += sale.quantity;
    row.revenue += saleTotal(sale);
    row.profit += sale.profit || 0;
  }
  return [...groups.values()]
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function renderRank(list, rows, emptyText) {
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
    const text = document.createElement("p");
    text.textContent = row.label;
    const meta = document.createElement("span");
    meta.className = "category";
    meta.textContent = `${row.units} sold · ${money(row.profit)} profit`;
    text.append(meta);
    const aside = document.createElement("span");
    aside.className = "aside";
    aside.textContent = money(row.revenue);
    item.append(text, aside);
    list.append(item);
  }
}

function averageHold() {
  const groups = new Map();
  const movements = state.movements
    .filter((movement) => movement.type === "buy" || movement.type === "sell")
    .slice()
    .sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
  for (const movement of movements) {
    const key = movement.itemId || movement.itemName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(movement);
  }
  let weighted = 0;
  let units = 0;
  let unmatched = 0;
  for (const list of groups.values()) {
    const lots = [];
    for (const movement of list) {
      if (movement.type === "buy") {
        if (movement.quantity > 0) lots.push({ at: movement.at, left: movement.quantity });
        continue;
      }
      let need = movement.quantity;
      while (need > 0 && lots.length > 0) {
        const lot = lots[0];
        const days = calendarDaysBetween(lot.at, movement.at);
        if (days == null || days < 0) break;
        const take = Math.min(need, lot.left);
        weighted += days * take;
        units += take;
        need -= take;
        lot.left -= take;
        if (lot.left <= 0) lots.shift();
      }
      unmatched += Math.max(0, need);
    }
  }
  return { days: units > 0 ? weighted / units : null, units, unmatched };
}

function holdNote(hold) {
  if (hold.days == null) return "No sale has an earlier purchase to measure.";
  const measured = `${hold.units} ${hold.units === 1 ? "unit" : "units"} measured from the oldest purchase still unsold.`;
  if (!hold.unmatched) return measured;
  const skipped = `${hold.unmatched} ${hold.unmatched === 1 ? "unit" : "units"} had no earlier purchase.`;
  return `${measured} ${skipped}`;
}

function renderDashboard() {
  const summary = stats();
  const sales = salesList();
  const pending = sales.filter(isPending).reduce((sum, sale) => sum + saleTotal(sale), 0);
  const funds = totalFunds();
  const reprice = state.items.filter(needsReprice);

  const fundsEl = $("#dash-funds");
  fundsEl.textContent = money(funds);
  fundsEl.classList.toggle("neg", funds < 0);
  $("#dash-pending").textContent = money(pending);
  $("#dash-upcoming").textContent = money(sumAmount(state.upcoming));
  $("#dash-reprice").textContent = String(reprice.length);
  $("#dashStock").textContent = `${summary.quantity} on hand · ${money(summary.cost)} total cost`;

  const nowKey = monthKeyFromDate(new Date());
  $("#dashMonths").innerHTML = monthKeys().map((key) => {
    const row = monthBucket(key);
    const prior = monthBucket(shiftMonth(key, -1));
    const now = key === nowKey ? ` <span class="flag">Now</span>` : "";
    return `<tr>
      <td data-label=""><span>${esc(monthLabel(key))}${now}</span></td>
      <td class="num" data-label="Sold">${row.units}</td>
      <td class="num" data-label="Revenue">${money(row.revenue)}</td>
      <td class="num${row.profit < 0 ? " neg" : ""}" data-label="Profit">${money(row.profit)}</td>
      ${changeCell(row.revenue, prior.revenue)}
    </tr>`;
  }).join("");

  renderRank($("#dashCategories"), rankGroups(
    (sale) => saleCategory(sale),
    (sale) => saleCategory(sale),
  ), "No sales yet.");
  renderRank($("#dashItems"), rankGroups(
    (sale) => sale.itemId || sale.itemName,
    (sale) => saleItem(sale)?.name || sale.itemName,
  ), "No sales yet.");

  const hold = averageHold();
  $("#dashDelta").textContent = formatDays(hold.days);
  $("#dashDeltaNote").textContent = holdNote(hold);
}

function saleCategory(sale) {
  return saleItem(sale)?.category || "General";
}

function renderSales() {
  const query = $("#saleSearch").value;
  const orders = orderGroups(salesList());
  const matched = orders.filter((order) => textMatch(
    query,
    ...order.lines.flatMap((sale) => [sale.itemName, saleItem(sale)?.condition || ""]),
  ));
  const shown = query.trim() ? matched : orders;
  const totals = salesTotals(shown.flatMap((order) => order.lines));
  $("#sale-count").textContent = String(shown.length);
  $("#sale-revenue").textContent = money(totals.revenue);
  $("#sale-profit").textContent = money(totals.profit);
  const message = salesList().length === 0
    ? "No orders yet."
    : "Nothing in this view.";
  fillTable($("#saleRows"), shown, 7, message, (order) => {
    const quantity = order.lines.reduce((sum, sale) => sum + sale.quantity, 0);
    const total = order.lines.reduce((sum, sale) => sum + saleTotal(sale), 0);
    const profit = order.lines.reduce((sum, sale) => sum + (sale.profit || 0), 0);
    const pending = order.lines.some(isPending);
    const payment = pending
      ? `<span class="flag">COP/COD</span> <button type="button" class="texty" data-received="${esc(order.id)}">Credit</button>`
      : "Cash/Bank Transfer";
    const names = order.lines.map((sale) => {
      const qty = order.lines.length > 1 ? ` × ${sale.quantity}` : "";
      return `<span>${esc(saleTitle(sale))}${qty}</span>`;
    }).join("");
    const label = esc(orderTitle(order.lines));
    const armed = saleDeleteArmedId === order.id;
    return `<tr>
      <td data-label="Date"><span><time datetime="${esc(order.at)}">${esc(formatWhen(order.at))}</time></span></td>
      <td class="order-names" data-label="">${names}</td>
      <td class="num" data-label="Qty">${quantity}</td>
      <td class="num" data-label="Total">${money(total)}</td>
      <td class="num${profit < 0 ? " neg" : ""}" data-label="Profit">${money(profit)}</td>
      <td data-label="Payment">${payment}</td>
      <td class="actions" data-label="">
        <div class="row-actions">
          <button type="button" class="icon-act" data-sale="edit" data-id="${esc(order.id)}" aria-label="Edit order of ${label}">${ICON_PENCIL}</button>
          <button type="button" class="icon-act${armed ? " armed" : ""}" data-sale="delete" data-id="${esc(order.id)}" aria-label="${armed ? `Confirm remove order of ${label}` : `Remove order of ${label}`}">${ICON_TRASH}</button>
        </div>
      </td>
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
  renderSort();
  renderRows();
  renderMovements();
  renderSales();
  renderExpenses();
  renderUpcoming();
  renderInvestors();
}

const ITEM_TYPES = ["Game", "Hardware", "Accessory"];

const ITEM_CONDITIONS = {
  Game: ["Complete w/ Case", "Cartridge Only"],
  Hardware: ["Complete w/ Box & Charger", "Complete Accessories", "Charger Only", "Unit Only", "Others"],
  Accessory: [],
};

function fillTypes(selected) {
  const select = $("#itemForm").category;
  const values = !selected || ITEM_TYPES.includes(selected) ? ITEM_TYPES : [selected, ...ITEM_TYPES];
  select.innerHTML = values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  select.value = selected && values.includes(selected) ? selected : ITEM_TYPES[0];
}

function fillConditions(type, selected) {
  const field = $("#field-condition");
  const select = $("#itemForm").condition;
  const options = ITEM_CONDITIONS[type] || [];
  $("#field-type").classList.toggle("wide", options.length === 0);
  if (options.length === 0) {
    field.hidden = true;
    select.required = false;
    select.innerHTML = "";
    select.setCustomValidity("");
    return;
  }
  field.hidden = false;
  select.required = true;
  const values = selected && !options.includes(selected) ? [selected, ...options] : options;
  select.innerHTML = values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
  select.value = selected && values.includes(selected) ? selected : options[0];
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
  if (form.cost.value === "" || form.price.value === "") {
    preview.textContent = "Profit appears once buy and sell prices are set.";
    preview.classList.remove("neg");
    return;
  }
  const profit = Math.max(0, cents(form.price.value || 0)) - Math.max(0, cents(form.cost.value || 0));
  const quantity = $("#field-quantity").hidden ? 1 : Math.max(0, int(form.quantity.value));
  preview.textContent = quantity > 1
    ? `${money(profit)} profit each · ${money(profit * quantity)} for ${quantity}`
    : `${money(profit)} profit`;
  preview.classList.toggle("neg", profit < 0);
}

function setItemQuantityField(adding) {
  const field = $("#field-quantity");
  const input = $("#itemForm").quantity;
  field.hidden = false;
  input.disabled = false;
  input.required = true;
  input.min = adding ? "1" : "0";
}

function openItemDialog(id) {
  const form = $("#itemForm");
  const item = id ? itemById(id) : null;
  editingId = item ? item.id : null;
  setRemoveArmed(false);
  form.reset();
  $("#itemHeading").textContent = item ? "Edit item" : "New item";
  $("#removeBtn").hidden = !item;
  setItemQuantityField(!item);

  if (item) {
    form.name.value = item.name;
    form.quantity.value = String(item.quantity);
    fillTypes(item.category);
    fillConditions(form.category.value, item.condition || "");
    form.cost.value = (item.cost / 100).toFixed(2);
    form.price.value = (item.price / 100).toFixed(2);
    form.notes.value = item.notes;
  } else {
    fillTypes("Game");
    fillConditions("Game", "");
  }

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
  const existing = editingId ? itemById(editingId) : null;
  const type = form.category.value;
  const hasCondition = (ITEM_CONDITIONS[type] || []).length > 0;
  return {
    name: form.name.value.trim(),
    category: type,
    condition: hasCondition ? form.condition.value : "",
    quantity: existing ? Math.max(0, int(form.quantity.value)) : Math.max(1, int(form.quantity.value)),
    cost: Math.max(0, cents(form.cost.value)),
    price: Math.max(0, cents(form.price.value)),
    reorderAt: existing ? existing.reorderAt : 0,
    notes: form.notes.value.trim(),
  };
}

function onItemSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const nameOk = requireText(form.name, "Enter a name.");
  const typeOk = requireText(form.category, "Choose a type.");
  const needsCondition = (ITEM_CONDITIONS[form.category.value] || []).length > 0;
  const conditionOk = needsCondition ? requireText(form.condition, "Choose a condition.") : true;
  if (!editingId) {
    const quantity = int(form.quantity.value);
    form.quantity.setCustomValidity(quantity < 1 ? "Add at least 1." : "");
  }
  if (!nameOk || !typeOk || !conditionOk || !form.reportValidity()) return;

  const draft = readItemForm(form);
  if (editingId) {
    const item = itemById(editingId);
    if (!item) return;
    const previousQty = item.quantity;
    Object.assign(item, draft);
    if (draft.quantity !== previousQty) {
      pushMovement({
        type: "recount",
        itemId: item.id,
        itemName: item.name,
        quantity: item.quantity,
        unitCost: previousQty,
      });
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
    ui.query = "";
    $("#search").value = "";
    flash(item.id);
    notify(item.quantity > 1 ? `Added ${item.quantity} × ${item.name}.` : `Added ${item.name}.`);
  }

  save();
  render();
  $("#itemDialog").close();
}

function deleteItem(id) {
  if (deleteArmedId !== id) {
    deleteArmedId = id;
    render();
    return;
  }
  const item = itemById(id);
  if (!item) return;
  state.items = state.items.filter((entry) => entry.id !== id);
  deleteArmedId = null;
  notify(`Removed ${item.name}.`);
  save();
  render();
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

function releasedQty(itemId) {
  if (!orderDraft) return 0;
  const previous = salesList()
    .filter((sale) => orderKey(sale) === orderDraft.id && sale.itemId === itemId)
    .reduce((sum, sale) => sum + sale.quantity, 0);
  const stillHeld = orderDraft.lines
    .filter((line) => line.itemId === itemId)
    .reduce((sum, line) => sum + (line.held || 0), 0);
  return Math.max(0, previous - stillHeld);
}

function lineAvailable(line) {
  const item = itemById(line.itemId);
  return (item ? item.quantity : 0) + (line.held || 0);
}

function freshLine(item, held = 0) {
  return {
    lineId: uid(),
    itemId: item.id,
    itemName: item.name,
    quantity: 1,
    unitPrice: item.price,
    unitCost: item.cost,
    held,
  };
}

function lineFromSale(sale) {
  return {
    lineId: uid(),
    itemId: sale.itemId,
    itemName: sale.itemName,
    quantity: sale.quantity,
    unitPrice: sale.unitPrice || 0,
    unitCost: sale.unitCost || 0,
    held: sale.quantity,
  };
}

function orderGameChoices() {
  const taken = new Set(orderDraft.lines.map((line) => line.itemId));
  return state.items
    .filter((item) => !taken.has(item.id) && item.quantity + releasedQty(item.id) > 0)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readOrderLines() {
  if (!orderDraft) return;
  for (const line of orderDraft.lines) {
    const row = document.querySelector(`#orderLines [data-line="${CSS.escape(line.lineId)}"]`);
    if (!row) continue;
    line.quantity = Math.max(0, int(row.querySelector("[data-field=qty]").value));
    line.unitPrice = Math.max(0, cents(row.querySelector("[data-field=price]").value || 0));
  }
}

function updateOrderPreview() {
  const preview = $("#sellPreview");
  const lines = orderDraft ? orderDraft.lines : [];
  if (!lines.length) {
    preview.textContent = "Add a game to this order.";
    preview.classList.remove("neg");
    return;
  }
  const revenue = lines.reduce((sum, line) => sum + (line.unitPrice || 0) * line.quantity, 0);
  const profit = lines.reduce((sum, line) => sum + ((line.unitPrice || 0) - (line.unitCost || 0)) * line.quantity, 0);
  const games = `${lines.length} ${lines.length === 1 ? "game" : "games"}`;
  const waiting = $("#sellForm").terms.value === "cop" ? " · COP/COD pending" : "";
  preview.textContent = `${games} · ${money(revenue)} · ${money(profit)} profit${waiting}`;
  preview.classList.toggle("neg", profit < 0);
}

function renderOrderEditor() {
  const list = $("#orderLines");
  if (!orderDraft.lines.length) {
    list.innerHTML = `<li class="empty">Add a game to this order.</li>`;
  } else {
    list.innerHTML = orderDraft.lines.map((line) => {
      const available = lineAvailable(line);
      const item = itemById(line.itemId);
      const meta = item
        ? `${available} available · cost ${money(line.unitCost || 0)}`
        : `Recorded cost ${money(line.unitCost || 0)}`;
      return `<li data-line="${esc(line.lineId)}">
        <div class="order-about">
          <p class="order-title">${esc(saleTitle(line))}</p>
          <p class="order-meta">${esc(meta)}</p>
        </div>
        <label>
          <span>Qty</span>
          <input data-field="qty" type="number" min="1" max="${available}" step="1" inputmode="numeric" value="${line.quantity}" aria-label="Quantity of ${esc(saleTitle(line))}">
        </label>
        <label>
          <span>Price</span>
          <input data-field="price" type="number" min="0" step="0.01" inputmode="decimal" value="${((line.unitPrice || 0) / 100).toFixed(2)}" aria-label="Sale price of ${esc(saleTitle(line))}">
        </label>
        <button type="button" class="quiet" data-remove-line="${esc(line.lineId)}">Remove</button>
      </li>`;
    }).join("");
  }

  const choices = orderGameChoices();
  const select = $("#orderItem");
  select.replaceChildren();
  if (!choices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No games in stock";
    select.append(option);
    select.disabled = true;
    $("#orderAdd").disabled = true;
  } else {
    select.disabled = false;
    $("#orderAdd").disabled = false;
    for (const item of choices) {
      const option = document.createElement("option");
      option.value = item.id;
      const condition = item.condition ? ` · ${item.condition}` : "";
      const available = item.quantity + releasedQty(item.id);
      option.textContent = `${item.name}${condition} · ${available} available`;
      select.append(option);
    }
  }
  updateOrderPreview();
}

function showOrderDialog() {
  renderOrderEditor();
  rememberFocus();
  $("#sellDialog").showModal();
  const qty = $("#orderLines [data-field=qty]");
  if (qty) {
    qty.focus();
    qty.select();
  } else if (!$("#orderItem").disabled) {
    $("#orderItem").focus();
  }
}

function openOrder(lines, existing) {
  orderDraft = {
    id: existing ? existing.id : uid(),
    at: existing ? existing.at : "",
    lines,
  };
  const form = $("#sellForm");
  form.reset();
  form.terms.value = existing?.pending ? "cop" : "paid";
  $("#sellHeading").textContent = existing ? "Edit order" : "New order";
  $("#sellSubmit").textContent = existing ? "Save order" : "Record order";
  showOrderDialog();
}

function openNewOrder() {
  openOrder([]);
}

function openSaleEdit(id) {
  const lines = salesList().filter((sale) => orderKey(sale) === id);
  if (!lines.length) return;
  const at = lines.reduce((earliest, sale) => String(sale.at) < String(earliest) ? sale.at : earliest, lines[0].at);
  openOrder(lines.map(lineFromSale), { id, at, pending: lines.some(isPending) });
}

function addOrderGame() {
  if (!orderDraft) return;
  readOrderLines();
  const item = itemById($("#orderItem").value);
  if (!item || item.quantity < 1) return;
  orderDraft.lines.push(freshLine(item, releasedQty(item.id)));
  renderOrderEditor();
  const added = [...$("#orderLines").querySelectorAll("[data-field=qty]")].at(-1);
  if (added) {
    added.focus();
    added.select();
  }
}

function deleteSale(id) {
  if (saleDeleteArmedId !== id) {
    saleDeleteArmedId = id;
    render();
    return;
  }
  const lines = salesList().filter((sale) => orderKey(sale) === id);
  if (!lines.length) return;
  const before = totalFunds();
  for (const sale of lines) {
    const item = movementItem(sale);
    if (item) item.quantity += sale.quantity;
  }
  state.movements = state.movements.filter((movement) => !(movement.type === "sell" && orderKey(movement) === id));
  saleDeleteArmedId = null;
  notify(`Removed order of ${orderTitle(lines)}.${fundsChangeNote(before)}`);
  save();
  render();
}

function openFundsDialog() {
  const form = $("#fundsForm");
  form.amount.value = (totalFunds() / 100).toFixed(2);
  rememberFocus();
  $("#fundsDialog").showModal();
  form.amount.focus();
  form.amount.select();
}

function onFundsSubmit(event) {
  event.preventDefault();
  const next = cents(event.currentTarget.amount.value);
  state.fundsAdjustment = next - computedFunds();
  notify(`Total funds set to ${money(next)}.`);
  save();
  render();
  $("#fundsDialog").close();
}

function onSellSubmit(event) {
  event.preventDefault();
  if (!orderDraft) return;
  readOrderLines();
  const lines = orderDraft.lines;
  if (!lines.length) {
    notify("Add a game to the order.");
    return;
  }
  for (const line of lines) {
    const available = lineAvailable(line);
    if (line.quantity < 1) {
      notify(`Enter a quantity for ${line.itemName}.`);
      return;
    }
    if (line.quantity > available) {
      notify(`Only ${available} ${line.itemName} available.`);
      return;
    }
  }

  const before = totalFunds();
  const pending = event.currentTarget.terms.value === "cop";
  const previous = salesList().filter((sale) => orderKey(sale) === orderDraft.id);
  for (const sale of previous) {
    const item = movementItem(sale);
    if (item) item.quantity += sale.quantity;
  }
  state.movements = state.movements.filter((movement) => !(movement.type === "sell" && orderKey(movement) === orderDraft.id));
  const priorTerms = previous.map((sale) => sale.terms).filter(Boolean);
  const terms = pending
    ? (priorTerms.length && priorTerms.every((term) => term === priorTerms[0]) ? priorTerms[0] : "cop")
    : null;
  const at = orderDraft.at || new Date().toISOString();
  for (const line of lines) {
    const item = itemById(line.itemId);
    if (item) item.quantity = Math.max(0, item.quantity - line.quantity);
    pushMovement({
      id: `${orderDraft.id}~${uid()}`,
      type: "sell",
      itemId: line.itemId,
      itemName: line.itemName,
      quantity: line.quantity,
      unitCost: line.unitCost || 0,
      unitPrice: line.unitPrice,
      profit: ((line.unitPrice || 0) - (line.unitCost || 0)) * line.quantity,
      at,
      ...(terms ? { terms } : {}),
    });
    if (item) flash(item.id);
  }
  const title = orderTitle(lines);
  const count = `${lines.length} ${lines.length === 1 ? "game" : "games"}`;
  notify(previous.length
    ? `Updated order of ${title}.${fundsChangeNote(before)}`
    : pending
      ? `Recorded ${count}: ${title} · COP/COD pending.`
      : `Recorded ${count}: ${title}.${fundsChangeNote(before)}`);
  orderDraft = null;
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

function creditSales(sales, label) {
  const pending = sales.filter(isPending);
  if (pending.length === 0) return;
  const amount = pending.reduce((sum, sale) => sum + saleTotal(sale), 0);
  for (const sale of pending) delete sale.terms;
  notify(`Credited ${money(amount)} for ${label}.`);
  save();
  render();
}

function creditItem(id) {
  const item = itemById(id);
  if (!item) return;
  const lines = pendingOrderSales(item);
  creditSales(lines, orderTitle(lines) || item.name);
}

function markReceived(id) {
  const lines = salesList().filter((sale) => orderKey(sale) === id);
  creditSales(lines, orderTitle(lines));
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

function renderAdminList(admins) {
  const list = $("#adminList");
  list.replaceChildren();
  if (!admins.length) {
    const item = document.createElement("li");
    item.textContent = "No admins yet.";
    list.append(item);
    return;
  }
  for (const admin of admins) {
    const item = document.createElement("li");
    item.textContent = admin.email;
    list.append(item);
  }
}

async function openAdmins() {
  if (!supabase || !userId) return;
  const result = await supabase.rpc("shop_context");
  if (result.error) {
    notify(result.error.message);
    return;
  }
  renderAdminList(result.data?.admins || []);
  const form = $("#adminsForm");
  form.email.value = "";
  rememberFocus();
  $("#adminsDialog").showModal();
  form.email.focus();
}

async function onAdminSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim();
  const result = await supabase.rpc("add_admin", { admin_email: email });
  if (result.error) {
    notify(result.error.message);
    return;
  }
  form.email.value = "";
  const current = await supabase.rpc("shop_context");
  if (!current.error) renderAdminList(current.data?.admins || []);
  notify(`Added ${email}.`);
}

async function reloadSharedLedger() {
  if (!userId || dirty || saving) return;
  try {
    const ledger = await fetchLedger(userId);
    if (dirty || saving) return;
    ledger.fundsAdjustment = await loadFundsAdjustment(userId);
    state = ledger;
    rememberLoaded(ledger);
    render();
  } catch (error) {
    notify(error.message || "Could not refresh the ledger.");
  }
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
  $("#authRetry").addEventListener("click", async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) openLedger(data.session);
  });
  $("#authLeave").addEventListener("click", signOut);
  $("#signOutBtn").addEventListener("click", signOut);
  $("#adminsBtn").addEventListener("click", openAdmins);
  $("#adminsForm").addEventListener("submit", onAdminSubmit);
  window.addEventListener("focus", reloadSharedLedger);

  $("#addBtn").addEventListener("click", () => {
    if (ui.tab === "inventory") openItemDialog(null);
    else if (ui.tab === "sales") openNewOrder();
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
  window.addEventListener("resize", placeTabIndicator);
  document.fonts?.ready.then(placeTabIndicator);

  $("#search").addEventListener("input", (event) => {
    ui.query = event.target.value;
    render();
  });

  for (const id of ["saleSearch", "expenseSearch", "upcomingSearch", "investorSearch"]) {
    $(`#${id}`).addEventListener("input", () => render());
  }

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

  $("#dash-funds").addEventListener("click", openFundsDialog);
  $("#fundsForm").addEventListener("submit", onFundsSubmit);

  $("#panel-inventory").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const { id, action } = button.dataset;
    if (action === "delete") {
      movementDeleteArmedId = null;
      deleteItem(id);
      return;
    }
    if (action === "credit") {
      deleteArmedId = null;
      movementDeleteArmedId = null;
      creditItem(id);
      return;
    }
    const wasArmed = deleteArmedId != null || movementDeleteArmedId != null;
    deleteArmedId = null;
    movementDeleteArmedId = null;
    if (wasArmed) render();
    if (action === "edit") openItemDialog(id);
  });

  $("#movementList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-movement]");
    if (!button) return;
    event.stopPropagation();
    deleteStockChange(button.dataset.movement);
  });

  $("#itemForm").addEventListener("submit", onItemSubmit);
  $("#itemForm").addEventListener("input", (event) => {
    if (event.target.name === "name" || event.target.name === "category" || event.target.name === "condition" || event.target.name === "quantity") {
      event.target.setCustomValidity("");
    }
    if (event.target.name === "category") fillConditions(event.target.value, "");
    setRemoveArmed(false);
    updateItemPreview();
  });
  $("#removeBtn").addEventListener("click", removeItem);

  $("#saleRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-sale]");
    if (!button) return;
    const { id, sale } = button.dataset;
    if (sale === "delete") {
      deleteSale(id);
      return;
    }
    const wasArmed = saleDeleteArmedId != null;
    saleDeleteArmedId = null;
    if (wasArmed) render();
    if (sale === "edit") openSaleEdit(id);
  });

  $("#sellForm").addEventListener("submit", onSellSubmit);
  $("#sellForm").addEventListener("input", () => {
    readOrderLines();
    updateOrderPreview();
  });
  $("#sellForm").addEventListener("change", (event) => {
    if (event.target.name === "terms") updateOrderPreview();
  });
  $("#orderAdd").addEventListener("click", addOrderGame);
  $("#orderItem").addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addOrderGame();
  });
  $("#orderLines").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-line]");
    if (!button || !orderDraft) return;
    readOrderLines();
    orderDraft.lines = orderDraft.lines.filter((line) => line.lineId !== button.dataset.removeLine);
    renderOrderEditor();
  });
  $("#orderLines").addEventListener("wheel", (event) => {
    const input = event.target.closest("input");
    if (input && document.activeElement === input) event.preventDefault();
  }, { passive: false });

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
