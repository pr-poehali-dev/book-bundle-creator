import { useState, useCallback, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const AUTH_URL = "https://functions.poehali.dev/c827d266-7636-4121-935a-c1690b72be57";
const BUNDLES_URL = "https://functions.poehali.dev/827a6575-dfb0-4a95-98bf-35f4d3f0cef4";
const PARSE_URL = "https://functions.poehali.dev/c32af150-15f2-42b4-8d7a-fa9401b70b04";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  type: "book" | "item1" | "item2" | "item3";
  label: string;
  url: string;
  imageUrl: string;
  imageParsed: string;
  title: string;
  price: number | null;
  manualPrice: string;
  loading: boolean;
  error: string;
}

interface Bundle {
  id: string;
  name: string;
  categoryId: string;
  items: Item[];
  markup: string;
}

interface Category {
  id: string;
  name: string;
}

interface AppData {
  bundles: Bundle[];
  categories: Category[];
}

interface AuthState {
  userId: number;
  username: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeItem(type: Item["type"], label: string): Item {
  return { id: crypto.randomUUID(), type, label, url: "", imageUrl: "", imageParsed: "", title: "", price: null, manualPrice: "", loading: false, error: "" };
}

function makeBundle(categoryId = ""): Bundle {
  return {
    id: crypto.randomUUID(),
    name: "Новый набор",
    categoryId,
    items: [
      makeItem("book", "Книга"),
      makeItem("item1", "Предмет 1"),
      makeItem("item2", "Предмет 2"),
      makeItem("item3", "Предмет 3"),
    ],
    markup: "0",
  };
}

function makeCategory(name = "Новая категория"): Category {
  return { id: crypto.randomUUID(), name };
}

function fmt(val: number) {
  return val.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

function getEffectivePrice(item: Item) {
  if (item.manualPrice && parseFloat(item.manualPrice) > 0) return parseFloat(item.manualPrice);
  return item.price ?? 0;
}

function bundleTotal(b: Bundle) {
  return b.items.reduce((s, i) => s + getEffectivePrice(i), 0) + (parseFloat(b.markup) || 0);
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function AuthScreen({ onAuth }: { onAuth: (auth: AuthState) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) { setError("Заполните все поля"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username: username.trim(), password }),
      });
      const text = await res.text();
      let data: { token?: string; user_id?: number; username?: string; error?: string };
      try { data = JSON.parse(text); } catch { data = JSON.parse(JSON.parse(text)); }
      if (!res.ok) { setError(data.error || "Ошибка"); return; }
      const auth = { userId: data.user_id!, username: data.username! };
      localStorage.setItem("auth", JSON.stringify(auth));
      onAuth(auth);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-cormorant text-4xl text-foreground mb-1">Книжные наборы</h1>
          <p className="text-sm font-golos text-muted-foreground">Конструктор и расчёт стоимости</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex rounded overflow-hidden border border-border mb-5">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-golos transition-colors ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "login" ? "Войти" : "Зарегистрироваться"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-golos text-muted-foreground mb-1 block uppercase tracking-wider">Логин</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="ваш_логин"
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm font-golos focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-golos text-muted-foreground mb-1 block uppercase tracking-wider">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm font-golos focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {error && <p className="text-xs text-destructive font-golos">{error}</p>}
            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-2.5 rounded bg-primary text-primary-foreground text-sm font-golos font-medium hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
            >
              {loading ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, onChange, onFetch }: {
  item: Item;
  onChange: (id: string, field: keyof Item, value: string) => void;
  onFetch: (id: string) => void;
}) {
  const isBook = item.type === "book";
  const hasData = item.imageUrl || item.imageParsed || item.title || item.price !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-golos font-semibold uppercase tracking-widest text-muted-foreground">
        {item.label}{isBook && <span className="ml-2 text-primary font-normal normal-case tracking-normal">— основа набора</span>}
      </div>

      {/* URL + кнопка */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Ссылка на товар..."
          value={item.url}
          onChange={(e) => onChange(item.id, "url", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && item.url && onFetch(item.id)}
          className="flex-1 text-sm font-golos px-3 py-2 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => item.url && onFetch(item.id)}
          disabled={!item.url || item.loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-golos font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {item.loading ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Sparkles" size={14} />}
          {item.loading ? "..." : "Авто"}
        </button>
      </div>

      {/* Отдельная ссылка на картинку */}
      <div className="flex gap-2 items-center">
        <Icon name="Image" size={14} className="text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          placeholder="Ссылка на картинку (необязательно)"
          value={item.imageUrl}
          onChange={(e) => onChange(item.id, "imageUrl", e.target.value)}
          className="flex-1 text-xs font-golos px-3 py-1.5 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {item.error && <p className="text-xs text-destructive font-golos">{item.error}</p>}

      {/* Карточка с данными */}
      {hasData && (
        <div className="flex gap-3 p-3 rounded bg-card border border-border">
          {(item.imageUrl || item.imageParsed) && (
            <img
              src={item.imageUrl || item.imageParsed}
              alt={item.title}
              className="w-14 h-14 object-cover rounded flex-shrink-0 bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            {item.title && <p className="text-sm font-golos text-foreground line-clamp-2 leading-snug mb-1">{item.title}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              {item.price !== null && (
                <span className="text-sm font-golos font-semibold text-primary">{fmt(item.price)}</span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-golos">Цена вручную:</span>
                <input
                  type="number"
                  placeholder="0"
                  value={item.manualPrice}
                  onChange={(e) => onChange(item.id, "manualPrice", e.target.value)}
                  className="w-24 text-sm font-golos px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">₽</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="flex items-center gap-2 px-3 py-2 rounded border border-dashed border-border">
          <input
            type="number"
            placeholder="Или введите цену вручную"
            value={item.manualPrice}
            onChange={(e) => onChange(item.id, "manualPrice", e.target.value)}
            className="flex-1 text-sm font-golos bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">₽</span>
        </div>
      )}
    </div>
  );
}

// ─── Bundle Card ──────────────────────────────────────────────────────────────

function BundleCard({ bundle, categories, onUpdate, onDelete, isActive, onActivate }: {
  bundle: Bundle;
  categories: Category[];
  onUpdate: (b: Bundle) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
  onActivate: (id: string) => void;
}) {
  const subtotal = bundle.items.reduce((s, i) => s + getEffectivePrice(i), 0);
  const markupVal = parseFloat(bundle.markup) || 0;
  const total = subtotal + markupVal;

  const fetchItem = useCallback(async (itemId: string) => {
    const item = bundle.items.find((i) => i.id === itemId);
    if (!item) return;
    onUpdate({ ...bundle, items: bundle.items.map((i) => i.id === itemId ? { ...i, loading: true, error: "" } : i) });
    try {
      const res = await fetch(PARSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      const text = await res.text();
      let data: { title?: string; image?: string; price?: number | null; error?: string };
      try { data = JSON.parse(text); } catch { data = JSON.parse(JSON.parse(text)); }
      if (!res.ok) throw new Error(data.error || "Не удалось получить данные");
      onUpdate({
        ...bundle,
        items: bundle.items.map((i) => i.id === itemId
          ? { ...i, loading: false, title: data.title || "", imageParsed: data.image || "", price: data.price ?? null, error: "" }
          : i),
      });
    } catch (e: unknown) {
      onUpdate({ ...bundle, items: bundle.items.map((i) => i.id === itemId ? { ...i, loading: false, error: e instanceof Error ? e.message : "Ошибка" } : i) });
    }
  }, [bundle, onUpdate]);

  const handleChange = (id: string, field: keyof Item, value: string) => {
    onUpdate({ ...bundle, items: bundle.items.map((i) => i.id === id ? { ...i, [field]: value } : i) });
  };

  return (
    <div className={`rounded-lg border transition-all ${isActive ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => onActivate(bundle.id)}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon name={isActive ? "ChevronDown" : "ChevronRight"} size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            value={bundle.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onUpdate({ ...bundle, name: e.target.value })}
            className="font-cormorant text-xl bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none text-foreground min-w-0 flex-1 transition-colors cursor-text"
          />
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-xs font-golos text-muted-foreground">Итого</div>
            <div className="font-cormorant text-lg font-semibold text-primary">{fmt(total)}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(bundle.id); }} className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Icon name="Trash2" size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      {isActive && (
        <div className="px-5 pb-5 border-t border-border">
          {/* Категория */}
          <div className="mt-4 flex items-center gap-2">
            <Icon name="Tag" size={14} className="text-muted-foreground" />
            <select
              value={bundle.categoryId}
              onChange={(e) => onUpdate({ ...bundle, categoryId: e.target.value })}
              className="text-sm font-golos px-2 py-1 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Без категории</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid gap-5 mt-4">
            {bundle.items.map((item) => (
              <ItemCard key={item.id} item={item} onChange={handleChange} onFetch={fetchItem} />
            ))}
          </div>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-golos text-muted-foreground">Наценка:</span>
              <input
                type="number"
                placeholder="0"
                value={bundle.markup}
                onChange={(e) => onUpdate({ ...bundle, markup: e.target.value })}
                className="w-24 text-sm font-golos px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">₽</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs font-golos text-muted-foreground mb-0.5">Себестоимость</div>
                <div className="font-golos font-semibold text-foreground">{fmt(subtotal)}</div>
              </div>
              {markupVal > 0 && (
                <div className="text-right">
                  <div className="text-xs font-golos text-muted-foreground mb-0.5">Наценка</div>
                  <div className="font-golos text-muted-foreground">+{fmt(markupVal)}</div>
                </div>
              )}
              <div className="text-right">
                <div className="text-xs font-golos text-muted-foreground mb-0.5">Итого</div>
                <div className="font-cormorant text-2xl font-semibold text-primary">{fmt(total)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Index() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try { return JSON.parse(localStorage.getItem("auth") || "null"); } catch { return null; }
  });
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [newCatName, setNewCatName] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Загрузка данных
  useEffect(() => {
    if (!auth) return;
    setLoadingData(true);
    fetch(BUNDLES_URL, { headers: { "X-User-Id": String(auth.userId) } })
      .then((r) => r.text())
      .then((text) => {
        let data: AppData;
        try { data = JSON.parse(text); } catch { data = JSON.parse(JSON.parse(text)); }
        setBundles(data.bundles || []);
        setCategories(data.categories || []);
        if (data.bundles?.length) setActiveId(data.bundles[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [auth]);

  // Автосохранение с debounce
  const save = useCallback((b: Bundle[], c: Category[]) => {
    if (!auth) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(BUNDLES_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Id": String(auth.userId) },
          body: JSON.stringify({ bundles: b, categories: c }),
        });
      } finally {
        setSaving(false);
      }
    }, 800);
  }, [auth]);

  const updateBundles = (b: Bundle[]) => { setBundles(b); save(b, categories); };
  const updateCategories = (c: Category[]) => { setCategories(c); save(bundles, c); };

  const addBundle = () => {
    const b = makeBundle(filterCat !== "all" ? filterCat : "");
    updateBundles([...bundles, b]);
    setActiveId(b.id);
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    updateCategories([...categories, makeCategory(newCatName.trim())]);
    setNewCatName("");
  };

  const deleteCategory = (id: string) => {
    updateCategories(categories.filter((c) => c.id !== id));
    updateBundles(bundles.map((b) => b.categoryId === id ? { ...b, categoryId: "" } : b));
  };

  const logout = () => {
    localStorage.removeItem("auth");
    setAuth(null);
    setBundles([]);
    setCategories([]);
  };

  if (!auth) return <AuthScreen onAuth={setAuth} />;

  const filteredBundles = filterCat === "all" ? bundles : bundles.filter((b) => b.categoryId === filterCat);
  const totalAll = filteredBundles.reduce((s, b) => s + bundleTotal(b), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-cormorant text-2xl text-foreground">Книжные наборы</h1>
            <p className="text-xs font-golos text-muted-foreground mt-0.5">Конструктор и расчёт стоимости</p>
          </div>
          <div className="flex items-center gap-4">
            {saving && <span className="text-xs font-golos text-muted-foreground flex items-center gap-1"><Icon name="Loader2" size={12} className="animate-spin" />Сохраняю...</span>}
            {!saving && auth && <span className="text-xs font-golos text-muted-foreground">✓ сохранено</span>}
            <button onClick={logout} className="flex items-center gap-1.5 text-xs font-golos text-muted-foreground hover:text-foreground transition-colors">
              <Icon name="LogOut" size={14} />
              {auth.username}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Категории */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <button
              onClick={() => setFilterCat("all")}
              className={`px-3 py-1 rounded-full text-sm font-golos transition-colors ${filterCat === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
            >
              Все наборы
            </button>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-1">
                <button
                  onClick={() => setFilterCat(c.id)}
                  className={`px-3 py-1 rounded-full text-sm font-golos transition-colors ${filterCat === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {c.name}
                </button>
                <button onClick={() => deleteCategory(c.id)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors">
                  <Icon name="X" size={12} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="+ Новая категория"
                className="text-sm font-golos px-3 py-1 rounded-full border border-dashed border-border bg-transparent focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground w-44"
              />
              {newCatName.trim() && (
                <button onClick={addCategory} className="p-1 rounded-full bg-primary text-primary-foreground">
                  <Icon name="Plus" size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Шапка списка */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-cormorant text-3xl italic text-foreground">
              {filterCat === "all" ? "Все наборы" : (categories.find((c) => c.id === filterCat)?.name || "Наборы")}
            </h2>
            <p className="text-sm font-golos text-muted-foreground mt-0.5">
              {filteredBundles.length} {filteredBundles.length === 1 ? "набор" : "наборов"} · итого {fmt(totalAll)}
            </p>
          </div>
          <button
            onClick={addBundle}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-golos font-medium hover:opacity-90 transition-opacity flex-shrink-0 ml-4"
          >
            <Icon name="Plus" size={15} />
            Новый набор
          </button>
        </div>

        {/* Загрузка */}
        {loadingData && (
          <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground font-golos text-sm">
            <Icon name="Loader2" size={18} className="animate-spin" />
            Загружаю данные...
          </div>
        )}

        {/* Пусто */}
        {!loadingData && filteredBundles.length === 0 && (
          <div className="text-center py-16 text-muted-foreground font-golos">
            <Icon name="BookOpen" size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Нет наборов. Нажмите «Новый набор»</p>
          </div>
        )}

        {/* Наборы */}
        <div className="flex flex-col gap-3">
          {filteredBundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              categories={categories}
              onUpdate={(updated) => updateBundles(bundles.map((b) => b.id === updated.id ? updated : b))}
              onDelete={(id) => {
                const next = bundles.filter((b) => b.id !== id);
                updateBundles(next);
                if (activeId === id) setActiveId(next[0]?.id || "");
              }}
              isActive={activeId === bundle.id}
              onActivate={setActiveId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}