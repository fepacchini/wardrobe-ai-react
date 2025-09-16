import { DEFAULT_CATEGORY, DEFAULT_STYLE, DEFAULT_FABRIC } from "./domain";

export function mapLabelToCategory(label){ const x=(label||"").toLowerCase(); if(/(t[- ]?shirt|shirt|tee|jersey|sweater|hoodie|sweatshirt|top|blouse)/.test(x))return "top"; if(/(jeans|trousers|pants|slacks|shorts|cargo)/.test(x))return "bottom"; if(/(skirt)/.test(x))return "skirt"; if(/(dress|gown)/.test(x))return "dress"; if(/(jacket|coat|blazer|cardigan|parka|windbreaker|overcoat)/.test(x))return "outerwear"; if(/(shoe|sneaker|sandal|boot|loafer|heel)/.test(x))return "shoes"; if(/(hat|cap|belt|bag|scarf|watch|glasses)/.test(x))return "accessory"; return DEFAULT_CATEGORY; }
export function guessStyleFromLabel(label){ const x=(label||"").toLowerCase(); if(/(blazer|oxford|derby|loafer|gown)/.test(x))return "formal"; if(/(dress|cardigan|slacks|shirt)/.test(x))return "smart"; if(/(sneaker|hoodie|t[- ]?shirt|jeans|cap)/.test(x))return "casual"; if(/(running|sandal|trainer)/.test(x))return "sport"; return DEFAULT_STYLE; }
export function guessFabricFromText(text=""){ const x=text.toLowerCase(); if(/linho|linen/.test(x)) return "linen"; if(/algod(ao|ão)|cotton/.test(x)) return "cotton"; if(/seda|silk/.test(x)) return "silk"; if(/l(a|ã)|wool/.test(x)) return "wool"; if(/couro|leather/.test(x)) return "leather"; if(/jeans|denim/.test(x)) return "denim"; if(/poli(ester|éster)|polyester/.test(x)) return "polyester"; return "unknown"; }
export function inferFabric(it){ return guessFabricFromText(`${it?.title||""} ${it?.category||""}`); }
export function distinct(arr){ const out=[]; for(const x of arr){ if(x && !out.includes(x)) out.push(x); } return out; }
export function computeSuggestions({ title = "", mlLabel = "" }){
  const sCat = distinct([ mapLabelToCategory(mlLabel), mapLabelToCategory(title), DEFAULT_CATEGORY ]).slice(0,3);
  const sSty = distinct([ guessStyleFromLabel(mlLabel), guessStyleFromLabel(title), DEFAULT_STYLE ]).slice(0,3);
  const sFabRaw = distinct([ guessFabricFromText(mlLabel), guessFabricFromText(title), DEFAULT_FABRIC ]);
  const sFab = sFabRaw.length>1 ? sFabRaw.filter(x=>x!=="unknown").slice(0,3) : sFabRaw;
  return { category: sCat, style: sSty, fabric: sFab };
}
export function computeSuggestionsForItem(it){ return computeSuggestions({ title: it?.title || "", mlLabel: "" }); }

