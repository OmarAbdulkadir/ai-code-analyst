import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { login, signup } from "../lib/api";
import { isLoggedIn, saveAuth } from "../lib/auth";

export default function Auth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoggedIn()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let res;
      if (tab === "login") {
        res = await login(email, password);
      } else {
        res = await signup(email, password, displayName);
      }
      const { access_token, user } = res.data;
      if (!access_token) {
        setError("No token returned. Check your email for confirmation.");
        return;
      }
      saveAuth(access_token, user);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "var(--accent)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 22,
              color: "#000",
              marginBottom: "1rem",
            }}
          >
            V
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "0.5rem",
            }}
          >
            AUTONOMOUS
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)" }}>
            Access the workspace
          </h1>
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 3,
            marginBottom: "1.5rem",
          }}
        >
          {["login", "signup"].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "var(--radius)",
                background:
                  tab === t ? "rgba(255,255,255,0.08)" : "transparent",
                border: "none",
                color: tab === t ? "var(--text)" : "var(--text-2)",
                fontSize: 13,
                fontWeight: tab === t ? 500 : 400,
              }}
            >
              {t === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {tab === "signup" && (
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Display name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: "var(--danger)",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "var(--radius)",
                padding: "0.6rem 0.9rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "0.5rem",
              padding: "0.7rem",
              borderRadius: "var(--radius)",
              background: loading ? "rgba(34,211,238,0.5)" : "var(--accent)",
              border: "none",
              color: "#000",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {loading
              ? "Working..."
              : tab === "login"
                ? "Sign in →"
                : "Create account →"}
          </button>
        </form>
      </div>
    </div>
  );
}
