import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { Button } from "./components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Badge } from "./components/ui/Badge";
import { Range } from "./components/ui/Range";
import { Modal } from "./components/ui/Modal";
import { AIChat } from "./components/AIChat";

import {
  CATEGORIES, STYLES, FABRICS, OCCASIONS, LOCAL_TYPES,
  safeCategory, safeStyle, safeFabric,
  labelFromCategory, labelFromStyle, labelFromFabric,
  loadFromStorage, saveToStorage, sanitizeItem
} from "./lib/domain";
import { extractDominantColors, nearestColorName } from "./lib/colors";
import { computeSuggestions, computeSuggestionsForItem } from "./lib/ai";
import { recommendOutfitsWithTies, adjustTemperature } from "./lib/recommendation";
import { fileToDataURL, dataURLToImage } from "./lib/utils";
import { isSupabaseConfigured, wardrobeService } from "./lib/supabase";

// MobileNet CDN fallback chain
const MOBILENET_URLS = [
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/+esm",
  "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.esm.min.js",
  "https://esm.sh/@tensorflow-models/mobilenet@2.1.0",
];

async function loadMobileNet() {
  for (const url of MOBILENET_URLS) {
    try {
      const mobilenet = await import(/* @vite-ignore */ url);
      return await mobilenet.load();
    } catch (e) {
      console.warn(`MobileNet failed from ${url}:`, e);
    }
  }
  return null;
}

// ─── Small helper components ────────────────────────────────────────────────

