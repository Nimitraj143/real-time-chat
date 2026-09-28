import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "https://real-time-chat-vt6f.onrender.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  info: {
    color: "#3fa77a", fontSize: 13,
    marginBottom: 10, textAlign: "center",
    position: "relative", zIndex: 1,
  },
  link: {
    textAlign: "center", marginTop: 16, cursor: "pointer",
    color: "#7c83d0", fontSize: 13,
    position: "relative", zIndex: 1,
  },
};

const focusShadow = "inset 6px 6px 12px #ccceda, inset -4px -4px 8px #fff, 0 0 0 1.5px #7c83d0";
const blurShadow  = "inset 5px 5px 10px #d0d2dc, inset -5px -5px 10px #ffffff";

function Field({ label, ...props }) {
  return (
    <>
      <label style={styles.label}>{label}</label>
      <input
        {...props}
        required
        style={styles.input}
        onFocus={e => (e.target.style.boxShadow = focusShadow)}
        onBlur={e => (e.target.style.boxShadow = blurShadow)}
      />
    </>
  );
}

const TITLES = {
  login:    ["Welcome back", "Sign in to your chat"],
  register: ["Create Account", "Join the chat"],
  forgot:   ["Forgot Password", "We'll email you a 6-digit OTP"],
  reset:    ["Reset Password", "Enter the OTP and a new password"],
};

export default function LoginPage() {
  // mode: "login" | "register" | "forgot" | "reset"
  const [mode, setMode]               = useState("login");
  const [username, setUsername]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [otp, setOtp]                 = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError]             = useState("");
  const [info, setInfo]               = useState("");
  const [loading, setLoading]         = useState(false);
  const navigate = useNavigate();

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    // ----- client side checks -----
    if (mode === "register") {
      if (!EMAIL_RE.test(email)) { setError("Enter a valid email address"); return; }
      if (password.length < 8)   { setError("Password must be at least 8 characters"); return; }
    }
    if (mode === "forgot" && !EMAIL_RE.test(email)) { setError("Enter a valid email address"); return; }
    if (mode === "reset" && newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }

    setLoading(true);
    try {
      if (mode === "forgot") {
        await axios.post(`${API}/api/auth/forgot-password`, { email });
        setMode("reset");
        setInfo("If this email is registered, an OTP has been sent (valid 10 min).");
        return;
      }

      if (mode === "reset") {
        const { data } = await axios.post(`${API}/api/auth/reset-password`, { email, otp, newPassword });
        setMode("login");
        setPassword(""); setOtp(""); setNewPassword("");
        setInfo(data.message || "Password reset successful. Please login.");
        return;
      }

      const body = mode === "register" ? { username, email, password } : { username, password };
      const { data } = await axios.post(`${API}/api/auth/${mode}`, body);
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      navigate("/chat");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const [title, sub] = TITLES[mode];
  const btnText = { login: "Login", register: "Register", forgot: "Send OTP", reset: "Reset Password" }[mode];

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.orb1} />
        <div style={styles.orb2} />

        <h2 style={styles.title}>{title}</h2>
        <p style={styles.sub}>{sub}</p>

        <form onSubmit={submit}>
          {(mode === "login" || mode === "register") && (
            <Field label="Username" placeholder="your username" value={username}
              onChange={e => setUsername(e.target.value)} />
          )}

          {(mode === "register" || mode === "forgot" || mode === "reset") && (
            <Field label="Email" type="email" placeholder="you@gmail.com" value={email}
              onChange={e => setEmail(e.target.value)} readOnly={mode === "reset"} />
          )}

          {(mode === "login" || mode === "register") && (
            <Field label="Password" type="password" placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} />
          )}

          {mode === "reset" && (
            <>
              <Field label="OTP" inputMode="numeric" maxLength={6} placeholder="6-digit OTP" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} />
              <Field label="New Password" type="password" placeholder="min 8 characters" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} />
            </>
          )}

          {error && <p style={styles.error}>{error}</p>}
          {info  && <p style={styles.info}>{info}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.target.style.transform = "translateY(0)"; }}
          >
            {loading ? "Please wait…" : btnText}
          </button>
        </form>

        {mode === "login" && (
          <p onClick={() => switchMode("forgot")} style={styles.link}>Forgot password?</p>
        )}

        {(mode === "login" || mode === "register") ? (
          <p onClick={() => switchMode(mode === "login" ? "register" : "login")}
             style={{ ...styles.link, marginTop: 10 }}>
            {mode === "register" ? "Already have an account? Login" : "Don't have an account? Register"}
          </p>
        ) : (
          <p onClick={() => switchMode("login")} style={{ ...styles.link, marginTop: 10 }}>
            Back to login
          </p>
        )}
      </div>
    </div>
  );
}