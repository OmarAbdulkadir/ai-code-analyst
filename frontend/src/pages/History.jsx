import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Navbar from "../components/Navbar";
import { getStats, getSessions } from "../lib/api";
import { getUser } from "../lib/auth";

const DNA_KEYS = [
  "complexity",
  "security",
  "performance",
  "readability",
  "bug_density",
  "optimization",
];

function avg(obj) {
  if (!obj) return null;
  const vals = DNA_KEYS.map((k) => obj[k] || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function statusBadgeClass(s) {
  if (s === "approved") return "badge-improved";
  if (s === "rejected") return "badge-failed";
  return "badge-unchanged";
}

export default function History() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => {});

    getSessions()
      .then((res) => setSessions(res.data))
      .catch(() => setError("Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  const trendData =
    stats?.score_trend?.map((v, i) => ({ session: i + 1, score: v })) || [];

  return (
    <>
      <style>{`
        .page-eyebrow {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: 8px;
        }
        .history-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          flex-wrap: wrap;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .history-card:hover {
          transform: translateY(-2px);
          border-color: var(--border-glow);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .badge-improved {
          background: rgba(0,255,200,0.1);
          color: #00ffc8;
          border: 1px solid rgba(0,255,200,0.25);
        }
        .badge-unchanged {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .badge-failed {
          background: rgba(255,68,68,0.1);
          color: #ff4444;
          border: 1px solid rgba(255,68,68,0.25);
        }
        .status-badge {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: 4px;
          padding: 3px 8px;
          white-space: nowrap;
        }
        .view-btn {
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 6px;
          background: var(--accent-cyan);
          border: none;
          color: #0a0a0a;
          font-weight: 600;
          font-family: var(--font-mono);
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .view-btn:hover {
          box-shadow: 0 0 12px rgba(0,255,200,0.4);
        }
        .stat-mini {
          text-align: center;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.5rem 0.9rem;
          transition: border-color 0.2s;
        }
        .stat-mini:hover { border-color: var(--border-glow); }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          paddingTop: 52,
        }}
      >
        <Navbar />
        <div
          style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}
        >
          {/* Profile header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "1rem",
              marginBottom: "2rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--accent-cyan-dim)",
                  border: "2px solid var(--accent-cyan)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "var(--accent-cyan)",
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                }}
              >
                {initials(user.display_name || user.email)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {user.display_name || "Analyst"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {user.email}
                </div>
              </div>
            </div>
            {stats && (
              <div
                style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}
              >
                {[
                  { label: "RUNS", value: stats.total_sessions },
                  { label: "BUGS FIXED", value: stats.total_bugs_fixed },
                  {
                    label: "AVG SCORE",
                    value: stats.avg_code_dna_score
                      ? `${stats.avg_code_dna_score}`
                      : "—",
                  },
                  {
                    label: "MEM SAVED",
                    value: `${stats.total_memory_saved_mb}MB`,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="stat-mini">
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: "var(--accent-cyan)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text-tertiary)",
                        letterSpacing: "0.08em",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend chart */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "24px",
              marginBottom: "2rem",
            }}
          >
            <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
              Code Health Trend
            </div>
            {trendData.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem",
                  color: "var(--text-tertiary)",
                  fontSize: 13,
                }}
              >
                No data yet — run your first analysis
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ffc8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00ffc8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                  />
                  <XAxis
                    dataKey="session"
                    tick={{
                      fontSize: 11,
                      fill: "rgba(255,255,255,0.3)",
                      fontFamily: "JetBrains Mono",
                    }}
                    label={{
                      value: "Session",
                      position: "insideBottom",
                      offset: -2,
                      fill: "rgba(255,255,255,0.3)",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 11,
                      fill: "rgba(255,255,255,0.3)",
                      fontFamily: "JetBrains Mono",
                    }}
                    label={{
                      value: "Score",
                      angle: -90,
                      position: "insideLeft",
                      fill: "rgba(255,255,255,0.3)",
                      fontSize: 11,
                    }}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#161616",
                      border: "1px solid rgba(0,255,200,0.25)",
                      borderRadius: "6px",
                      fontFamily: "JetBrains Mono",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#00ffc8"
                    fill="url(#trendGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sessions list */}
          <div className="page-eyebrow" style={{ marginBottom: "0.75rem" }}>
            Recent Analyses
          </div>

          {loading && (
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 13,
                fontFamily: "var(--font-mono)",
              }}
            >
              Loading...
            </div>
          )}
          {error && (
            <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>
          )}
          {!loading && !error && sessions.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "var(--text-tertiary)",
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              No sessions yet.{" "}
              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  color: "var(--accent-cyan)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                }}
              >
                Run your first analysis →
              </button>
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {sessions.map((s) => {
              const r = s.final_report || {};
              const valStatus = r.validation?.status;
              const speedup = r.validation?.speedup_percentage;
              const dnaScore = avg(r.optimized_dna);
              const preview = (s.source_code || "").split("\n")[0].slice(0, 60);
              return (
                <div key={s.id} className="history-card">
                  {/* Status dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background:
                        valStatus === "approved"
                          ? "var(--success)"
                          : valStatus === "rejected"
                            ? "var(--danger)"
                            : "var(--text-tertiary)",
                      flexShrink: 0,
                    }}
                  />

                  {/* Code preview */}
                  <code
                    style={{
                      flex: 1,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      minWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxHeight: 60,
                      background: "rgba(255,255,255,0.03)",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {preview || "(empty)"}
                  </code>

                  {/* Timestamp */}
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeAgo(s.created_at)}
                  </span>

                  {/* Speedup */}
                  {speedup != null && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--accent-cyan)",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      +{speedup.toFixed(1)}%
                    </span>
                  )}

                  {/* DNA score */}
                  {dnaScore != null && (
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      DNA {dnaScore}/100
                    </span>
                  )}

                  {/* Status badge */}
                  {valStatus && (
                    <span
                      className={`status-badge ${statusBadgeClass(valStatus)}`}
                    >
                      {valStatus}
                    </span>
                  )}

                  <button
                    className="view-btn"
                    onClick={() => navigate(`/sessions/${s.id}`)}
                  >
                    View
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