function ImagePreview({ src, alt }) {
  if (!src) {
    return (
      <div className="w-full aspect-[4/5] bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 border-2 border-dashed border-gray-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 16.5V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18v-1.5M16.5 9.75a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
        <span className="text-xs">Selecione uma imagem</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-full aspect-[4/5] object-cover rounded-xl" />;
}

function SuggestionChips({ label, options, onPick, mapLabel, priorityTag }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500 flex items-center gap-1.5">
        {label}
        {priorityTag && <Badge variant="secondary" className="text-[10px]">{priorityTag}</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(v => (
          <button key={v} onClick={() => onPick(v)} className="px-2.5 py-1 rounded-full text-xs border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors">
            {mapLabel(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function HeartIcon({ filled }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

function CategoryBadge({ category }) {
  const colors = {
    top: "bg-blue-50 text-blue-700",
    bottom: "bg-indigo-50 text-indigo-700",
    skirt: "bg-purple-50 text-purple-700",
    dress: "bg-pink-50 text-pink-700",
    outerwear: "bg-orange-50 text-orange-700",
    shoes: "bg-amber-50 text-amber-700",
    accessory: "bg-green-50 text-green-700",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colors[category] || "bg-gray-100 text-gray-600"}`}>
      {labelFromCategory(category)}
    </span>
  );
}

function WardrobeStats({ items }) {
  const byCategory = useMemo(() => {
    const m = {};
    for (const it of items) m[it.category] = (m[it.category] || 0) + 1;
    return m;
  }, [items]);

  const favorites = items.filter(i => i.favorite).length;

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 text-xs text-gray-600 py-1">
      <span className="font-medium text-gray-900">{items.length} peças</span>
      {favorites > 0 && <span className="text-pink-600">♥ {favorites} favoritas</span>}
      {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, count]) => (
        <span key={cat}>{labelFromCategory(cat)}: {count}</span>
      ))}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [items, setItems] = useState([]);
  const [dbReady, setDbReady] = useState(false);
  const [form, setForm] = useState({ title: "", category: "top", style: "casual", fabric: "unknown", colors: [], tags: [], favorite: false });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(null);
  const [mlLabel, setMlLabel] = useState("");
  const [autoApply, setAutoApply] = useState(true);
  const [touched, setTouched] = useState({ category: false, style: false, fabric: false });
  const [occasion, setOccasion] = useState("casual");
  const [temperature, setTemperature] = useState(22);
  const [localType, setLocalType] = useState("indoor");
  const fileInputRef = useRef(null);

  // UX state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newTag, setNewTag] = useState("");

  // ── Data loading (Supabase or localStorage) ──────────────────────────────
  useEffect(() => {
    async function init() {
      if (isSupabaseConfigured) {
        const data = await wardrobeService.getAll();
        if (data !== null) {
          setItems(data.map(sanitizeItem).filter(Boolean));
          setDbReady(true);
          return;
        }
      }
      setItems(loadFromStorage());
      setDbReady(true);
    }
    init();
  }, []);

  // ── Persist to localStorage when Supabase is not configured ──────────────
  useEffect(() => {
    if (dbReady && !isSupabaseConfigured) {
      saveToStorage(items);
    }
  }, [items, dbReady]);

  // ── MobileNet ─────────────────────────────────────────────────────────────
  useEffect(() => { loadMobileNet().then(setModel); }, []);

  const modelReady = !!model;

  const hints = useMemo(() => computeSuggestions({ title: form.title, mlLabel }), [form.title, mlLabel]);

  useEffect(() => {
    if (autoApply) {
      if (hints.category[0] && !touched.category) setForm(f => ({ ...f, category: hints.category[0] }));
      if (hints.style[0] && !touched.style) setForm(f => ({ ...f, style: hints.style[0] }));
      if (hints.fabric[0] && !touched.fabric) setForm(f => ({ ...f, fabric: hints.fabric[0] }));
    }
  }, [hints, autoApply, touched]);

  // ── File handling ─────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const dataURL = await fileToDataURL(file);
      setPreview(dataURL);
      const img = await dataURLToImage(dataURL);
      const [colors, predictions] = await Promise.all([
        extractDominantColors(img, 2),
        model ? model.classify(img) : Promise.resolve([]),
      ]);
      setForm(f => ({ ...f, colors }));
      setMlLabel(predictions[0]?.className || "");
    } catch (e) {
      console.error("Error processing file:", e);
    } finally {
      setBusy(false);
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function addItem() {
    const newItem = sanitizeItem({ ...form, image: preview });
    if (!newItem.image) return;
    setBusy(true);
    try {
      if (isSupabaseConfigured) {
        const saved = await wardrobeService.create(newItem, preview);
        setItems(prev => [saved || newItem, ...prev]);
      } else {
        setItems(prev => [newItem, ...prev]);
      }
      resetForm();
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
    if (isSupabaseConfigured) {
      await wardrobeService.delete(id);
    }
    setDeleteTarget(null);
  }

  const updateItem = useCallback(async (id, updates) => {
    setItems(prev => prev.map(it => it.id === id ? sanitizeItem({ ...it, ...updates }) : it));
    if (isSupabaseConfigured) {
      await wardrobeService.update(id, updates);
    }
  }, []);

  function resetForm() {
    setForm({ title: "", category: "top", style: "casual", fabric: "unknown", colors: [], tags: [], favorite: false });
    setPreview(null);
    setMlLabel("");
    setTouched({ category: false, style: false, fabric: false });
    setNewTag("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleFavorite(id) {
    const item = items.find(i => i.id === id);
    if (item) updateItem(id, { favorite: !item.favorite });
  }

  function addTagToItem(id, tag) {
    const t = tag.trim();
    if (!t) return;
    const item = items.find(i => i.id === id);
    if (!item || item.tags?.includes(t)) return;
    updateItem(id, { tags: [...(item.tags || []), t] });
  }

  function removeTagFromItem(id, tag) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    updateItem(id, { tags: (item.tags || []).filter(t => t !== tag) });
  }

  // ── Filtered & sorted items ───────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = [...items];
    if (filterFavorites) result = result.filter(i => i.favorite);
    if (filterCategory !== "all") result = result.filter(i => i.category === filterCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        (i.title || "").toLowerCase().includes(q) ||
        labelFromCategory(i.category).toLowerCase().includes(q) ||
        labelFromStyle(i.style).toLowerCase().includes(q) ||
        (i.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (sortBy === "oldest") result = [...result].reverse();
    if (sortBy === "az") result = [...result].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    if (sortBy === "za") result = [...result].sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    return result;
  }, [items, searchQuery, filterCategory, filterFavorites, sortBy]);

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = useMemo(() => {
    return recommendOutfitsWithTies(items, { occasion, temperature, localType });
  }, [items, occasion, temperature, localType]);

  const recommendationsUI = useMemo(() => {
    if (items.length < 2) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-500">Adicione pelo menos 2 peças para receber sugestões de looks.</p>
        </div>
      );
    }
    if (recommendations.length === 0) {
      return <p className="text-sm text-gray-500 py-4">Nenhum look encontrado para os critérios selecionados.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {recommendations.map((rec, i) => (
          <div key={i} className="rounded-xl border bg-gradient-to-br from-gray-50 to-white p-3 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-gray-800">Look #{i + 1}</div>
                {rec.explanation && (
                  <div className="text-[11px] text-gray-500 mt-0.5">{rec.explanation}</div>
                )}
              </div>
              <div className="text-[10px] text-gray-400 shrink-0 bg-gray-100 rounded-full px-2 py-0.5">
                {rec.score.toFixed(1)} pts
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {rec.items.map(it => (
                <div key={it.id} className="w-16 group">
                  <div className="relative">
                    <img src={it.image} alt={it.title} className="w-full aspect-[4/5] object-cover rounded-lg" />
                    {it.favorite && (
                      <span className="absolute top-1 right-1 text-pink-500 text-[10px]">♥</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate mt-1">{it.title || labelFromCategory(it.category)}</div>
                  <CategoryBadge category={it.category} />
                </div>
              ))}
            </div>
            {rec.details && (
              <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-400 border-t pt-2">
                <span>Estilo: {rec.details.styleMatch.toFixed(1)}</span>
                <span>Cores: {rec.details.colorHarmony.toFixed(1)}</span>
                <span>Temp: {rec.details.tempComfort.toFixed(1)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }, [recommendations, items.length]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Guarda‑Roupa Virtual</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organize suas peças e monte looks com IA</p>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured
            ? <Badge variant="secondary">☁ Supabase</Badge>
            : <Badge variant="outline">💾 Local</Badge>}
          {modelReady
            ? <Badge variant="secondary">IA ativa</Badge>
            : <Badge variant="outline">IA manual</Badge>}
        </div>
      </header>

      {/* Main two-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Add item form ── */}
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Adicionar peça</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ImagePreview src={preview} alt="pré-visualização" />

            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome (opcional)</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Camisa azul linho"
                />
              </div>

              <div className="space-y-1">
                <Label>Categoria</Label>
                <select
                  value={form.category}
                  onChange={(e) => { setForm({ ...form, category: safeCategory(e.target.value) }); setTouched(t => ({ ...t, category: true })); }}
                  className="w-full rounded-xl border px-2 py-2 text-sm"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Estilo</Label>
                <select
                  value={form.style}
                  onChange={(e) => { setForm({ ...form, style: safeStyle(e.target.value) }); setTouched(t => ({ ...t, style: true })); }}
                  className="w-full rounded-xl border px-2 py-2 text-sm"
                >
                  {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Tecido</Label>
                <select
                  value={form.fabric}
                  onChange={(e) => { setForm({ ...form, fabric: safeFabric(e.target.value) }); setTouched(t => ({ ...t, fabric: true })); }}
                  className="w-full rounded-xl border px-2 py-2 text-sm"
                >
                  {FABRICS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Cor principal</Label>
                <div className="flex items-center gap-2 h-10">
                  {form.colors?.[0]
                    ? <>
                        <div className="w-6 h-6 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: form.colors[0] }} />
                        <span className="text-xs text-gray-600 truncate">{nearestColorName(form.colors[0]).name}</span>
                        <button onClick={() => setForm({ ...form, colors: [] })} className="ml-auto text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </>
                    : <span className="text-xs text-gray-400">Auto</span>}
                </div>
              </div>
            </div>

            {/* Favoritar no form */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, favorite: !f.favorite }))}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${form.favorite ? "bg-pink-50 border-pink-200 text-pink-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
              >
                <HeartIcon filled={form.favorite} />
                {form.favorite ? "Favorita" : "Favoritar"}
              </button>
            </div>

            {/* Auto-apply */}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} className="rounded" />
              Aplicar sugestões automaticamente
            </label>

            {/* AI suggestions */}
            <div className="space-y-2">
              <SuggestionChips label="Categoria sugerida" options={hints.category} onPick={(v) => { setForm({ ...form, category: safeCategory(v) }); setTouched(t => ({ ...t, category: true })); }} mapLabel={labelFromCategory} priorityTag={mlLabel ? "IA" : undefined} />
              <SuggestionChips label="Estilo sugerido" options={hints.style} onPick={(v) => { setForm({ ...form, style: safeStyle(v) }); setTouched(t => ({ ...t, style: true })); }} mapLabel={labelFromStyle} priorityTag={mlLabel ? "IA" : undefined} />
              <SuggestionChips label="Tecido sugerido" options={hints.fabric} onPick={(v) => { setForm({ ...form, fabric: safeFabric(v) }); setTouched(t => ({ ...t, fabric: true })); }} mapLabel={labelFromFabric} priorityTag={mlLabel ? "IA" : undefined} />
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={addItem} disabled={!preview || busy}>
                {busy ? "Salvando…" : "Salvar peça"}
              </Button>
              <Button variant="secondary" onClick={resetForm}>Limpar</Button>
            </div>

            <p className="text-xs text-gray-400">Dica: boa iluminação e fundo neutro melhoram a detecção de cores.</p>
          </CardContent>
        </Card>

        {/* ── Wardrobe grid ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <CardTitle>Guarda-roupa ({items.length})</CardTitle>
              </div>
              <WardrobeStats items={items} />

              {/* Search & filters */}
              <div className="flex flex-wrap gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar peças…"
                  className="flex-1 min-w-36"
                />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="rounded-xl border px-2 py-2 text-sm"
                >
                  <option value="all">Todas</option>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-xl border px-2 py-2 text-sm"
                >
                  <option value="newest">Mais recentes</option>
                  <option value="oldest">Mais antigas</option>
                  <option value="az">A → Z</option>
                  <option value="za">Z → A</option>
                </select>
                <button
                  onClick={() => setFilterFavorites(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm transition-colors ${filterFavorites ? "bg-pink-50 border-pink-300 text-pink-600" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                >
                  <HeartIcon filled={filterFavorites} />
                  Favoritas
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <p className="text-sm">Seu guarda-roupa está vazio.<br />Adicione sua primeira peça!</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-sm text-gray-500 py-8 text-center">
                Nenhuma peça encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredItems.map(it => {
                  const sug = computeSuggestionsForItem(it);
                  return (
                    <WardrobeItemCard
                      key={it.id}
                      item={it}
                      suggestions={sug}
                      onUpdate={updateItem}
                      onDelete={() => setDeleteTarget(it.id)}
                      onToggleFavorite={() => toggleFavorite(it.id)}
                      onAddTag={(tag) => addTagToItem(it.id, tag)}
                      onRemoveTag={(tag) => removeTagFromItem(it.id, tag)}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom: look generator + recommendations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Gerar look</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Ocasião</Label>
              <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-sm">
                {OCCASIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Local</Label>
              <select value={localType} onChange={(e) => setLocalType(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-sm">
                {LOCAL_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Temperatura</Label>
                <span className="text-sm text-gray-600 font-medium">{temperature}°C</span>
              </div>
              <Range min={8} max={40} step={1} value={temperature} onChange={setTemperature} />
              <div className="text-xs text-gray-500">
                Temperatura percebida: <strong>{adjustTemperature(temperature, localType)}°C</strong>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              A IA considera harmonia de cores, estilo da ocasião, temperatura e tecido para montar o look ideal.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Looks recomendados</CardTitle>
            <Badge variant="secondary">IA</Badge>
          </CardHeader>
          <CardContent>{recommendationsUI}</CardContent>
        </Card>
      </div>

      <footer className="text-xs text-gray-400 text-center pt-2 border-t">
        App client-side · IA: MobileNet + heurísticas · Cores: histograma de matiz · {isSupabaseConfigured ? "Dados no Supabase" : "Dados no localStorage"}
      </footer>

      {/* Loading overlay */}
      {busy && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border rounded-2xl p-5 flex items-center gap-3 shadow-lg">
            <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
            <span className="text-sm font-medium">Processando…</span>
          </div>
        </div>
      )}

      {/* Floating AI Stylist Chat */}
      <AIChat items={items} occasion={occasion} temperature={temperature} />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        title="Excluir peça"
        message="Tem certeza que deseja excluir esta peça do guarda-roupa? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => removeItem(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Wardrobe Item Card (extracted for clarity) ───────────────────────────────
function WardrobeItemCard({ item: it, suggestions: sug, onUpdate, onDelete, onToggleFavorite, onAddTag, onRemoveTag }) {
  const [tagInput, setTagInput] = useState("");

  function handleAddTag(e) {
    e.preventDefault();
    if (tagInput.trim()) {
      onAddTag(tagInput.trim());
      setTagInput("");
    }
  }

  return (
    <div className="rounded-xl border p-2 bg-white hover:shadow-sm transition-shadow space-y-2">
      {/* Image + action buttons */}
      <div className="relative">
        <img src={it.image} alt={it.title || "Peça"} className="w-full aspect-[4/5] object-cover rounded-lg" />
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={onToggleFavorite}
            className={`rounded-full w-7 h-7 flex items-center justify-center bg-white/80 hover:bg-white border transition-colors ${it.favorite ? "text-pink-500 border-pink-200" : "text-gray-400 border-transparent"}`}
            title={it.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <HeartIcon filled={it.favorite} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-full w-7 h-7 flex items-center justify-center bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-500 border-transparent hover:border-red-200 border transition-colors"
            title="Excluir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-1.5">
        <Input
          value={it.title || ""}
          placeholder="Nome da peça"
          onChange={(e) => onUpdate(it.id, { title: e.target.value })}
          className="text-xs"
        />

        <div className="grid grid-cols-2 gap-1">
          <select
            value={safeCategory(it.category)}
            onChange={(e) => onUpdate(it.id, { category: safeCategory(e.target.value) })}
            className="w-full rounded-lg border px-1.5 py-1 text-xs"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={safeStyle(it.style)}
            onChange={(e) => onUpdate(it.id, { style: safeStyle(e.target.value) })}
            className="w-full rounded-lg border px-1.5 py-1 text-xs"
          >
            {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-1">
          <select
            value={safeFabric(it.fabric)}
            onChange={(e) => onUpdate(it.id, { fabric: safeFabric(e.target.value) })}
            className="w-full rounded-lg border px-1.5 py-1 text-xs"
          >
            {FABRICS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button
            onClick={async () => {
              const img = await dataURLToImage(it.image);
              const cols = await extractDominantColors(img, 2);
              onUpdate(it.id, { colors: cols });
            }}
            className="rounded-lg border px-1.5 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ↺ Cor
          </button>
        </div>

        {/* Color display */}
        {it.colors?.[0] && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border shadow-sm shrink-0" style={{ backgroundColor: it.colors[0] }} />
            <span className="text-[10px] text-gray-500">{nearestColorName(it.colors[0]).name}</span>
          </div>
        )}

        {/* Tags */}
        {(it.tags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {it.tags.map(tag => (
              <span key={tag} className="flex items-center gap-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {tag}
                <button onClick={() => onRemoveTag(tag)} className="hover:text-red-500 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Add tag */}
        <form onSubmit={handleAddTag} className="flex gap-1">
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="+ Tag"
            className="flex-1 text-[10px] border rounded-lg px-1.5 py-1 min-w-0"
            maxLength={20}
          />
          {tagInput && (
            <button type="submit" className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700">
              OK
            </button>
          )}
        </form>

        {/* AI suggestions */}
        {(sug.category.length > 0 || sug.style.length > 0 || sug.fabric.length > 0) && (
          <div className="border-t pt-1.5 space-y-1">
            <div className="text-[10px] text-gray-400">Sugestões IA</div>
            <div className="flex flex-wrap gap-1">
              {sug.category.map(v => (
                <button key={`c-${v}`} onClick={() => onUpdate(it.id, { category: safeCategory(v) })}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                  {labelFromCategory(v)}
                </button>
              ))}
              {sug.style.map(v => (
                <button key={`s-${v}`} onClick={() => onUpdate(it.id, { style: safeStyle(v) })}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                  {labelFromStyle(v)}
                </button>
              ))}
              {sug.fabric.map(v => (
                <button key={`f-${v}`} onClick={() => onUpdate(it.id, { fabric: safeFabric(v) })}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                  {labelFromFabric(v)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
