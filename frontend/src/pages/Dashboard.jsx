import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { analyzeCode } from "../lib/api";

const FILES = [
  { name: "fib.py", dot: "#ef4444", folder: "src" },
  { name: "report.py", dot: "#f59e0b", folder: "src" },
  { name: "utils.py", dot: null, folder: "src" },
  { name: "test_main.py", dot: null, folder: "tests" },
  { name: "README.md", dot: null, folder: "" },
];

const STAGES = [
  "Stage 1/6: Architect Agent",
  "Stage 2/6: Security Agent",
  "Stage 3/6: Bug Detector",
  "Stage 4/6: Performance Analyzer",
  "Stage 5/6: Optimizer",
  "Stage 6/6: Validator",
];

const PLACEHOLDER = `# Paste your Python code here...
# Example:
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

print(fib(10))`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState("fib.py");

  const handleAnalyze = async () => {
    if (!code.trim()) return;
    setAnalyzing(true);
    setResults(null);
    setError("");
    setStageIdx(0);

    const interval = setInterval(() => {
      setStageIdx((i) => (i < STAGES.length - 1 ? i + 1 : i));
    }, 8000);

    try {
      const res = await analyzeCode(code);
      clearInterval(interval);
      sessionStorage.setItem("last_report", JSON.stringify(res.data));
      setResults(res.data);
    } catch (e) {
      clearInterval(interval);
      setError(e.response?.data?.detail || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const val = results?.validation || {};
  const bugScore = results?.bug_report?.bug_score ?? null;
  const speedup = val.speedup_percentage ?? null;
  const status = val.status || null;

  const statusColor =
    status === "approved"
      ? "var(--success)"
      : status === "rejected"
        ? "var(--danger)"
        : "var(--text-3)";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      <Navbar />

      {/* Top bar */}
      <div
        style={{
          marginTop: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-1)",
          height: 44,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: 13,
            color: "var(--text-2)",
          }}
        >
          <span style={{ color: "var(--text-3)" }}>src /</span>
          <span style={{ color: "var(--text)" }}>{activeFile}</span>
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: analyzing
                ? "rgba(245,158,11,0.1)"
                : "rgba(34,211,238,0.1)",
              color: analyzing ? "var(--warning)" : "var(--accent)",
              border: `1px solid ${analyzing ? "rgba(245,158,11,0.2)" : "rgba(34,211,238,0.2)"}`,
            }}
          >
            {analyzing ? "⟳ analyzing..." : "● idle"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {["Speed", "Memory", "Security"].map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
              }}
            >
              {t}
            </span>
          ))}
          <button
            onClick={() => {
              setCode("");
              setResults(null);
              setError("");
            }}
            style={{
              fontSize: 11,
              padding: "2px 10px",
              borderRadius: 4,
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
            }}
          >
            Reset
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !code.trim()}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "0.3rem 1.1rem",
              borderRadius: "var(--radius)",
              background: analyzing ? "rgba(34,211,238,0.4)" : "var(--accent)",
              border: "none",
              color: "#000",
            }}
          >
            {analyzing ? "⟳ Running..." : "▶ Analyze"}
          </button>
        </div>
      </div>

      {/* Main three-panel layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left sidebar */}
        <div
          style={{
            width: 220,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            background: "var(--bg-1)",
          }}
        >
          <div
            style={{
              padding: "0.6rem 0.75rem",
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-3)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            EXPLORER
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0.5rem 0" }}>
            {["src", "tests", ""]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((folder) => (
                <div key={folder}>
                  {folder && (
                    <div
                      style={{
                        padding: "0.2rem 0.75rem",
                        fontSize: 11,
                        color: "var(--text-3)",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {folder}/
                    </div>
                  )}
                  {FILES.filter((f) => f.folder === folder).map((f) => (
                    <div
                      key={f.name}
                      onClick={() => setActiveFile(f.name)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.3rem 0.75rem 0.3rem 1.25rem",
                        cursor: "pointer",
                        background:
                          activeFile === f.name
                            ? "var(--bg-card)"
                            : "transparent",
                        fontSize: 13,
                        color:
                          activeFile === f.name
                            ? "var(--text)"
                            : "var(--text-2)",
                      }}
                    >
                      {f.dot && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: f.dot,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {!f.dot && <span style={{ width: 6, flexShrink: 0 }} />}
                      {f.name}
                    </div>
                  ))}
                </div>
              ))}
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: "0.6rem 0.75rem",
              fontSize: 11,
              color: "var(--text-3)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span>RAG: 4 memories</span>
            <span style={{ color: "var(--success)" }}>● Sandbox ready</span>
            <span>main</span>
          </div>
        </div>

        {/* Center — code editor */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-1)",
              height: 34,
              alignItems: "stretch",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 1rem",
                fontSize: 12,
                color: "var(--text)",
                borderRight: "1px solid var(--border)",
                background: "var(--bg)",
                gap: "0.5rem",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--accent)",
                }}
              />
              {activeFile}
            </div>
          </div>

          {/* Editor with line numbers */}
          <div
            style={{
              flex: 1,
              display: "flex",
              overflow: "hidden",
              fontFamily: "var(--mono)",
              fontSize: 13,
            }}
          >
            {/* Line numbers */}
            <div
              style={{
                width: 40,
                background: "var(--bg-1)",
                borderRight: "1px solid var(--border)",
                padding: "1rem 0",
                textAlign: "right",
                color: "var(--text-3)",
                fontSize: 12,
                overflowY: "hidden",
                flexShrink: 0,
                lineHeight: "1.6",
                paddingRight: "0.5rem",
              }}
            >
              {(code || PLACEHOLDER).split("\n").map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              style={{
                flex: 1,
                background: "var(--bg)",
                border: "none",
                borderRadius: 0,
                color: "var(--text)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                lineHeight: 1.6,
                padding: "1rem",
                resize: "none",
                outline: "none",
                height: "100%",
              }}
            />
          </div>
        </div>

        {/* Right panel — results */}
        {(analyzing || results || error) && (
          <div
            style={{
              width: 300,
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-1)",
              flexShrink: 0,
              overflow: "auto",
            }}
          >
            <div
              style={{
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--text-3)",
              }}
            >
              ANALYSIS
            </div>

            {analyzing && (
              <div
                style={{
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {STAGES.map((s, i) => (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: 12,
                      color:
                        i < stageIdx
                          ? "var(--success)"
                          : i === stageIdx
                            ? "var(--accent)"
                            : "var(--text-3)",
                    }}
                  >
                    <span>
                      {i < stageIdx ? "✓" : i === stageIdx ? "⟳" : "○"}
                    </span>
                    {s}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div
                style={{
                  margin: "1rem",
                  padding: "0.75rem",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  color: "var(--danger)",
                }}
              >
                {error}
              </div>
            )}

            {results && !analyzing && (
              <div
                style={{
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* Bug score */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    BUG SCORE
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color:
                        bugScore > 50
                          ? "var(--danger)"
                          : bugScore < 20
                            ? "var(--success)"
                            : "var(--warning)",
                    }}
                  >
                    {bugScore ?? "—"}
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-3)",
                        fontWeight: 400,
                      }}
                    >
                      /100
                    </span>
                  </div>
                </div>

                {/* Validation status */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    VALIDATION
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: statusColor,
                      textTransform: "uppercase",
                    }}
                  >
                    {status || "—"}
                  </div>
                </div>

                {/* Speedup */}
                <div
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    SPEEDUP
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: "var(--accent)",
                    }}
                  >
                    {speedup != null ? `${speedup.toFixed(1)}%` : "—"}
                  </div>
                </div>

                {/* Summary */}
                {results.overall_summary && (
                  <div
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "0.75rem",
                      fontSize: 12,
                      color: "var(--text-2)",
                      lineHeight: 1.6,
                    }}
                  >
                    {results.overall_summary}
                  </div>
                )}

                <button
                  onClick={() =>
                    navigate("/insights", { state: { report: results } })
                  }
                  style={{
                    padding: "0.6rem",
                    borderRadius: "var(--radius)",
                    background: "var(--accent)",
                    border: "none",
                    color: "#000",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  View Full Insights →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
