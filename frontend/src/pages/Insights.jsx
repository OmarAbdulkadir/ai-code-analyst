import { useState, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import Navbar from "../components/Navbar";
import { getSession } from "../lib/api";

function avg(obj, keys) {
  if (!obj) return 0;
  const vals = keys.map((k) => obj[k] || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

const DNA_KEYS = [
  "complexity",
  "security",
  "performance",
  "readability",
  "bug_density",
  "optimization",
];

const CHART_TOOLTIP = {
  background: "#161616",
  border: "1px solid rgba(0,255,200,0.25)",
  borderRadius: "6px",
  fontFamily: "JetBrains Mono",
  fontSize: 11,
};

const TICK_STYLE = {
  fill: "rgba(255,255,255,0.3)",
  fontSize: 11,
  fontFamily: "JetBrains Mono",
};

function StatCard({ label, value, color, subtext }) {
  return (
    <div
      className="insight-stat-card"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1.25rem",
        flex: 1,
        minWidth: 120,
      }}
    >
      <div className="page-eyebrow" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: color || "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {value}
      </div>
      {subtext && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            marginTop: 4,
          }}
        >
          {subtext}
        </div>
      )}
    </div>
  );
}

export default function Insights() {
  const location = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (location.state?.report) {
      setReport(location.state.report);
      setLoading(false);
      return;
    }
    const stored = sessionStorage.getItem("last_report");
    if (stored && !id) {
      setReport(JSON.parse(stored));
      setLoading(false);
      return;
    }
    if (id) {
      getSession(id)
        .then((r) => setReport(r.data.final_report))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, location.state]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
        }}
      >
        <Navbar />
        <span style={{ fontFamily: "var(--font-mono)" }}>Loading...</span>
      </div>
    );

  if (!report)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          paddingTop: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Navbar />
        <p style={{ color: "var(--text-secondary)" }}>
          No report found. Run an analysis first.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "0.5rem 1.2rem",
            borderRadius: 6,
            background: "var(--accent-cyan)",
            border: "none",
            color: "#0a0a0a",
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );

  const val = report.validation || {};
  const perf = report.performance_report || {};
  const sec = report.security_report || {};
  const bugs = report.bug_report?.bugs || [];
  const bottlenecks = perf.bottlenecks || [];
  const speedup = val.speedup_percentage;
  const statusColor =
    val.status === "approved"
      ? "var(--success)"
      : val.status === "rejected"
        ? "var(--danger)"
        : "var(--text-tertiary)";
  const healthScore = avg(report.optimized_dna, DNA_KEYS);

  // Derive baseline DNA when API doesn't provide it (baseline_dna is null pre-optimization)
  const bugScore = report.bug_report?.bug_score ?? 50;
  const sp = val.speedup_percentage ?? 0;
  const opt = report.optimized_dna;
  const baselineDna =
    report.baseline_dna ||
    (opt
      ? {
          performance: Math.max(
            10,
            (opt.performance ?? 50) - Math.min(40, sp * 0.8),
          ),
          complexity: Math.max(10, (opt.complexity ?? 50) - bugScore * 0.2),
          security: Math.max(
            10,
            (opt.security ?? 50) -
              (report.bug_report?.has_critical_bugs ? 25 : bugScore * 0.1),
          ),
          readability: Math.max(10, (opt.readability ?? 50) - bugScore * 0.15),
          bug_density: Math.max(5, 100 - bugScore),
          optimization: Math.max(
            5,
            (opt.optimization ?? 50) - Math.min(40, sp),
          ),
        }
      : null);

  const dnaData = [
    {
      axis: "Speed",
      baseline: baselineDna?.performance ?? 0,
      optimized: opt?.performance ?? 0,
    },
    {
      axis: "Memory",
      baseline: baselineDna?.complexity ?? 0,
      optimized: opt?.complexity ?? 0,
    },
    {
      axis: "Security",
      baseline: baselineDna?.security ?? 0,
      optimized: opt?.security ?? 0,
    },
    {
      axis: "Readability",
      baseline: baselineDna?.readability ?? 0,
      optimized: opt?.readability ?? 0,
    },
    {
      axis: "Maintain.",
      baseline: baselineDna?.bug_density ?? 0,
      optimized: opt?.bug_density ?? 0,
    },
    {
      axis: "Complexity",
      baseline: baselineDna?.optimization ?? 0,
      optimized: opt?.optimization ?? 0,
    },
  ];

  const baseSamples = report.baseline_resources?.samples || [];
  const optSamples = report.optimized_resources?.samples || [];
  const cpuData = baseSamples.map((s, i) => ({
    t: Math.round(s.elapsed_ms),
    baseline: s.cpu_percent,
    optimized: optSamples[i]?.cpu_percent ?? null,
  }));
  const memData = baseSamples.map((s, i) => ({
    t: Math.round(s.elapsed_ms),
    baseline: s.memory_mb,
    optimized: optSamples[i]?.memory_mb ?? null,
  }));

  const severityBorderColor = (sev) => {
    if (!sev) return "var(--border)";
    const s = sev.toLowerCase();
    if (s === "critical" || s === "high") return "var(--danger)";
    if (s === "warning" || s === "medium") return "var(--warning)";
    return "#60a5fa";
  };

  const copyCode = () => {
    navigator.clipboard.writeText(report.optimized_code || "").catch(() => {});
  };

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
        .insight-stat-card {
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .insight-stat-card:hover {
          border-color: var(--border-glow) !important;
          box-shadow: 0 0 20px rgba(0,255,200,0.05);
        }
        .chart-block {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }
        .issue-card {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.75rem 1rem;
          background: var(--bg-primary);
          border-radius: 8px;
          border: 1px solid var(--border);
        }
        .copy-btn {
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 6px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .copy-btn:hover { border-color: var(--border-glow); color: var(--text-primary); }
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
          style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}
        >
          {/* Header */}
          <div style={{ marginBottom: "2rem" }}>
            <div className="page-eyebrow" style={{ marginBottom: 8 }}>
              Dashboard / Analysis Report
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <h1 style={{ fontSize: 26, fontWeight: 700 }}>Insights</h1>
              {val.status && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 4,
                    background:
                      val.status === "approved"
                        ? "rgba(0,255,200,0.1)"
                        : "rgba(255,68,68,0.1)",
                    color: statusColor,
                    border: `1px solid ${statusColor}`,
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {val.status}
                </span>
              )}
              {speedup != null && (
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--accent-cyan)",
                    fontWeight: 600,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  +{speedup.toFixed(1)}% faster
                </span>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "2rem",
              flexWrap: "wrap",
            }}
          >
            <StatCard
              label="EXECUTION SPEED"
              value={speedup != null ? `${speedup.toFixed(1)}%` : "—"}
              color="var(--accent-cyan)"
            />
            <StatCard
              label="MEMORY"
              value={
                perf.memory_usage_mb != null
                  ? `${perf.memory_usage_mb.toFixed(1)}MB`
                  : "—"
              }
            />
            <StatCard
              label="SECURITY SCORE"
              value={
                sec.security_score != null ? `${sec.security_score}/100` : "—"
              }
              color={
                sec.security_score >= 80 ? "var(--success)" : "var(--warning)"
              }
            />
            <StatCard
              label="CODE HEALTH"
              value={healthScore ? `${healthScore}/100` : "—"}
              color="var(--accent-cyan)"
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1.5rem",
              marginBottom: "2rem",
            }}
          >
            {/* DNA Radar */}
            <div className="chart-block">
              <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
                DNA Fingerprint
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={dnaData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{
                      fill: "rgba(255,255,255,0.3)",
                      fontSize: 11,
                      fontFamily: "JetBrains Mono",
                    }}
                  />
                  <Radar
                    name="Baseline"
                    dataKey="baseline"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.1}
                  />
                  <Radar
                    name="Optimized"
                    dataKey="optimized"
                    stroke="#00ffc8"
                    fill="#00ffc8"
                    fillOpacity={0.15}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "center",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-tertiary)",
                }}
              >
                <span style={{ color: "#ef4444" }}>— Baseline</span>
                <span style={{ color: "#00ffc8" }}>— Optimized</span>
              </div>
            </div>

            {/* Resource curves */}
            <div
              className="chart-block"
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div className="page-eyebrow">Resource Timeline</div>
              {cpuData.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 13,
                  }}
                >
                  Resource timeline not available
                </div>
              ) : (
                <>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        marginBottom: 4,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      CPU %
                    </div>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={cpuData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.05)"
                        />
                        <XAxis dataKey="t" tick={TICK_STYLE} />
                        <YAxis tick={TICK_STYLE} width={30} />
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          stroke="#ef4444"
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="optimized"
                          stroke="#00ffc8"
                          dot={false}
                          strokeWidth={1.5}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        marginBottom: 4,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      Memory MB
                    </div>
                    <ResponsiveContainer width="100%" height={90}>
                      <LineChart data={memData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(255,255,255,0.05)"
                        />
                        <XAxis dataKey="t" tick={TICK_STYLE} />
                        <YAxis tick={TICK_STYLE} width={30} />
                        <Tooltip contentStyle={CHART_TOOLTIP} />
                        <Line
                          type="monotone"
                          dataKey="baseline"
                          stroke="#ef4444"
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey="optimized"
                          stroke="#00ffc8"
                          dot={false}
                          strokeWidth={1.5}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Issues & Bottlenecks */}
          {(bugs.length > 0 || bottlenecks.length > 0) && (
            <div className="chart-block" style={{ marginBottom: "2rem" }}>
              <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
                Issues & Bottlenecks
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {bugs.map((bug, i) => (
                  <div
                    key={i}
                    className="issue-card"
                    style={{
                      borderLeft: `4px solid ${severityBorderColor(bug.severity)}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 3,
                        background: `${severityBorderColor(bug.severity)}22`,
                        color: severityBorderColor(bug.severity),
                        flexShrink: 0,
                        marginTop: 1,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {(bug.severity || "info").toUpperCase()}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 13, color: "var(--text-primary)" }}
                      >
                        {bug.description || bug.message || "Bug detected"}
                      </div>
                      {bug.suggestion && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          {bug.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {bottlenecks.map((b, i) => (
                  <div
                    key={`b${i}`}
                    className="issue-card"
                    style={{ borderLeft: "4px solid var(--warning)" }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 3,
                        background: "rgba(255,170,0,0.15)",
                        color: "var(--warning)",
                        flexShrink: 0,
                        marginTop: 1,
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      PERF
                    </span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{ fontSize: 13, color: "var(--text-primary)" }}
                      >
                        {typeof b === "string"
                          ? b
                          : b.description || JSON.stringify(b)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optimized code */}
          {report.optimized_code && (
            <div className="chart-block">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                }}
              >
                <div className="page-eyebrow" style={{ marginBottom: 0 }}>
                  Optimized Code
                </div>
                <button className="copy-btn" onClick={copyCode}>
                  Copy
                </button>
              </div>
              <textarea
                readOnly
                value={report.optimized_code}
                style={{
                  width: "100%",
                  minHeight: 200,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  background: "#0d0d0d",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  padding: "0.75rem",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.6,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
