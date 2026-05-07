import { Link, useLocation } from "react-router-dom";
import { isLoggedIn, getUser, clearAuth } from "../lib/auth";
import { logoutApi } from "../lib/api";

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
      await logoutApi();
    } catch {}
    clearAuth();
    window.location.href = "/";
  };

  return (
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
        background: "rgba(0,0,0,0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link
        to="/"
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            color: "#000",
          }}
        >
          V
        </div>
        <span style={{ fontWeight: 600, fontSize: 15 }}>Validator</span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            fontFamily: "var(--mono)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          v0.42
        </span>
      </Link>
      <div style={{ display: "flex", gap: "0.25rem" }}>
        {LINKS.map(({ path, label }) => {
          const active = pathname === path;
          return (
            <Link
              key={path}
              to={path}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "var(--radius)",
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active ? "var(--bg-card)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {active && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                />
              )}
              {label}
            </Link>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {loggedIn ? (
          <>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>
              {user.display_name || user.email}
            </span>
            <button
              onClick={handleLogout}
              style={{
                fontSize: 12,
                padding: "0.35rem 0.8rem",
                borderRadius: "var(--radius)",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            style={{
              fontSize: 12,
              padding: "0.35rem 0.8rem",
              borderRadius: "var(--radius)",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
            }}
          >
            Sign in
          </Link>
        )}
        <Link
          to="/dashboard"
          style={{
            fontSize: 13,
            fontWeight: 500,
            padding: "0.4rem 1rem",
            borderRadius: "var(--radius)",
            background: "var(--accent)",
            color: "#000",
          }}
        >
          Launch →
        </Link>
      </div>
    </nav>
  );
}
