# Guarda‑Roupa Virtual • React (Vite + Tailwind)
App React que cadastra peças por foto, sugere **categoria/estilo/tecido**, extrai **cor dominante** e recomenda **looks** ponderando **temperatura, local e tecido**. Se houver **empate**, mostra múltiplas opções.

## Rodando localmente
```bash
npm install
npm run dev
```
Abra a URL indicada (ex.: http://localhost:5173).

> A IA usa MobileNet: o app tenta o pacote local `@tensorflow-models/mobilenet` (se instalado) e depois cai nos CDNs **sem URL duplicada**:
> 1) `https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/+esm`
> 2) `https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.esm.min.js`
> 3) `https://esm.sh/@tensorflow-models/mobilenet@2.1.0`

Se nenhum método funcionar, o app segue sem IA (você ainda pode escolher manualmente).

## Deploy no GitHub Pages
1. Faça `npm run build`.
2. Publique a pasta `dist/` via GitHub Pages (ou use um action pronto).

## Notas
- **Self-tests** rodam em DEV e aparecem no console.
- Tailwind já configurado via `tailwind.config.js` e `postcss.config.js`.
