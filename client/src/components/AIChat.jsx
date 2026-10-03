// client/src/components/AIChat.jsx
// Standalone AI assistant chat (like Meta AI in WhatsApp). Ask anything, follow-ups supported.
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Sparkles, Trash2 } from "lucide-react";

const SUGGESTIONS = [
  "Explain how useEffect works in React",
  "Write a polite message to reschedule a meeting",
  "Give me 5 tips to learn programming faster",
];

const aiAvatar = {
  width: 42, height: 42, borderRadius: "50%", display: "flex",
  alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0,
  background: "linear-gradient(135deg,#7b7cff,#c46bff)",
};

// **bold** support (AI replies often use it)
function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function AIChat({ api, token, messages, setMessages, isMobile, onBack }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function send(preset) {
    const question = (preset ?? text).trim();
    if (!question || loading) return;

    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role === "ai" ? "model" : "user", text: m.text }));

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setText("");
    setLoading(true);

    try {
      const res = await fetch(`${api}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "ai", text: e.message, error: true }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="panel chat-panel">
      <div className="chat-header">
        {isMobile && (
          <button className="icon-btn sm" onClick={onBack} title="Back"><ArrowLeft size={18} /></button>
        )}
        <div style={aiAvatar}><Sparkles size={20} /></div>
        <div className="head-info">
          <p className="head-name">AI Assistant</p>
          <p className="head-status">Ask me anything</p>
        </div>
        <div className="head-actions">
          {messages.length > 0 && (
            <button className="icon-btn" title="Clear chat" onClick={() => setMessages([])}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>

      <div className="msg-wrapper">
        <div className="msg-scroll">
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 16px", opacity: 0.9 }}>
              <div style={{ ...aiAvatar, width: 64, height: 64, margin: "0 auto 12px" }}>
                <Sparkles size={30} />
              </div>
              <p style={{ fontWeight: 600, fontSize: 18, margin: "0 0 4px" }}>How can I help you today?</p>
              <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 18px" }}>
                Ask a question, get help with a problem, or just chat.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      background: "transparent", color: "inherit", cursor: "pointer",
                      border: "1px solid rgba(124,92,255,0.5)", borderRadius: 999,
                      padding: "8px 14px", fontSize: 13, maxWidth: 360,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const mine = m.role === "user";
            return (
              <div key={i} className={`msg ${mine ? "mine" : "recv"}`}>
                <div className="msg-row">
                  <div
                    className={`bubble ${mine ? "mine" : "recv"}`}
                    style={{ whiteSpace: "pre-wrap", ...(m.error ? { color: "#e5484d" } : {}) }}
                  >
                    {renderInline(m.text)}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="typing">
              <span className="typing-dot" style={{ animationDelay: "0s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <div className="composer">
          <input
            ref={inputRef}
            className="msg-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask AI anything..."
            maxLength={2000}
            disabled={loading}
          />
          <button className="send-btn" onClick={() => send()} disabled={loading || !text.trim()} title="Send">
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}