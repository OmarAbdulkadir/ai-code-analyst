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

  const statusDot = (s) => {
    if (!s) return "var(--text-3)";
    if (s === "approved") return "var(--success)";
    if (s === "rejected") return "var(--danger)";
    return "var(--text-3)";
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: 52 }}
    >
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
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
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--accent-dim)",
                border: "2px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 18,
                color: "var(--accent)",
                flexShrink: 0,
              }}
            >
              {initials(user.display_name || user.email)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {user.display_name || "Analyst"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {user.email}
              </div>
            </div>
          </div>
          {stats && (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
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
                <div
                  key={label}
                  style={{
                    textAlign: "center",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.5rem 0.9rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--text)",
                    }}
                  >
                    {value}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-3)",
                      letterSpacing: "0.08em",
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
            borderRadius: "var(--radius-lg)",
            padding: "1.25rem",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              letterSpacing: "0.1em",
              marginBottom: "1rem",
            }}
          >
            CODE HEALTH TREND
          </div>
          {trendData.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "var(--text-3)",
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
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                />
                <XAxis
                  dataKey="session"
                  label={{
                    value: "Session",
                    position: "insideBottom",
                    offset: -2,
                    fill: "var(--text-3)",
                    fontSize: 11,
                  }}
                  tick={{ fontSize: 11, fill: "var(--text-3)" }}
                />
                <YAxis
                  domain={[0, 100]}
                  label={{
                    value: "Score",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--text-3)",
                    fontSize: 11,
                  }}
                  tick={{ fontSize: 11, fill: "var(--text-3)" }}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#22d3ee"
                  fill="url(#trendGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sessions list */}
        <div
          style={{
            fontSize: 12,
            color: "var(--text-3)",
            letterSpacing: "0.1em",
            marginBottom: "0.75rem",
          }}
        >
          RECENT ANALYSES
        </div>
        {loading && (
          <div style={{ color: "var(--text-3)", fontSize: 13 }}>Loading...</div>
        )}
        {error && (
          <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>
        )}
        {!loading && !error && sessions.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "var(--text-3)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              fontSize: 13,
            }}
          >
            No sessions yet.{" "}
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                color: "var(--accent)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
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
            const preview = (s.source_code || "").split("\n")[0].slice(0, 40);
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "0.75rem 1rem",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: statusDot(valStatus),
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    color: "var(--text-2)",
                    minWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {preview || "(empty)"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeAgo(s.created_at)}
                </span>
                {speedup != null && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--accent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    +{speedup.toFixed(1)}%
                  </span>
                )}
                {dnaScore != null && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    DNA {dnaScore}/100
                  </span>
                )}
                {valStatus && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 3,
                      background:
                        valStatus === "approved"
                          ? "rgba(34,197,94,0.1)"
                          : "rgba(239,68,68,0.1)",
                      color: statusDot(valStatus),
                      textTransform: "uppercase",
                    }}
                  >
                    {valStatus}
                  </span>
                )}
                <button
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: "var(--radius)",
                    background: "var(--accent)",
                    border: "none",
                    color: "#000",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  View
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
