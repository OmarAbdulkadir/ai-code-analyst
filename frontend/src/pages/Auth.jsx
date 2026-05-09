import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { isLoggedIn, saveAuth } from "../lib/auth";

export default function Auth() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isLoggedIn()) navigate("/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (tab === "login") {
        const { data, error: authError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        if (authError) throw authError;
        saveAuth(data.session.access_token, {
          id: data.user.id,
          email: data.user.email,
          display_name:
            data.user.user_metadata?.display_name ||
            data.user.email.split("@")[0],
        });
        navigate("/dashboard", { replace: true });
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          setSuccess(
            "Account created! Check your email to confirm before signing in.",
          );
          return;
        }
        saveAuth(data.session.access_token, {
          id: data.user.id,
          email: data.user.email,
          display_name: displayName || data.user.email.split("@")[0],
        });
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes authCardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,255,200,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(0,255,200,0); }
        }
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
        .auth-card {
          animation: authCardIn 0.5s ease forwards;
        }
        .auth-input {
          width: 100%;
          background: #0d0d0d;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px 14px;
          color: white;
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s ease;
          box-sizing: border-box;
        }
        .auth-input:focus {
          border-color: rgba(0,255,200,0.4);
        }
        .auth-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
        .auth-tab {
          flex: 1;
          padding: 8px;
          border: none;
          border-radius: 6px;
          font-family: var(--font-body);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .auth-tab-active {
          background: #222;
          color: white;
          font-weight: 500;
        }
        .auth-tab-inactive {
          background: transparent;
          color: rgba(255,255,255,0.4);
          font-weight: 400;
        }
        .auth-submit {
          width: 100%;
          padding: 12px;
          background: var(--accent-cyan);
          border: none;
          border-radius: 8px;
          color: #0a0a0a;
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-submit:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0,255,200,0.4);
          transform: scale(1.02);
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none !important;
        }
        .auth-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(10,10,10,0.3);
          border-top-color: #0a0a0a;
          border-radius: 50%;
          animation: authSpin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .auth-logo {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          background: var(--accent-cyan);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 22px;
          color: #0a0a0a;
          font-family: var(--font-display);
          animation: logoPulse 3s ease-in-out infinite;
          margin-bottom: 16px;
        }
        .auth-label {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.55);
          display: block;
          margin-bottom: 6px;
          font-family: var(--font-body);
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          className="auth-card"
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 40,
          }}
        >
          {/* Logo + header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div className="auth-logo">V</div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                color: "rgba(255,255,255,0.3)",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              AUTONOMOUS
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "1.8rem",
                color: "white",
                margin: 0,
              }}
            >
              Access the workspace
            </h1>
          </div>

          {/* Tab switcher */}
          <div
            style={{
              display: "flex",
              background: "#0d0d0d",
              borderRadius: 8,
              padding: 4,
              marginBottom: "1.5rem",
            }}
          >
            {[
              { key: "login", label: "Sign in" },
              { key: "signup", label: "Create account" },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`auth-tab ${tab === key ? "auth-tab-active" : "auth-tab-inactive"}`}
                onClick={() => {
                  setTab(key);
                  setError("");
                  setSuccess("");
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {tab === "signup" && (
              <div>
                <label className="auth-label">Display name</label>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="auth-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
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
                  background: "rgba(255,68,68,0.1)",
                  border: "1px solid rgba(255,68,68,0.3)",
                  color: "#ff6b6b",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: "rgba(0,255,200,0.08)",
                  border: "1px solid rgba(0,255,200,0.25)",
                  color: "#00ffc8",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                }}
              >
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="auth-submit">
              {loading && <span className="auth-spinner" />}
              {loading
                ? "..."
                : tab === "login"
                  ? "Sign in →"
                  : "Create account →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
