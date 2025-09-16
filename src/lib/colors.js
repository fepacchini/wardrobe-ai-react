export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
export function rgbToHsl(r, g, b) { r/=255; g/=255; b/=255; const max=Math.max(r,g,b), min=Math.min(r,g,b); let h,s,l=(max+min)/2; if(max===min){h=s=0;} else { const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break;default:h=0;} h*=60;} return {h,s,l}; }
export function hslToRgb(h, s, l) { const c=(1-Math.abs(2*l-1))*s; const x=c*(1-Math.abs(((h/60)%2)-1)); const m=l-c/2; let r1=0,g1=0,b1=0; if(0<=h&&h<60){r1=c;g1=x;b1=0;} else if(60<=h&&h<120){r1=x;g1=c;b1=0;} else if(120<=h&&h<180){r1=0;g1=c;b1=x;} else if(180<=h&&h<240){r1=0;g1=x;b1=c;} else if(240<=h&&h<300){r1=x;g1=0;b1=c;} else {r1=c;g1=0;b1=x;} return { r:Math.round((r1+m)*255), g:Math.round((g1+m)*255), b:Math.round((b1+m)*255) }; }
export function rgbToHex(r,g,b){return `#${[r,g,b].map(x=>x.toString(16).padStart(2,"0")).join("")}`}
export function hexToRgb(hex){ const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:{r:0,g:0,b:0}; }
export const COLOR_NAMES = [
  ["Preto", "#000000"], ["Branco", "#ffffff"], ["Cinza", "#808080"], ["Prata", "#c0c0c0"],
  ["Marfim", "#fffff0"], ["Bege", "#f5f5dc"], ["Creme", "#fffdd0"],
  ["Azul marinho", "#000080"], ["Azul", "#0000ff"], ["Azul claro", "#87cefa"],
  ["Ciano", "#00ffff"], ["Turquesa", "#40e0d0"],
  ["Verde", "#008000"], ["Verde claro", "#90ee90"], ["Lima", "#32cd32"], ["Oliva", "#808000"],
  ["Amarelo", "#ffff00"], ["Mostarda", "#ffdb58"],
  ["Laranja", "#ffa500"], ["Coral", "#ff7f50"],
  ["Vermelho", "#ff0000"], ["Vinho", "#800000"],
  ["Rosa", "#ffc0cb"], ["Magenta", "#ff00ff"],
  ["Roxo", "#800080"], ["Lavanda", "#e6e6fa"],
  ["Marrom", "#8b4513"], ["Caramelo", "#af6e4d"], ["Chocolate", "#7b3f00"], ["Areia", "#c2b280"],
];
export function nearestColorName(hex) { const { r,g,b }=hexToRgb(hex); let best=COLOR_NAMES[0], bestDist=Infinity; for(const [name,refHex] of COLOR_NAMES){ const rr=hexToRgb(refHex); const d=(r-rr.r)**2+(g-rr.g)**2+(b-rr.b)**2; if(d<bestDist){bestDist=d; best=[name,refHex];}} return { name:best[0], hex:best[1] }; }
export function isNeutral(hex){ const {r,g,b}=hexToRgb(hex); const {s,l}=rgbToHsl(r,g,b); return s<0.18||l<0.12||l>0.88; }
export function hueFromHex(hex){ const {r,g,b}=hexToRgb(hex); return rgbToHsl(r,g,b).h; }
export async function extractDominantColors(img, maxColors=2){ const canvas=document.createElement("canvas"); const ctx=canvas.getContext("2d",{willReadFrequently:true}); const W=120; const H=Math.max(80,Math.round((img.height/img.width)*W)); canvas.width=W; canvas.height=H; ctx.drawImage(img,0,0,W,H); const data=ctx.getImageData(0,0,W,H).data; const bins=new Array(36).fill(0).map(()=>({count:0,sumH:0,sumS:0,sumL:0})); for(let i=0;i<data.length;i+=4){ const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3]; if(a<10)continue; const {h,s,l}=rgbToHsl(r,g,b); if(l<0.05||l>0.95)continue; const bin=clamp(Math.floor((h%360)/10),0,35); bins[bin].count++; bins[bin].sumH+=h; bins[bin].sumS+=s; bins[bin].sumL+=l;} const ranked=bins.map((b,i)=>({i,...b,score:b.count})).filter(b=>b.count>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,maxColors)); const colors=ranked.map(b=>{ const h=b.sumH/b.count, s=b.sumS/b.count, l=b.sumL/b.count; const {r,g,b:bb}=hslToRgb(h,s,l); return rgbToHex(r,g,bb);}); if(colors.length===0)colors.push("#808080"); const uniq=[]; for(const c of colors){ if(!uniq.some(u=>colorDistance(u,c)<900)) uniq.push(c); if(uniq.length===maxColors) break; } return uniq; }
export function colorDistance(h1,h2){ const a=hexToRgb(h1), b=hexToRgb(h2); return (a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2; }
