import { sanitizeItem, safeCategory, safeFabric } from "./domain";
import { isNeutral, hueFromHex } from "./colors";

function harmonyScore(c1,c2){ if(!c1||!c2) return 0; if(isNeutral(c1)||isNeutral(c2)) return 1.2; const d=Math.abs(((hueFromHex(c1)-hueFromHex(c2)+540)%360)-180); const comp=Math.max(0,1.6-d/90); const anal=Math.max(0,1.4-Math.abs(180-d)/60); return Math.max(comp,anal); }
function styleMatchScore(occ, styles=[]){ const s=new Set(styles.filter(Boolean)); if(occ==="work") return s.has("smart")||s.has("formal")?1.5:s.has("casual")?0.8:1.0; if(occ==="formal") return s.has("formal")?1.6:s.has("smart")?1.1:0.5; if(occ==="party") return s.has("smart")||s.has("street")?1.3:1.0; if(occ==="sport") return s.has("sport")?1.6:0.6; return s.has("casual")||s.has("street")?1.3:1.0; }
function adjustTemperature(tempC, localType){ if(localType==="indoor-ac") return Math.min(tempC,24); if(localType==="indoor") return tempC; if(localType==="outdoor-sun") return tempC+3; if(localType==="outdoor-shade") return tempC; return tempC; }
function fabricComfortScore(effTemp, fabric, category){ const f=safeFabric(fabric); if(effTemp>=28){ if(f==="linen") return 0.6; if(f==="cotton") return 0.35; if(f==="silk") return 0.25; if(f==="polyester") return -0.1; if(f==="denim") return -0.4; if(f==="wool") return -0.6; if(f==="leather") return -0.7; } if(effTemp<=16){ if(f==="wool") return 0.6; if(f==="leather") return 0.45; if(f==="denim") return 0.25; if(f==="polyester") return 0.15; if(f==="linen") return -0.3; if(f==="silk") return -0.15; } return 0; }
function tempScore(effTemp, category){ const c=safeCategory(category); if(c==="outerwear") return effTemp<18?1.2:-0.2; if(c==="dress"||c==="top"||c==="skirt") return effTemp>24?1.1:1.0; return 1.0; }
function scoreOutfit(items, { occasion, effTemp }){
  let score = 0;
  const styles = items.map(i=>i.style);
  score += styleMatchScore(occasion, styles);
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      score += harmonyScore(items[i].colors?.[0], items[j].colors?.[0]) * 0.9;
    }
  }
  for(const it of items){
    score += tempScore(effTemp, it.category) * 0.6;
    score += fabricComfortScore(effTemp, it.fabric, it.category) * 0.9;
  }
  return score;
}
export function recommendOutfitsWithTies(items, { occasion, temperature, localType }){
  const list = items.map(sanitizeItem).filter(Boolean);
  const tops = list.filter(i => i.category === "top");
  const bottoms = list.filter(i => i.category === "bottom" || i.category === "skirt");
  const dresses = list.filter(i => i.category === "dress");
  const outer = list.filter(i => i.category === "outerwear");
  const shoes = list.filter(i => i.category === "shoes");
  const effTemp = adjustTemperature(temperature, localType);
  const candidates = [];

  for (const d of dresses) {
    for (const sh of (shoes.length ? shoes : [null])) {
      let itemsA = [d, sh].filter(Boolean);
      candidates.push({ items: itemsA, score: scoreOutfit(itemsA, { occasion, effTemp }) });
      for (const ow of outer) {
        const itemsB = [d, ow, sh].filter(Boolean);
        candidates.push({ items: itemsB, score: scoreOutfit(itemsB, { occasion, effTemp }) });
      }
    }
  }
  for (const t of tops) {
    for (const b of bottoms) {
      for (const sh of (shoes.length ? shoes : [null])) {
        const baseTB = [t, b, sh].filter(Boolean);
        candidates.push({ items: baseTB, score: scoreOutfit(baseTB, { occasion, effTemp }) });
        for (const ow of outer) {
          const itemsC = [t, b, ow, sh].filter(Boolean);
          candidates.push({ items: itemsC, score: scoreOutfit(itemsC, { occasion, effTemp }) });
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
