import { useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

const PARSE_URL = "https://functions.poehali.dev/c32af150-15f2-42b4-8d7a-fa9401b70b04";

interface Item {
  id: string;
  type: "book" | "item1" | "item2" | "item3";
  label: string;
  url: string;
  title: string;
  image: string;
  price: number | null;
  manualPrice: string;
  loading: boolean;
  error: string;
}

interface Bundle {
  id: string;
  name: string;
  items: Item[];
  markup: string;
}

function makeItem(type: Item["type"], label: string): Item {
  return {
    id: crypto.randomUUID(),
    type,
    label,
    url: "",
    title: "",
    image: "",
    price: null,
    manualPrice: "",
    loading: false,
    error: "",
  };
}

function makeBundle(name = "Новый набор"): Bundle {
  return {
    id: crypto.randomUUID(),
    name,
    items: [
      makeItem("book", "Книга"),
      makeItem("item1", "Предмет 1"),
      makeItem("item2", "Предмет 2"),
      makeItem("item3", "Предмет 3"),
    ],
    markup: "0",
  };
}

function formatPrice(val: number) {
  return val.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

function ItemCard({
  item,
  onChange,
  onFetch,
}: {
  item: Item;
  onChange: (id: string, field: keyof Item, value: string) => void;
  onFetch: (id: string) => void;
}) {
  const isBook = item.type === "book";

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-golos font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {item.label}
        {isBook && (
          <span className="ml-2 text-primary font-normal normal-case tracking-normal">
            — основа набора
          </span>
        )}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Вставьте ссылку на товар..."
          value={item.url}
          onChange={(e) => onChange(item.id, "url", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && item.url && onFetch(item.id)}
          className="flex-1 text-sm font-golos px-3 py-2 rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
        />
        <button
          onClick={() => item.url && onFetch(item.id)}
          disabled={!item.url || item.loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-golos font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {item.loading ? (
            <Icon name="Loader2" size={15} className="animate-spin" />
          ) : (
            <Icon name="ArrowRight" size={15} />
          )}
          {item.loading ? "Загрузка" : "Получить"}
        </button>
      </div>

      {item.error && (
        <p className="text-xs text-destructive font-golos">{item.error}</p>
      )}

      {(item.image || item.title || item.price !== null) && (
        <div className="flex gap-3 mt-1 p-3 rounded bg-card border border-border">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="w-14 h-14 object-cover rounded flex-shrink-0 bg-muted"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            {item.title && (
              <p className="text-sm font-golos text-foreground line-clamp-2 leading-snug mb-1">
                {item.title}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {item.price !== null && (
                <span className="text-sm font-golos font-semibold text-primary">
                  {formatPrice(item.price)}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-golos">
                  Цена вручную:
                </span>
                <input
                  type="number"
                  placeholder="0"
                  value={item.manualPrice}
                  onChange={(e) =>
                    onChange(item.id, "manualPrice", e.target.value)
                  }
                  className="w-24 text-sm font-golos px-2 py-1 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-xs text-muted-foreground">₽</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!item.image && !item.title && item.price === null && (
        <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded border border-dashed border-border">
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

function BundleCard({
  bundle,
  onUpdate,
  onDelete,
  isActive,
  onActivate,
}: {
  bundle: Bundle;
  onUpdate: (bundle: Bundle) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
  onActivate: (id: string) => void;
}) {
  const getEffectivePrice = (item: Item) => {
    if (item.manualPrice && parseFloat(item.manualPrice) > 0)
      return parseFloat(item.manualPrice);
    return item.price ?? 0;
  };

  const subtotal = bundle.items.reduce(
    (sum, item) => sum + getEffectivePrice(item),
    0
  );
  const markupVal = parseFloat(bundle.markup) || 0;
  const total = subtotal + markupVal;

  const fetchItem = useCallback(
    async (itemId: string) => {
      const item = bundle.items.find((i) => i.id === itemId);
      if (!item) return;

      onUpdate({
        ...bundle,
        items: bundle.items.map((i) =>
          i.id === itemId ? { ...i, loading: true, error: "" } : i
        ),
      });

      try {
        const res = await fetch(PARSE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url }),
        });
        const raw = await res.text();
        let data: { title?: string; image?: string; price?: number | null; error?: string };
        try { data = JSON.parse(raw); } catch { data = JSON.parse(JSON.parse(raw)); }

        if (!res.ok) throw new Error(data.error || "Не удалось получить данные");

        onUpdate({
          ...bundle,
          items: bundle.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  loading: false,
                  title: data.title || "",
                  image: data.image || "",
                  price: data.price ?? null,
                  error: "",
                }
              : i
          ),
        });
      } catch (e: unknown) {
        onUpdate({
          ...bundle,
          items: bundle.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  loading: false,
                  error:
                    e instanceof Error
                      ? e.message
                      : "Не удалось загрузить данные",
                }
              : i
          ),
        });
      }
    },
    [bundle, onUpdate]
  );

  const handleItemChange = (id: string, field: keyof Item, value: string) => {
    onUpdate({
      ...bundle,
      items: bundle.items.map((i) =>
        i.id === id ? { ...i, [field]: value } : i
      ),
    });
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        isActive
          ? "border-primary shadow-sm"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer"
        onClick={() => onActivate(bundle.id)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon
            name={isActive ? "ChevronDown" : "ChevronRight"}
            size={16}
            className="text-muted-foreground flex-shrink-0"
          />
          <input
            type="text"
            value={bundle.name}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              onUpdate({ ...bundle, name: e.target.value })
            }
            className="font-cormorant text-xl bg-transparent border-none outline-none text-foreground min-w-0 flex-1"
          />
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-xs font-golos text-muted-foreground">
              Итого
            </div>
            <div className="font-cormorant text-lg font-semibold text-primary">
              {formatPrice(total)}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(bundle.id);
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Icon name="Trash2" size={15} />
          </button>
        </div>
      </div>

      {isActive && (
        <div className="px-5 pb-5 border-t border-border">
          <div className="grid gap-5 mt-5">
            {bundle.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onChange={handleItemChange}
                onFetch={fetchItem}
              />
            ))}
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-golos text-muted-foreground">
                  Наценка / доп. расходы:
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="0"
                    value={bundle.markup}
                    onChange={(e) =>
                      onUpdate({ ...bundle, markup: e.target.value })
                    }
                    className="w-24 text-sm font-golos px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-xs text-muted-foreground">₽</span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs font-golos text-muted-foreground mb-0.5">
                    Себестоимость
                  </div>
                  <div className="font-golos font-semibold text-foreground">
                    {formatPrice(subtotal)}
                  </div>
                </div>
                {markupVal > 0 && (
                  <div className="text-right">
                    <div className="text-xs font-golos text-muted-foreground mb-0.5">
                      Наценка
                    </div>
                    <div className="font-golos text-muted-foreground">
                      +{formatPrice(markupVal)}
                    </div>
                  </div>
                )}
                <div className="text-right">
                  <div className="text-xs font-golos text-muted-foreground mb-0.5">
                    Итоговая цена набора
                  </div>
                  <div className="font-cormorant text-2xl font-semibold text-primary">
                    {formatPrice(total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Index() {
  const [bundles, setBundles] = useState<Bundle[]>([makeBundle("Набор «Уютный вечер»")]);
  const [activeId, setActiveId] = useState<string>(bundles[0].id);

  const addBundle = () => {
    const b = makeBundle(`Набор ${bundles.length + 1}`);
    setBundles((prev) => [...prev, b]);
    setActiveId(b.id);
  };

  const updateBundle = (updated: Bundle) => {
    setBundles((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const deleteBundle = (id: string) => {
    setBundles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (activeId === id && next.length > 0) setActiveId(next[0].id);
      return next;
    });
  };

  const totalAll = bundles.reduce((sum, b) => {
    const subtotal = b.items.reduce((s, item) => {
      const p =
        item.manualPrice && parseFloat(item.manualPrice) > 0
          ? parseFloat(item.manualPrice)
          : item.price ?? 0;
      return s + p;
    }, 0);
    return sum + subtotal + (parseFloat(b.markup) || 0);
  }, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-cormorant text-2xl text-foreground">
              Книжные наборы
            </h1>
            <p className="text-xs font-golos text-muted-foreground mt-0.5">
              Конструктор и расчёт стоимости
            </p>
          </div>
          {bundles.length > 1 && (
            <div className="text-right">
              <div className="text-xs font-golos text-muted-foreground">
                Все наборы ({bundles.length})
              </div>
              <div className="font-cormorant text-xl font-semibold text-primary">
                {formatPrice(totalAll)}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-cormorant text-3xl italic text-foreground">
              Ваши наборы
            </h2>
            <p className="text-sm font-golos text-muted-foreground mt-1">
              Вставьте ссылку на товар — цена и фото подтянутся автоматически
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

        {bundles.length === 0 && (
          <div className="text-center py-20 text-muted-foreground font-golos">
            <Icon name="BookOpen" size={40} className="mx-auto mb-4 opacity-30" />
            <p>Нет наборов. Создайте первый!</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {bundles.map((bundle) => (
            <BundleCard
              key={bundle.id}
              bundle={bundle}
              onUpdate={updateBundle}
              onDelete={deleteBundle}
              isActive={activeId === bundle.id}
              onActivate={setActiveId}
            />
          ))}
        </div>

        {bundles.length > 0 && (
          <div className="mt-8 p-5 rounded-lg bg-card border border-border">
            <h3 className="font-cormorant text-xl text-foreground mb-4">
              Сводка по всем наборам
            </h3>
            <div className="divide-y divide-border">
              {bundles.map((b) => {
                const subtotal = b.items.reduce((s, item) => {
                  const p =
                    item.manualPrice && parseFloat(item.manualPrice) > 0
                      ? parseFloat(item.manualPrice)
                      : item.price ?? 0;
                  return s + p;
                }, 0);
                const total = subtotal + (parseFloat(b.markup) || 0);
                const filled = b.items.filter(
                  (i) =>
                    i.price !== null ||
                    (i.manualPrice && parseFloat(i.manualPrice) > 0)
                ).length;
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <span className="font-golos text-sm text-foreground">
                        {b.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-golos ml-2">
                        {filled} / {b.items.length} позиций заполнено
                      </span>
                    </div>
                    <span className="font-cormorant text-lg text-primary">
                      {formatPrice(total)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-border">
              <span className="font-golos font-medium text-foreground">
                Общая стоимость всех наборов
              </span>
              <span className="font-cormorant text-2xl font-semibold text-primary">
                {formatPrice(totalAll)}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
