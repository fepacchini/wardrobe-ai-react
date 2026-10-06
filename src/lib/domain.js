import { inferFabric } from "./ai";

export const CATEGORIES = Object.freeze([
  { value: "top", label: "Blusa/Top" },
  { value: "bottom", label: "Calça/Short" },
  { value: "skirt", label: "Saia" },
  { value: "dress", label: "Vestido" },
  { value: "outerwear", label: "Casaco/Jaqueta" },
  { value: "shoes", label: "Calçado" },
  { value: "accessory", label: "Acessório" },
]);
export const STYLES = Object.freeze([
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
  { value: "smart", label: "Smart Casual" },
  { value: "sport", label: "Esportivo" },
  { value: "street", label: "Street" },
]);
export const OCCASIONS = Object.freeze([
  { value: "casual", label: "Dia a dia" },
  { value: "work", label: "Trabalho" },
  { value: "formal", label: "Formal / Evento" },
  { value: "party", label: "Festa" },
  { value: "sport", label: "Atividade física" },
]);
export const LOCAL_TYPES = Object.freeze([
  { value: "indoor-ac", label: "Ambiente interno com ar-condicionado" },
  { value: "indoor", label: "Ambiente interno sem ar-condicionado" },
  { value: "outdoor-sun", label: "Externo sob sol" },
  { value: "outdoor-shade", label: "Externo à sombra/vento" },
]);
export const FABRICS = Object.freeze([
  { value: "unknown", label: "(Sem tecido)" },
  { value: "linen", label: "Linho" },
  { value: "cotton", label: "Algodão" },
  { value: "silk", label: "Seda" },
  { value: "polyester", label: "Poliéster" },
  { value: "denim", label: "Jeans/Denim" },
  { value: "wool", label: "Lã" },
  { value: "leather", label: "Couro" },
]);

export const STORAGE_KEY = "virtual-wardrobe-vite-react-v1";

export const CATEGORY_LABELS = Object.freeze(Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])));
export const STYLE_LABELS = Object.freeze(Object.fromEntries(STYLES.map(s => [s.value, s.label])));
export const FABRIC_LABELS = Object.freeze(Object.fromEntries(FABRICS.map(f => [f.value, f.label])));
export const CATEGORY_VALUES = Object.freeze(new Set(Object.keys(CATEGORY_LABELS)));
export const STYLE_VALUES = Object.freeze(new Set(Object.keys(STYLE_LABELS)));
export const FABRIC_VALUES = Object.freeze(new Set(Object.keys(FABRIC_LABELS)));

export const DEFAULT_CATEGORY = "top";
export const DEFAULT_STYLE = "casual";
export const DEFAULT_FABRIC = "unknown";

export const toKey = (v) => (v == null ? "" : String(v)).trim();
export const safeCategory = (v) => CATEGORY_VALUES.has(toKey(v)) ? toKey(v) : DEFAULT_CATEGORY;
export const safeStyle = (v) => STYLE_VALUES.has(toKey(v)) ? toKey(v) : DEFAULT_STYLE;
export const safeFabric = (v) => FABRIC_VALUES.has(toKey(v)) ? toKey(v) : DEFAULT_FABRIC;
export const labelFromCategory = (v) => CATEGORY_LABELS[safeCategory(v)] || CATEGORY_LABELS[DEFAULT_CATEGORY];
export const labelFromStyle = (v) => STYLE_LABELS[safeStyle(v)] || STYLE_LABELS[DEFAULT_STYLE];
export const labelFromFabric = (v) => FABRIC_LABELS[safeFabric(v)] || FABRIC_LABELS[DEFAULT_FABRIC];

export const randomId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function sanitizeItem(it) {
  if (!it || typeof it !== "object") return null;
  const category = safeCategory(it.category);
  const style = safeStyle(it.style);
  const fabric = safeFabric(inferFabric(it) || it.fabric);
  const colors = Array.isArray(it.colors) ? it.colors.filter(Boolean).slice(0, 2) : [];
  const tags = Array.isArray(it.tags) ? it.tags.filter(t => typeof t === "string" && t.trim()) : [];
  return {
    id: it.id || randomId(),
    image: it.image || "",
    title: it.title || "",
    category, style, fabric, colors,
    tags,
    favorite: Boolean(it.favorite),
    createdAt: it.createdAt || new Date().toISOString(),
  };
}
export function saveToStorage(items) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {} }
export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(sanitizeItem).filter(Boolean) : [];
  } catch { return []; }
}

