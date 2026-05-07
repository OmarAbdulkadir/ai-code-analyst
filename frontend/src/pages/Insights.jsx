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

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        flex: 1,
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          letterSpacing: "0.1em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontSize: 26, fontWeight: 700, color: color || "var(--text)" }}
      >
        {value}
      </div>
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
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-2)",
        }}
      >
        <Navbar />
        <span>Loading...</span>
      </div>
    );

  if (!report)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          paddingTop: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <Navbar />
        <p style={{ color: "var(--text-2)" }}>
          No report found. Run an analysis first.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "0.5rem 1.2rem",
            borderRadius: "var(--radius)",
            background: "var(--accent)",
            border: "none",
            color: "#000",
            fontWeight: 600,
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
        : "var(--text-3)";
  const healthScore = avg(report.optimized_dna, DNA_KEYS);

  const dnaData = [
    {
      axis: "Speed",
      baseline: report.baseline_dna?.performance ?? 0,
      optimized: report.optimized_dna?.performance ?? 0,
    },
    {
      axis: "Memory",
      baseline: report.baseline_dna?.complexity ?? 0,
      optimized: report.optimized_dna?.complexity ?? 0,
    },
    {
      axis: "Security",
      baseline: report.baseline_dna?.security ?? 0,
      optimized: report.optimized_dna?.security ?? 0,
    },
    {
      axis: "Readability",
      baseline: report.baseline_dna?.readability ?? 0,
      optimized: report.optimized_dna?.readability ?? 0,
    },
    {
      axis: "Maintain.",
      baseline: report.baseline_dna?.bug_density ?? 0,
      optimized: report.optimized_dna?.bug_density ?? 0,
    },
    {
      axis: "Complexity",
      baseline: report.baseline_dna?.optimization ?? 0,
      optimized: report.optimized_dna?.optimization ?? 0,
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

  const severityColor = (sev) => {
    if (!sev) return "var(--text-3)";
    const s = sev.toLowerCase();
    if (s === "critical" || s === "high") return "var(--danger)";
    if (s === "warning" || s === "medium") return "var(--warning)";
    return "#60a5fa";
  };

  const copyCode = () => {
    navigator.clipboard.writeText(report.optimized_code || "").catch(() => {});
  };

  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: 52 }}
    >
      <Navbar />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}
          >
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
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(239,68,68,0.1)",
                  color: statusColor,
                  border: `1px solid ${statusColor}`,
                  textTransform: "uppercase",
                }}
              >
                {val.status}
              </span>
            )}
            {speedup != null && (
              <span
                style={{
                  fontSize: 13,
                  color: "var(--accent)",
                  fontWeight: 600,
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
            color="var(--accent)"
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
            color="var(--accent)"
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
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
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
              DNA FINGERPRINT
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={dnaData}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "var(--text-2)", fontSize: 11 }}
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
                  stroke="#22d3ee"
                  fill="#22d3ee"
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
                color: "var(--text-3)",
              }}
            >
              <span style={{ color: "#ef4444" }}>— Baseline</span>
              <span style={{ color: "#22d3ee" }}>— Optimized</span>
            </div>
          </div>

          {/* Resource curves */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: "var(--text-3)",
                letterSpacing: "0.1em",
              }}
            >
              RESOURCE TIMELINE
            </div>
            {cpuData.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-3)",
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
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    CPU %
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={cpuData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                      />
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--text-3)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--text-3)" }}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-1)",
                          border: "1px solid var(--border)",
                          fontSize: 11,
                        }}
                      />
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
                        stroke="#22d3ee"
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
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    Memory MB
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={memData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                      />
                      <XAxis
                        dataKey="t"
                        tick={{ fontSize: 10, fill: "var(--text-3)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--text-3)" }}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg-1)",
                          border: "1px solid var(--border)",
                          fontSize: 11,
                        }}
                      />
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
                        stroke="#22d3ee"
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

        {/* Bottlenecks */}
        {(bugs.length > 0 || bottlenecks.length > 0) && (
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
              ISSUES & BOTTLENECKS
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
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    padding: "0.6rem",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 3,
                      background: `${severityColor(bug.severity)}22`,
                      color: severityColor(bug.severity),
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {(bug.severity || "info").toUpperCase()}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>
                      {bug.description || bug.message || "Bug detected"}
                    </div>
                    {bug.suggestion && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-3)",
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
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    alignItems: "flex-start",
                    padding: "0.6rem",
                    background: "rgba(255,255,255,0.02)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: 3,
                      background: "rgba(245,158,11,0.15)",
                      color: "var(--warning)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    PERF
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text)" }}>
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
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  letterSpacing: "0.1em",
                }}
              >
                OPTIMIZED CODE
              </div>
              <button
                onClick={copyCode}
                style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)",
                }}
              >
                Copy
              </button>
            </div>
            <textarea
              readOnly
              value={report.optimized_code}
              style={{
                width: "100%",
                minHeight: 200,
                fontFamily: "var(--mono)",
                fontSize: 12,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                padding: "0.75rem",
                resize: "vertical",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
