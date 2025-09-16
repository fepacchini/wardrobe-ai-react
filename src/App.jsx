import React, { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "./components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/Card";
import { Input } from "./components/ui/Input";
import { Label } from "./components/ui/Label";
import { Badge } from "./components/ui/Badge";
import { Range } from "./components/ui/Range";

import { 
  CATEGORIES, STYLES, FABRICS, OCCASIONS, LOCAL_TYPES, 
  safeCategory, safeStyle, safeFabric, 
  labelFromCategory, labelFromStyle, labelFromFabric, 
  loadFromStorage, saveToStorage, sanitizeItem 
} from "./lib/domain";
import { extractDominantColors, nearestColorName } from "./lib/colors";
import { computeSuggestions, computeSuggestionsForItem } from "./lib/ai";
import { recommendOutfitsWithTies } from "./lib/recommendation";
import { fileToDataURL, dataURLToImage } from "./lib/utils";

// MobileNet (URLs corretas)
const MOBILENET_CDN_URL_PKG = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/+esm";
const MOBILENET_CDN_URL_FILE = "https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.esm.min.js";
const MOBILENET_CDN_URL_SH = "https://esm.sh/@tensorflow-models/mobilenet@2.1.0";

async function loadMobileNet() {
  for (const url of [MOBILENET_CDN_URL_PKG, MOBILENET_CDN_URL_FILE, MOBILENET_CDN_URL_SH]) {
    try {
      const mobilenet = await import(/* @vite-ignore */ url);
      console.log(`MobileNet loaded from ${url}`);
      return await mobilenet.load();
    } catch (e) {
      console.warn(`Failed to load MobileNet from ${url}:`, e);
    }
  }
  return null;
}

function adjustTemperature(tempC, localType) {
  if (localType === "indoor-ac") return Math.min(tempC, 24);
  if (localType === "indoor") return tempC;
  if (localType === "outdoor-sun") return tempC + 3;
  if (localType === "outdoor-shade") return tempC;
  return tempC;
}

function ImagePreview({ src, alt }) {
  if (!src) return <div className="w-full aspect-[4/5] bg-gray-100 rounded-lg flex items-center justify-center text-sm text-gray-500"><span>Selecione uma imagem</span></div>;
  return <img src={src} alt={alt} className="w-full aspect-[4/5] object-cover rounded-lg" />;
}

function SuggestionChips({ label, options, onPick, mapLabel, priorityTag }) {
  if (!options || options.length === 0) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-600 flex items-center gap-2">{label}{priorityTag && <Badge variant="secondary">{priorityTag}</Badge>}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(v => <Button key={v} variant="outline" size="sm" onClick={() => onPick(v)}>{mapLabel(v)}</Button>)}
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState(loadFromStorage());
  const [form, setForm] = useState({ title: "", category: "top", style: "casual", fabric: "unknown", colors: [] });
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

  useEffect(() => { saveToStorage(items); }, [items]);
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
      const topPrediction = predictions[0]?.className || "";
      setMlLabel(topPrediction);
    } catch (e) {
      console.error("Error processing file:", e);
    } finally {
      setBusy(false);
    }
  }

  function addItem() {
    const newItem = sanitizeItem({ ...form, image: preview });
    if (!newItem.image) return;
    setItems(prev => [newItem, ...prev]);
    resetForm();
  }

  function removeItem(id) {
    setItems(prev => prev.filter(it => it.id !== id));
  }

  function updateItem(id, updates) {
    setItems(prev => prev.map(it => it.id === id ? sanitizeItem({ ...it, ...updates }) : it));
  }

  function resetForm() {
    setForm({ title: "", category: "top", style: "casual", fabric: "unknown", colors: [] });
    setPreview(null);
    setMlLabel("");
    setTouched({ category: false, style: false, fabric: false });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const recommendations = useMemo(() => {
    return recommendOutfitsWithTies(items, { occasion, temperature, localType });
  }, [items, occasion, temperature, localType]);

  const recommendationsUI = useMemo(() => {
    if (items.length < 2) return <div className="text-sm text-gray-500">Adicione pelo menos 2 peças para receber sugestões.</div>;
    if (recommendations.length === 0) return <div className="text-sm text-gray-500">Nenhum look encontrado para os critérios.</div>;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {recommendations.map((rec, i) => (
          <div key={i} className="rounded-xl border p-3 bg-gray-50/80 space-y-2">
            <div className="text-xs font-semibold text-gray-700">Sugestão #{i + 1} (Score: {rec.score.toFixed(2)})</div>
            <div className="flex flex-wrap gap-2">
              {rec.items.map(it => (
                <div key={it.id} className="w-20">
                  <img src={it.image} alt={it.title} className="w-full aspect-[4/5] object-cover rounded-md" />
                  <div className="text-[10px] text-gray-600 truncate mt-1">{it.title || labelFromCategory(it.category)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }, [recommendations, items.length]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Guarda‑Roupa Virtual</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {modelReady ? <Badge variant="secondary">IA ativa</Badge> : <Badge variant="outline">IA manual</Badge>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Adicionar peça</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ImagePreview src={preview} alt="pré-visualização" />
            <div className="flex gap-2">
              <Input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Nome (opcional)</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Camisa azul linho" /></div>
              <div className="space-y-1"><Label>Categoria</Label>
                <select value={form.category} onChange={(e) => { setForm({ ...form, category: safeCategory(e.target.value) }); setTouched(t=>({...t, category:true})); }} className="w-full rounded-xl border px-2 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Estilo</Label>
                <select value={form.style} onChange={(e) => { setForm({ ...form, style: safeStyle(e.target.value) }); setTouched(t=>({...t, style:true})); }} className="w-full rounded-xl border px-2 py-2 text-sm">
                  {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label>Tecido</Label>
                <select value={form.fabric} onChange={(e) => { setForm({ ...form, fabric: safeFabric(e.target.value) }); setTouched(t=>({...t, fabric:true})); }} className="w-full rounded-xl border px-2 py-2 text-sm">
                  {FABRICS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1 col-span-2"><Label>Cor principal</Label>
                <div className="flex items-center gap-3">
                  {form.colors?.[0] ? (<div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full border" style={{ backgroundColor: form.colors[0] }} /><span className="text-xs text-gray-600">{nearestColorName(form.colors[0]).name}</span></div>) : (<span className="text-xs text-gray-500">(auto)</span>)}
                  <Button variant="outline" size="sm" onClick={() => setForm({ ...form, colors: [] })}>Limpar</Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input id="auto-apply" type="checkbox" checked={autoApply} onChange={(e)=>setAutoApply(e.target.checked)} />
              <label htmlFor="auto-apply" className="text-sm text-gray-700">Aplicar automaticamente as sugestões (IA em 1º lugar)</label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <SuggestionChips label="Sugestão de categoria" options={hints.category} onPick={(v)=>{ setForm({...form, category: safeCategory(v)}); setTouched(t=>({...t, category:true})); }} mapLabel={labelFromCategory} priorityTag={mlLabel?"IA":undefined} />
              <SuggestionChips label="Sugestão de estilo" options={hints.style} onPick={(v)=>{ setForm({...form, style: safeStyle(v)}); setTouched(t=>({...t, style:true})); }} mapLabel={labelFromStyle} priorityTag={mlLabel?"IA":undefined} />
              <SuggestionChips label="Sugestão de tecido" options={hints.fabric} onPick={(v)=>{ setForm({...form, fabric: safeFabric(v)}); setTouched(t=>({...t, fabric:true})); }} mapLabel={labelFromFabric} priorityTag={mlLabel?"IA":undefined} />
            </div>

            <div className="flex gap-2"><Button className="flex-1" onClick={addItem} disabled={!preview || busy}>{busy ? "Processando…" : "Salvar peça"}</Button><Button variant="secondary" onClick={resetForm}>Reset</Button></div>
            <p className="text-xs text-gray-500">Dica: use boa iluminação e fundo neutro para melhor detecção de cores.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Seu guarda-roupa ({items.length})</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhuma peça cadastrada ainda.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(it => {
                  const sug = computeSuggestionsForItem(it);
                  return (
                    <div key={it.id} className="rounded-xl border p-2 bg-white">
                      <div className="relative">
                        <img src={it.image} alt={it.title || "Peça"} className="w-full aspect-[4/5] object-cover rounded-lg" />
                        <button className="absolute top-2 right-2 bg-white/70 hover:bg-white rounded-full px-2 py-1 text-xs border" onClick={() => removeItem(it.id)} title="Excluir">Excluir</button>
                      </div>
                      <div className="mt-2 space-y-2">
                        <Input value={it.title || ""} placeholder="Nome" onChange={(e) => updateItem(it.id, { title: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <select value={safeCategory(it.category)} onChange={(e) => updateItem(it.id, { category: safeCategory(e.target.value) })} className="w-full rounded-xl border px-2 py-2 text-sm">{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                          <select value={safeStyle(it.style)} onChange={(e) => updateItem(it.id, { style: safeStyle(e.target.value) })} className="w-full rounded-xl border px-2 py-2 text-sm">{STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={safeFabric(it.fabric)} onChange={(e)=>updateItem(it.id,{ fabric: safeFabric(e.target.value) })} className="w-full rounded-xl border px-2 py-2 text-sm">{FABRICS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                          <Button variant="outline" size="sm" onClick={async () => { const img = await dataURLToImage(it.image); const cols = await extractDominantColors(img, 2); updateItem(it.id, { colors: cols }); }}>Recalcular cor</Button>
                        </div>
                        <div className="flex items-center gap-2">{it.colors?.[0] && <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: it.colors[0] }} />}<span className="text-xs text-gray-600">{it.colors?.[0] ? nearestColorName(it.colors[0]).name : "Sem cor"}</span></div>

                        <div className="space-y-1">
                          <div className="text-[11px] text-gray-500">Sugestões</div>
                          <div className="flex flex-wrap gap-2">
                            {sug.category.map(v => <Button key={`c-${v}`} variant="outline" size="sm" onClick={() => updateItem(it.id, { category: safeCategory(v) })}>{labelFromCategory(v)}</Button>)}
                            {sug.style.map(v => <Button key={`s-${v}`} variant="outline" size="sm" onClick={() => updateItem(it.id, { style: safeStyle(v) })}>{labelFromStyle(v)}</Button>)}
                            {sug.fabric.map(v => <Button key={`f-${v}`} variant="outline" size="sm" onClick={() => updateItem(it.id, { fabric: safeFabric(v) })}>{labelFromFabric(v)}</Button>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Gerar sugestão de look</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1"><Label>Ocasião</Label>
              <select value={occasion} onChange={(e) => setOccasion(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-sm">{OCCASIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            </div>
            <div className="space-y-1"><Label>Local</Label>
              <select value={localType} onChange={(e) => setLocalType(e.target.value)} className="w-full rounded-xl border px-2 py-2 text-sm">{LOCAL_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select>
            </div>
            <div className="space-y-1"><Label>Temperatura (°C)</Label>
              <Range min={8} max={40} step={1} value={temperature} onChange={setTemperature} />
              <div className="text-sm text-gray-600">{temperature}°C (percebida: {adjustTemperature(temperature, localType)}°C)</div>
            </div>
            <div className="text-xs text-gray-500">A sugestão considera harmonia de cores, estilo, temperatura percebida e tecido.</div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Looks recomendados</CardTitle><Badge variant="secondary">IA</Badge></CardHeader>
          <CardContent>{recommendationsUI}</CardContent>
        </Card>
      </div>

      <footer className="mt-10 text-xs text-gray-500 text-center"><div>App demo client-side. IA: MobileNet + heurísticas. Cores: histograma de matiz. Sem backend.</div></footer>

      {busy && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border rounded-xl p-4 flex items-center gap-3"><div className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full" /><div className="text-sm">Processando imagem…</div></div>
        </div>
      )}
    </div>
  );
}
