import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#e8eaf0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
  },
  card: {
    background: "#e8eaf0",
    borderRadius: 24,
    padding: "44px 38px",
    width: 340,
    position: "relative",
    overflow: "hidden",
    boxShadow: "10px 10px 22px #d0d2dc, -10px -10px 22px #ffffff",
  },
  orb1: {
    position: "absolute", borderRadius: "50%",
    width: 200, height: 200, top: -60, left: -60,
    background: "#7c83d0", filter: "blur(48px)",
    opacity: 0.28, pointerEvents: "none",
  },
  orb2: {
    position: "absolute", borderRadius: "50%",
    width: 160, height: 160, bottom: -50, right: -40,
    background: "#a78bda", filter: "blur(48px)",
    opacity: 0.28, pointerEvents: "none",
  },
  title: {
    color: "#3a3f5c", fontSize: 22, fontWeight: 500,
    textAlign: "center", margin: "0 0 4px",
    position: "relative", zIndex: 1,
  },
  sub: {
    color: "#8b90aa", fontSize: 13,
    textAlign: "center", margin: "0 0 28px",
    position: "relative", zIndex: 1,
  },
  label: {
    fontSize: 11, color: "#7a7f9a", marginBottom: 7,
    letterSpacing: "0.8px", textTransform: "uppercase",
    display: "block", position: "relative", zIndex: 1,
  },
  input: {
    background: "#e8eaf0", border: "none", outline: "none",
    width: "100%", boxSizing: "border-box",
    padding: "13px 16px", borderRadius: 12,
    fontSize: 14, color: "#3a3f5c", marginBottom: 20,
    position: "relative", zIndex: 1, display: "block",
    boxShadow: "inset 5px 5px 10px #d0d2dc, inset -5px -5px 10px #ffffff",
    fontFamily: "inherit",
  },
  button: {
    width: "100%", padding: 14, border: "none",
    borderRadius: 12, fontSize: 15, fontWeight: 500,
    cursor: "pointer", marginTop: 4,
    position: "relative", zIndex: 1,
    background: "linear-gradient(135deg, #7c83d0 0%, #a78bda 100%)",
    color: "#fff", letterSpacing: "0.3px",
    boxShadow: "4px 4px 12px rgba(124,131,208,.4), -2px -2px 6px rgba(255,255,255,.5)",
    transition: "opacity .15s, transform .1s",
    fontFamily: "inherit",
  },
  error: {
    color: "#e07a8a", fontSize: 13,
    marginBottom: 10, textAlign: "center",
    position: "relative", zIndex: 1,
  },
  link: {
    textAlign: "center", marginTop: 20, cursor: "pointer",
    color: "#7c83d0", fontSize: 13,
    position: "relative", zIndex: 1,
  },
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const endpoint = isRegister ? "register" : "login";
    try {
      const { data } = await axios.post(`http://localhost:5000/api/auth/${endpoint}`, { username, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />

        <h2 style={styles.title}>{isRegister ? "Create Account" : "Welcome back"}</h2>
        <p style={styles.sub}>{isRegister ? "Join the chat" : "Sign in to your chat"}</p>

        <form onSubmit={submit}>
          <label style={styles.label}>Username</label>
          <input
            placeholder="you@example.com"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={styles.input}
            onFocus={e => e.target.style.boxShadow = "inset 6px 6px 12px #ccceda, inset -4px -4px 8px #fff, 0 0 0 1.5px #7c83d0"}
            onBlur={e => e.target.style.boxShadow = "inset 5px 5px 10px #d0d2dc, inset -5px -5px 10px #ffffff"}
          />
          <label style={styles.label}>Password</label>
          <input
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={styles.input}
            onFocus={e => e.target.style.boxShadow = "inset 6px 6px 12px #ccceda, inset -4px -4px 8px #fff, 0 0 0 1.5px #7c83d0"}
            onBlur={e => e.target.style.boxShadow = "inset 5px 5px 10px #d0d2dc, inset -5px -5px 10px #ffffff"}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            style={styles.button}
            onMouseEnter={e => { e.target.style.opacity = "0.9"; e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.target.style.opacity = "1"; e.target.style.transform = "translateY(0)"; }}
          >
            {isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p
          onClick={() => setIsRegister(!isRegister)}
          style={styles.link}
        >
          {isRegister ? "Already have an account? Login" : "Don't have an account? Register"}
        </p>
      </div>
    </div>
  );
}