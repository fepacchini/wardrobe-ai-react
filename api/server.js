import express from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

const PORT = process.env.API_PORT || 3001;

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors({ origin: true }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Helpers ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  top: "Camiseta/Blusa/Camisa",
  bottom: "Calça/Short",
  skirt: "Saia",
  dress: "Vestido",
  outerwear: "Casaco/Jaqueta",
  shoes: "Calçados",
  accessory: "Acessório",
};
const STYLE_LABELS = {
  casual: "casual",
  smart: "smart casual",
  formal: "formal",
  sport: "esportivo",
  street: "streetwear",
  bohemian: "boho",
  minimalist: "minimalista",
};
const FABRIC_LABELS = {
  cotton: "algodão",
  linen: "linho",
  wool: "lã",
  silk: "seda",
  polyester: "poliéster",
  denim: "jeans",
  leather: "couro",
  unknown: "desconhecido",
};

function buildSystemPrompt(wardrobe, occasion, temperature) {
  let itemsList = "(guarda-roupa vazio)";

  if (wardrobe.length > 0) {
    itemsList = wardrobe
      .map((item, i) => {
        const parts = [
          `${i + 1}. ${item.title || CATEGORY_LABELS[item.category] || item.category}`,
          `categoria: ${CATEGORY_LABELS[item.category] || item.category}`,
          `estilo: ${STYLE_LABELS[item.style] || item.style}`,
          `tecido: ${FABRIC_LABELS[item.fabric] || item.fabric}`,
        ];
        if (item.tags?.length) parts.push(`tags: ${item.tags.join(", ")}`);
        if (item.favorite) parts.push("⭐ favorita");
        return parts[0] + " (" + parts.slice(1).join(", ") + ")";
      })
      .join("\n");
  }

  const contextParts = [];
  if (occasion) contextParts.push(`Ocasião atual: ${occasion}`);
  if (temperature != null) contextParts.push(`Temperatura: ${temperature}°C`);
  const contextLine = contextParts.length
    ? `\nContexto do usuário: ${contextParts.join(" | ")}\n`
    : "";

  return `Você é um estilista pessoal especialista e consultor de moda. Responda sempre em português brasileiro, de forma natural e amigável.

O usuário possui ${wardrobe.length} peças em seu guarda-roupa:
${itemsList}
${contextLine}
Suas responsabilidades:
- Sugerir looks e combinações usando as peças reais do guarda-roupa
- Discutir estilos, tendências e dicas de moda
- Ajudar a escolher o que usar para diferentes ocasiões, temperaturas e ambientes
- Considerar harmonia de cores, tecidos e estilos ao sugerir looks
- Identificar peças que faltam no guarda-roupa (lacunas de estilo)
- Responder dúvidas sobre moda, cuidado com roupas e combinações

Ao sugerir looks:
- Mencione sempre pelo nome ou tipo as peças específicas que o usuário possui
- Justifique brevemente por que a combinação funciona
- Se a peça marcada como favorita se encaixar, prefira incluí-la

Seja conciso mas completo. Responda em no máximo 3-4 parágrafos curtos.`;
}

// ── POST /api/chat ─────────────────────────────────────────────────────────

app.post("/api/chat", async (req, res) => {
  const { messages = [], wardrobe = [], occasion, temperature } = req.body;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY não configurada. Adicione ao arquivo .env",
    });
  }

  if (!messages.length) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function send(obj) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    }
  }

  try {
    const stream = anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: buildSystemPrompt(wardrobe, occasion, temperature),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    stream.on("text", (delta) => {
      send({ type: "delta", text: delta });
    });

    stream.on("finalMessage", () => {
      send({ type: "done" });
      res.end();
    });

    stream.on("error", (err) => {
      send({ type: "error", message: err.message });
      res.end();
    });

    req.on("close", () => stream.abort());
  } catch (err) {
    if (!res.writableEnded) {
      send({ type: "error", message: err.message });
      res.end();
    }
  }
});

// ── POST /api/analyze-clothing ────────────────────────────────────────────

app.post("/api/analyze-clothing", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY não configurada" });
  }

  const { imageDataURL } = req.body;
  if (!imageDataURL || typeof imageDataURL !== "string") {
    return res.status(400).json({ error: "imageDataURL é obrigatório" });
  }

  // Parse data URL: data:<mediaType>;base64,<data>
  const match = imageDataURL.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "Formato de imagem inválido. Use JPEG, PNG, GIF ou WebP." });
  }
  const [, mediaType, base64Data] = match;

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `Analise esta imagem de peça de roupa e retorne SOMENTE um objeto JSON válido, sem texto extra, markdown ou explicações.

O JSON deve ter exatamente estas propriedades:
{
  "title": string — nome descritivo em português (ex: "Camisa xadrez manga longa azul"),
  "category": um de ["top","bottom","skirt","dress","outerwear","shoes","accessory"],
  "style": um de ["casual","smart","formal","sport","street","bohemian","minimalist"],
  "fabric": um de ["cotton","linen","wool","silk","polyester","denim","leather","unknown"],
  "tags": array de até 5 strings em português com características visíveis (ex: ["manga longa","listrado","botões"]),
  "description": string — 1 frase descrevendo a peça
}

Referência de categorias:
- top: camisetas, blusas, camisas, regatas, tops
- bottom: calças, shorts, bermudas
- skirt: saias
- dress: vestidos, macacões
- outerwear: casacos, jaquetas, blazers, cardigãs
- shoes: sapatos, tênis, sandálias, botas
- accessory: bolsas, cintos, cachecóis, chapéus, joias

Retorne APENAS o JSON.`,
            },
          ],
        },
      ],
    });

    const raw = response.content[0]?.text?.trim() || "";
    // Strip possible markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ error: "A IA retornou resposta inválida. Tente novamente." });
    }

    const VALID_CATEGORIES = ["top","bottom","skirt","dress","outerwear","shoes","accessory"];
    const VALID_STYLES = ["casual","smart","formal","sport","street","bohemian","minimalist"];
    const VALID_FABRICS = ["cotton","linen","wool","silk","polyester","denim","leather","unknown"];

    res.json({
      title: String(data.title || "").slice(0, 80),
      category: VALID_CATEGORIES.includes(data.category) ? data.category : "top",
      style: VALID_STYLES.includes(data.style) ? data.style : "casual",
      fabric: VALID_FABRICS.includes(data.fabric) ? data.fabric : "unknown",
      tags: Array.isArray(data.tags)
        ? data.tags.slice(0, 5).map((t) => String(t).slice(0, 25))
        : [],
      description: String(data.description || "").slice(0, 200),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: "claude-opus-4-6",
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`🤖 Wardrobe AI API running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY not set – /api/chat will return 503");
  }
});
