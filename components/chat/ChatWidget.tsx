"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessBrief } from "@/lib/schemas/brief";
import { buildWelcomeMessage } from "@/lib/ai/prompts/chatPrompt";
import "./ChatWidget.css";

/* ---------------------------------------------------------------- types */

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/* ---------------------------------------------------------------- icons */

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

/* --------------------------------------------------------- typing dots */

function TypingIndicator() {
  return (
    <div className="chat-typing" aria-label="El asistente está escribiendo">
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
      <span className="chat-typing-dot" />
    </div>
  );
}

/* ----------------------------------------------------------- component */

/**
 * A floating, collapsible chatbot that lives inside the page-scope of a
 * generated landing page. It receives the full business context (brief +
 * original description) and sends it with every request so the server-side
 * system prompt can be constructed.
 *
 * Streaming: the component reads the plain-text ReadableStream from
 * /api/chat and progressively appends tokens to the assistant message.
 */
export function ChatWidget({
  brief,
  description,
}: {
  brief: BusinessBrief;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);

  /* ----------- auto-scroll on new content */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming, scrollToBottom]);

  /* ----------- welcome message on first open */
  useEffect(() => {
    if (open && !initializedRef.current) {
      initializedRef.current = true;
      setMessages([
        {
          role: "assistant",
          content: buildWelcomeMessage(brief),
        },
      ]);
    }
    if (open) {
      // Focus the input when the panel opens.
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, brief]);

  /* ----------- close with animation */
  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 220);
  }

  function toggleOpen() {
    if (open) {
      handleClose();
    } else {
      setOpen(true);
    }
  }

  /* ----------- send a message */
  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setStreaming(true);

    // Build the history to send (exclude the welcome message for cleaner context).
    // Only send the last 20 messages.
    const history = updatedMessages
      .slice(-20)
      .slice(0, -1) // exclude the current message — it goes in `message`
      .map(({ role, content }) => ({ role, content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          brief,
          description,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? `La solicitud falló (${response.status}).`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se recibió una respuesta del servicio.");

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add a placeholder assistant message.
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        const snapshot = assistantContent;

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: snapshot,
          };
          return next;
        });
      }

      // If the stream produced nothing, show a fallback.
      if (!assistantContent.trim()) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "No pude generar una respuesta. Inténtalo de nuevo.",
          };
          return next;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(
        err instanceof TypeError
          ? "No se pudo conectar con el chat. Inténtalo de nuevo."
          : err instanceof Error
            ? err.message
            : "Ocurrió un error. Inténtalo de nuevo.",
      );
      // Remove the empty assistant placeholder on error.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  /* ----------- handle Enter to send, Shift+Enter for newline */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  /* ---------------------------------------------------------------- JSX */

  return (
    <>
      {/* Floating Action Button */}
      <button
        id="chat-fab"
        type="button"
        className="chat-fab"
        data-open={open ? "true" : "false"}
        onClick={toggleOpen}
        aria-label={open ? "Cerrar chat" : "Abrir asistente de chat"}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          className="chat-panel"
          data-closing={closing ? "true" : undefined}
          role="dialog"
          aria-label={`Chat con ${brief.businessName}`}
        >
          {/* Header */}
          <div className="chat-header">
            <span className="chat-header-dot" />
            <span className="chat-header-title">
              {brief.businessName}
            </span>
            <button
              type="button"
              className="chat-header-close"
              onClick={handleClose}
              aria-label="Cerrar chat"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div className="chat-messages" aria-live="polite">
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`chat-bubble chat-bubble-${msg.role}`}
              >
                {msg.content}
              </div>
            ))}

            {streaming &&
              messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}

            {error && <div className="chat-error">{error}</div>}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Escribe tu pregunta…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={streaming}
              aria-label="Mensaje para el chat"
            />
            <button
              type="button"
              className="chat-send"
              onClick={() => void send()}
              disabled={streaming || !input.trim()}
              aria-label="Enviar mensaje"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
