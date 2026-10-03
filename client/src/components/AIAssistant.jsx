// client/src/components/AIAssistant.jsx
// Do components: <ExplainButton /> (har message par) aur <AskAIPanel /> (sawaal poochne ke liye)
import { useState, useEffect } from "react";

// `api` prop mein apna server URL pass karo (jaise ChatPage.jsx wala API const)
async function callAI(api, path, token, body) {
  const res = await fetch(`${api}/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

const MODES = [
  { id: "simple", label: "Simple language" },
  { id: "translate_hi", label: "Hindi" },
  { id: "translate_en", label: "English" },
  { id: "tone", label: "Tone" },
  { id: "reply", label: "Suggest reply" },
];

const styles = {
  btn: { background: "none", border: "none", cursor: "pointer", fontSize: 12, opacity: 0.7, padding: 2 },
  card: {
    marginTop: 6, padding: 10, borderRadius: 8, fontSize: 13, lineHeight: 1.5,
    background: "rgba(124,92,255,0.12)", border: "1px solid rgba(124,92,255,0.35)", whiteSpace: "pre-wrap",
  },
  chip: (active) => ({
    fontSize: 11, padding: "2px 8px", borderRadius: 999, cursor: "pointer",
    border: "1px solid rgba(124,92,255,0.5)",
    background: active ? "rgba(124,92,255,0.5)" : "transparent", color: "inherit",
  }),
  err: { color: "#e5484d", fontSize: 12, marginTop: 4 },
};

/** Message ke neeche lagao: <ExplainButton api={API} token={token} convId={convId} messageId={msg._id} /> */
export function ExplainButton({ api, token, convId, messageId }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("simple");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run(m) {
    setMode(m);
    setLoading(true);
    setError("");
    try {
      const data = await callAI(api, "explain", token, { convId, messageId, mode: m });
      setText(data.explanation);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open && !text) run(mode);
    setOpen(!open);
  }

  return (
    <div>
      <button style={styles.btn} onClick={toggle} aria-expanded={open}>
        ✨ Explain
      </button>
      {open && (
        <div style={styles.card}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {MODES.map((m) => (
              <button key={m.id} style={styles.chip(mode === m.id)} onClick={() => run(m.id)} disabled={loading}>
                {m.label}
              </button>
            ))}
          </div>
          {loading ? "AI is thinking..." : text}
          {error && <div style={styles.err}>{error}</div>}
        </div>
      )}
    </div>
  );
}


/** Message ke "..." menu se khulta hai. Khulte hi explain kar deta hai. */
export function ExplainCard({ api, token, convId, messageId, onClose }) {
  const [mode, setMode] = useState("simple");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function run(m) {
    setMode(m);
    setLoading(true);
    setError("");
    try {
      const data = await callAI(api, "explain", token, { convId, messageId, mode: m });
      setText(data.explanation);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run("simple"); }, [messageId]);

  return (
    <div style={{ ...styles.card, maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        {MODES.map((m) => (
          <button key={m.id} style={styles.chip(mode === m.id)} onClick={() => run(m.id)} disabled={loading}>
            {m.label}
          </button>
        ))}
        <button style={{ ...styles.btn, marginLeft: "auto" }} onClick={onClose} title="Close">✕</button>
      </div>
      {loading ? "AI is thinking..." : text}
      {error && <div style={styles.err}>{error}</div>}
    </div>
  );
}

/** Sidebar/modal mein lagao: <AskAIPanel api={API} token={token} convId={convId} /> */
export function AskAIPanel({ api, token, convId }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [useChat, setUseChat] = useState(false);

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    try {
      const data = await callAI(api, "ask", token, {
        question,
        convId: useChat ? convId : undefined,
      });
      setAnswer(data.answer);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
        placeholder="Ask anything..."
        rows={3}
        maxLength={2000}
        style={{ width: "100%", boxSizing: "border-box" }}
      />
      <label style={{ fontSize: 12, display: "block", margin: "6px 0" }}>
        <input type="checkbox" checked={useChat} onChange={(e) => setUseChat(e.target.checked)} />{" "}
        Use this chat as context
      </label>
      <button onClick={ask} disabled={loading || !question.trim()}>
        {loading ? "Thinking..." : "Ask AI"}
      </button>
      {error && <div style={styles.err}>{error}</div>}
      {answer && <div style={styles.card}>{answer}</div>}
    </div>
  );
}