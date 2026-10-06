import { sanitizeItem, safeCategory, safeFabric } from "./domain";
import { isNeutral, hueFromHex } from "./colors";

function harmonyScore(c1, c2) {
  if (!c1 || !c2) return 0;
  if (isNeutral(c1) || isNeutral(c2)) return 1.2;
  const d = Math.abs(((hueFromHex(c1) - hueFromHex(c2) + 540) % 360) - 180);
  const comp = Math.max(0, 1.6 - d / 90);
  const anal = Math.max(0, 1.4 - Math.abs(180 - d) / 60);
  return Math.max(comp, anal);
}

function harmonyType(c1, c2) {
  if (!c1 || !c2) return null;
  if (isNeutral(c1) || isNeutral(c2)) return "neutras";
  const d = Math.abs(((hueFromHex(c1) - hueFromHex(c2) + 540) % 360) - 180);
  if (d < 40) return "análogas";
  if (d > 140) return "complementares";
  return "harmônicas";
}

function styleMatchScore(occ, styles = []) {
  const s = new Set(styles.filter(Boolean));
  if (occ === "work") return s.has("smart") || s.has("formal") ? 1.5 : s.has("casual") ? 0.8 : 1.0;
  if (occ === "formal") return s.has("formal") ? 1.6 : s.has("smart") ? 1.1 : 0.5;
  if (occ === "party") return s.has("smart") || s.has("street") ? 1.3 : 1.0;
  if (occ === "sport") return s.has("sport") ? 1.6 : 0.6;
  return s.has("casual") || s.has("street") ? 1.3 : 1.0;
}

export function adjustTemperature(tempC, localType) {
  if (localType === "indoor-ac") return Math.min(tempC, 24);
  if (localType === "indoor") return tempC;
  if (localType === "outdoor-sun") return tempC + 3;
  if (localType === "outdoor-shade") return tempC;
  return tempC;
}

function fabricComfortScore(effTemp, fabric, _category) {
  const f = safeFabric(fabric);
  if (effTemp >= 28) {
    if (f === "linen") return 0.6;
    if (f === "cotton") return 0.35;
    if (f === "silk") return 0.25;
    if (f === "polyester") return -0.1;
    if (f === "denim") return -0.4;
    if (f === "wool") return -0.6;
    if (f === "leather") return -0.7;
  }
  if (effTemp <= 16) {
    if (f === "wool") return 0.6;
    if (f === "leather") return 0.45;
    if (f === "denim") return 0.25;
    if (f === "polyester") return 0.15;
    if (f === "linen") return -0.3;
    if (f === "silk") return -0.15;
  }
  return 0;
}

function tempScore(effTemp, category) {
  const c = safeCategory(category);
  if (c === "outerwear") return effTemp < 18 ? 1.2 : -0.2;
  if (c === "dress" || c === "top" || c === "skirt") return effTemp > 24 ? 1.1 : 1.0;
  return 1.0;
}

function scoreOutfit(items, { occasion, effTemp }) {
  const styles = items.map(i => i.style);
  const styleMatch = styleMatchScore(occasion, styles);

  let colorHarmony = 0;
  let colorHarmonyType = null;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const h = harmonyScore(items[i].colors?.[0], items[j].colors?.[0]);
      colorHarmony += h * 0.9;
      if (!colorHarmonyType && h > 0) {
        colorHarmonyType = harmonyType(items[i].colors?.[0], items[j].colors?.[0]);
      }
    }
  }

  let tempComfort = 0;
  let fabricComfort = 0;
  for (const it of items) {
    tempComfort += tempScore(effTemp, it.category) * 0.6;
    fabricComfort += fabricComfortScore(effTemp, it.fabric, it.category) * 0.9;
  }

  const total = styleMatch + colorHarmony + tempComfort + fabricComfort;
  return { total, styleMatch, colorHarmony: colorHarmony / Math.max(1, items.length - 1), tempComfort, fabricComfort, colorHarmonyType };
}

const OCCASION_LABELS = {
  casual: "dia a dia",
  work: "trabalho",
  formal: "eventos formais",
  party: "festas",
  sport: "atividade física",
};

function buildExplanation(details, occasion, effTemp) {
  const parts = [];

  if (details.styleMatch >= 1.5) {
    parts.push(`Estilo ideal para ${OCCASION_LABELS[occasion] || occasion}`);
  } else if (details.styleMatch >= 1.2) {
    parts.push(`Estilo adequado para ${OCCASION_LABELS[occasion] || occasion}`);
  }

  if (details.colorHarmony >= 1.0 && details.colorHarmonyType) {
    parts.push(`Cores ${details.colorHarmonyType}`);
  } else if (details.colorHarmony >= 0.7) {
    parts.push("Boa combinação de cores");
  }

  if (details.fabricComfort > 0.3 && effTemp >= 28) {
    parts.push("Tecido fresco para o calor");
  } else if (details.fabricComfort > 0.3 && effTemp <= 16) {
    parts.push("Tecido adequado para o frio");
  }

  return parts.length > 0 ? parts.join(" · ") : "Combinação equilibrada";
}

export function recommendOutfitsWithTies(items, { occasion, temperature, localType }) {
  const list = items.map(sanitizeItem).filter(Boolean);
  const tops = list.filter(i => i.category === "top");
  const bottoms = list.filter(i => i.category === "bottom" || i.category === "skirt");
  const dresses = list.filter(i => i.category === "dress");
  const outer = list.filter(i => i.category === "outerwear");
  const shoes = list.filter(i => i.category === "shoes");
  const effTemp = adjustTemperature(temperature, localType);
  const candidates = [];

  function addCandidate(outfitItems) {
    const details = scoreOutfit(outfitItems, { occasion, effTemp });
    const explanation = buildExplanation(details, occasion, effTemp);
    candidates.push({ items: outfitItems, score: details.total, details, explanation });
  }

  for (const d of dresses) {
    for (const sh of (shoes.length ? shoes : [null])) {
      const itemsA = [d, sh].filter(Boolean);
      addCandidate(itemsA);
      for (const ow of outer) {
        addCandidate([d, ow, sh].filter(Boolean));
      }
    }
  }

  for (const t of tops) {
    for (const b of bottoms) {
      for (const sh of (shoes.length ? shoes : [null])) {
        const baseTB = [t, b, sh].filter(Boolean);
        addCandidate(baseTB);
        for (const ow of outer) {
          addCandidate([t, b, ow, sh].filter(Boolean));
        }
      }
    }
  }

  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0].score;
  const EPS = 0.05;
  return candidates.filter(c => Math.abs(c.score - best) <= EPS).slice(0, 6);
}
