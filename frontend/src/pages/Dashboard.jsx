import { useState, useEffect } from "react";
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
  const [cursorVisible, setCursorVisible] = useState(true);
  const [displayedSpeedup, setDisplayedSpeedup] = useState(0);

  useEffect(() => {
    if (!analyzing) return;
    const id = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, [analyzing]);

  const speedup = results?.validation?.speedup_percentage ?? null;
  useEffect(() => {
    if (speedup === null) {
      setDisplayedSpeedup(0);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplayedSpeedup(Math.round(t * speedup * 10) / 10);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [speedup]);

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
      console.error("[Analyze error]", e);
      setError(e.response?.data?.detail || e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const val = results?.validation || {};
  const bugScore = results?.bug_report?.bug_score ?? null;
  const status = val.status || null;

  const statusColor =
    status === "approved"
      ? "var(--success)"
      : status === "rejected"
        ? "var(--danger)"
        : "var(--text-tertiary)";

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner {
          width: 14px; height: 14px;
          border: 2px solid var(--border);
          border-top-color: var(--accent-cyan);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
        .section-label {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-bottom: 12px;
        }
        .editor-textarea {
          flex: 1;
          background: #0d0d0d;
          border: none;
          border-radius: 0;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.6;
          padding: 1rem;
          resize: none;
          outline: none;
          height: 100%;
          transition: border-color 0.2s;
        }
        .editor-textarea::placeholder { color: var(--text-tertiary); }
        .analyze-btn {
          font-size: 13px;
          font-weight: 600;
          padding: 0.3rem 1.1rem;
          border-radius: 6px;
          background: var(--accent-cyan);
          border: none;
          color: #0a0a0a;
          font-family: var(--font-mono);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .analyze-btn:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0,255,200,0.4);
          transform: scale(1.03);
        }
        .analyze-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .result-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.75rem;
        }
        .sidebar-file {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.75rem 0.3rem 1.25rem;
          cursor: pointer;
          font-size: 13px;
          transition: background 0.15s, color 0.15s;
        }
        .sidebar-file:hover { background: var(--bg-card); }
      `}</style>

      <div
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-primary)",
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
            background: "var(--bg-secondary)",
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
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span style={{ color: "var(--text-tertiary)" }}>src /</span>
            <span style={{ color: "var(--text-primary)" }}>{activeFile}</span>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: analyzing
                  ? "rgba(255,170,0,0.1)"
                  : "var(--accent-cyan-dim)",
                color: analyzing ? "var(--warning)" : "var(--accent-cyan)",
                border: `1px solid ${analyzing ? "rgba(255,170,0,0.2)" : "var(--border-glow)"}`,
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
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
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
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
            <button
              className="analyze-btn"
              onClick={handleAnalyze}
              disabled={analyzing || !code.trim()}
            >
              {analyzing ? (
                <span style={{ opacity: cursorVisible ? 1 : 0 }}>▋</span>
              ) : (
                "▶ Analyze"
              )}
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
              background: "var(--bg-secondary)",
            }}
          >
            <div
              style={{
                padding: "0.6rem 0.75rem",
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "var(--text-tertiary)",
                borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font-mono)",
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
                          color: "var(--text-tertiary)",
                          letterSpacing: "0.08em",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {folder}/
                      </div>
                    )}
                    {FILES.filter((f) => f.folder === folder).map((f) => (
                      <div
                        key={f.name}
                        className="sidebar-file"
                        onClick={() => setActiveFile(f.name)}
                        style={{
                          background:
                            activeFile === f.name
                              ? "var(--bg-card)"
                              : "transparent",
                          color:
                            activeFile === f.name
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {f.dot ? (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: f.dot,
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <span style={{ width: 6, flexShrink: 0 }} />
                        )}
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
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
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
                background: "var(--bg-secondary)",
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
                  color: "var(--text-primary)",
                  borderRight: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                  gap: "0.5rem",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent-cyan)",
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
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 40,
                  background: "var(--bg-secondary)",
                  borderRight: "1px solid var(--border)",
                  padding: "1rem 0.5rem 1rem 0",
                  textAlign: "right",
                  color: "var(--text-tertiary)",
                  fontSize: 12,
                  overflowY: "hidden",
                  flexShrink: 0,
                  lineHeight: "1.6",
                }}
              >
                {(code || PLACEHOLDER).split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                className="editor-textarea"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={PLACEHOLDER}
                spellCheck={false}
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
                background: "var(--bg-secondary)",
                flexShrink: 0,
                overflow: "auto",
              }}
            >
              <div
                className="section-label"
                style={{
                  padding: "0.75rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: 0,
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
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx;
                    const active = i === stageIdx;
                    return (
                      <div
                        key={s}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          fontSize: 12,
                          color: done
                            ? "var(--text-secondary)"
                            : active
                              ? "var(--accent-cyan)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {done && (
                          <span style={{ color: "var(--accent-cyan)" }}>✓</span>
                        )}
                        {active && <span className="spinner" />}
                        {!done && !active && <span>○</span>}
                        {s}
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <div
                  style={{
                    margin: "1rem",
                    padding: "0.75rem",
                    background: "rgba(255,68,68,0.1)",
                    border: "1px solid rgba(255,68,68,0.2)",
                    borderLeft: "4px solid var(--danger)",
                    borderRadius: 8,
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
                  <div className="result-card">
                    <div className="section-label">BUG SCORE</div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
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
                          color: "var(--text-tertiary)",
                          fontWeight: 400,
                        }}
                      >
                        /100
                      </span>
                    </div>
                  </div>

                  {/* Validation status */}
                  <div className="result-card">
                    <div className="section-label">VALIDATION</div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "var(--font-mono)",
                        color: statusColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {status || "—"}
                    </div>
                  </div>

                  {/* Speedup */}
                  <div className="result-card">
                    <div className="section-label">SPEEDUP</div>
                    <div
                      style={{
                        fontSize: "clamp(2rem, 5vw, 3.5rem)",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-cyan)",
                        textShadow:
                          speedup != null
                            ? "0 0 30px rgba(0,255,200,0.5)"
                            : "none",
                        lineHeight: 1,
                      }}
                    >
                      {speedup != null
                        ? `${displayedSpeedup.toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>

                  {/* Summary */}
                  {results.overall_summary && (
                    <div
                      className="result-card"
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
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
                      borderRadius: 6,
                      background: "var(--accent-cyan)",
                      border: "none",
                      color: "#0a0a0a",
                      fontWeight: 600,
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
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
    </>
  );
}
