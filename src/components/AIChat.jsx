import React, { useEffect, useRef, useState } from "react";

// ── Quick suggestion prompts ───────────────────────────────────────────────
const QUICK_PROMPTS = [
  "Sugira um look para hoje",
  "O que usar para o trabalho?",
  "Um look para sair à noite",
  "Outfit para o calor",
  "O que está faltando no meu guarda-roupa?",
];

// ── Single message bubble ─────────────────────────────────────────────────
function MessageBubble({ msg, isStreaming }) {
  return (
    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      {msg.role === "assistant" && (
        <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0 mt-0.5 mr-2">
          <span className="text-white text-xs">✦</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          msg.role === "user"
            ? "bg-black text-white rounded-br-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm"
        }`}
      >
        {msg.content}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 rounded-sm animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}

// ── Main chat component ───────────────────────────────────────────────────
export function AIChat({ items = [], occasion, temperature }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState(null);
  const [apiReady, setApiReady] = useState(null); // null = unknown

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Check API health on first open
  useEffect(() => {
    if (!open || apiReady !== null) return;
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setApiReady(d.apiKeyConfigured))
      .catch(() => setApiReady(false));
  }, [open, apiReady]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function sendMessage(text) {
    const userMessage = text.trim();
    if (!userMessage || streaming) return;
    setInput("");
    setError(null);

    const newMessages = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setStreaming(true);
    setStreamText("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          wardrobe: items,
          occasion,
          temperature,
        }),
      });

      if (!res.ok) {
        const { error: errMsg } = await res.json().catch(() => ({}));
        throw new Error(errMsg || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "delta") {
            fullText += event.text;
            setStreamText(fullText);
          } else if (event.type === "done") {
            setMessages([...newMessages, { role: "assistant", content: fullText }]);
            setStreamText("");
            setStreaming(false);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        setStreamText("");
        setStreaming(false);
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamText) {
      setMessages((prev) => [...prev, { role: "assistant", content: streamText }]);
      setStreamText("");
    }
  }

  function clearChat() {
    stopStreaming();
    setMessages([]);
    setError(null);
  }

  // Pill of wardrobe context shown in header
  const wardrobeLabel =
    items.length === 0
      ? "Guarda-roupa vazio"
      : `${items.length} ${items.length === 1 ? "peça" : "peças"}`;

  // ── Floating button ────────────────────────────────────────────────────
  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-medium text-sm transition-all duration-200 ${
          open
            ? "bg-gray-800 text-white"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        <span className="text-base">{open ? "✕" : "✦"}</span>
        <span>{open ? "Fechar" : "Estilista IA"}</span>
        {!open && messages.length > 0 && (
          <span className="ml-1 w-5 h-5 rounded-full bg-white text-black text-xs flex items-center justify-center font-bold">
            {messages.filter((m) => m.role === "assistant").length}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-40 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col bg-white rounded-2xl shadow-2xl border overflow-hidden"
          style={{ height: "520px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center">
                <span className="text-white text-sm">✦</span>
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Estilista IA</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{wardrobeLabel} · claude-opus-4-6</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* API key warning */}
          {apiReady === false && (
            <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>ANTHROPIC_API_KEY</strong> não configurada.<br />
              Adicione ao arquivo <code className="bg-amber-100 px-1 rounded">.env</code> e reinicie o servidor API.
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                  👗
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Olá! Sou seu estilista IA.</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Conheço seu guarda-roupa e posso sugerir looks,<br />
                    discutir tendências e ajudar a se vestir bem.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} isStreaming={false} />
            ))}

            {streaming && streamText && (
              <MessageBubble
                msg={{ role: "assistant", content: streamText }}
                isStreaming={true}
              />
            )}

            {streaming && !streamText && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center shrink-0">
                  <span className="text-white text-xs">✦</span>
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {error && (
              <div className="mx-auto max-w-[85%] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs text-center">
                ⚠ {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts (only when no messages) */}
          {messages.length === 0 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    disabled={streaming || items.length === 0}
                    className="text-[11px] px-2.5 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-400 text-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 border-t bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={items.length === 0 ? "Adicione peças ao guarda-roupa primeiro…" : "Pergunte sobre looks, estilos…"}
                disabled={items.length === 0}
                rows={1}
                className="flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                style={{ maxHeight: "80px", overflowY: "auto" }}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
              />
              {streaming ? (
                <button
                  onClick={stopStreaming}
                  className="w-10 h-10 rounded-xl bg-red-50 text-red-500 border border-red-200 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"
                  title="Parar"
                >
                  <span className="text-xs font-bold">■</span>
                </button>
              ) : (
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || items.length === 0}
                  className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
                  title="Enviar (Enter)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      )}
    </>
  );
}
