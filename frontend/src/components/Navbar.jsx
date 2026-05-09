import { Link, useLocation } from "react-router-dom";
import { isLoggedIn, getUser, clearAuth } from "../lib/auth";
import { supabase } from "../lib/supabaseClient";

const LINKS = [
  { path: "/", label: "Home" },
  { path: "/dashboard", label: "Dashboard" },
  { path: "/insights", label: "Insights" },
  { path: "/about", label: "About" },
  { path: "/history", label: "History" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const loggedIn = isLoggedIn();
  const user = getUser();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    clearAuth();
    window.location.href = "/";
  };

  return (
    <>
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .nav-logo { text-decoration: none; }
        .nav-logo:hover .v-icon { filter: brightness(1.2); }
        .nav-logo:hover .version-badge { box-shadow: 0 0 8px rgba(0,255,200,0.3); }
        .nav-link {
          padding: 0.35rem 0.85rem;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 400;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          text-decoration: none;
          transition: color 0.2s;
          border-bottom: 2px solid transparent;
        }
        .nav-link:hover { color: var(--text-primary); }
        .nav-link.active {
          color: var(--text-primary);
          font-weight: 500;
          border-bottom: 2px solid var(--accent-cyan);
        }
        .launch-btn {
          font-size: 13px;
          font-weight: 600;
          padding: 0.4rem 1rem;
          border-radius: 6px;
          background: var(--accent-cyan);
          color: #0a0a0a;
          font-family: var(--font-mono);
          text-decoration: none;
          transition: all 0.2s ease;
          display: inline-block;
        }
        .launch-btn:hover {
          box-shadow: 0 0 20px rgba(0,255,200,0.4);
          transform: scale(1.03);
        }
        .logout-btn {
          font-size: 12px;
          padding: 0.35rem 0.8rem;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
        }
        .logout-btn:hover { color: var(--text-primary); border-color: rgba(255,255,255,0.2); }
        .signin-link {
          font-size: 12px;
          padding: 0.35rem 0.8rem;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s, border-color 0.2s;
        }
        .signin-link:hover { color: var(--text-primary); border-color: rgba(255,255,255,0.2); }
      `}</style>

      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2rem",
          height: 52,
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          className="nav-logo"
          style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        >
          <div
            className="v-icon"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "var(--accent-cyan)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
              animation: "logoPulse 3s ease-in-out infinite",
              transition: "filter 0.2s",
            }}
          >
            V
          </div>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text-primary)",
            }}
          >
            Validator
          </span>
          <span
            className="version-badge"
            style={{
              fontSize: 11,
              color: "rgba(0,255,200,0.7)",
              fontFamily: "var(--font-mono)",
              background: "var(--bg-card)",
              border: "1px solid rgba(0,255,200,0.3)",
              padding: "1px 6px",
              borderRadius: 4,
              transition: "box-shadow 0.2s",
            }}
          >
            v0.42
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {LINKS.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`nav-link${pathname === path ? " active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Auth + Launch */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {loggedIn ? (
            <>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {user.display_name || user.email}
              </span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="signin-link">
              Sign in
            </Link>
          )}
          <Link to="/dashboard" className="launch-btn">
            Launch →
          </Link>
        </div>
      </nav>
    </>
  );
}
