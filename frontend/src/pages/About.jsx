import Navbar from "../components/Navbar";
import { useScrollReveal } from "../hooks/useScrollReveal";

const PIPELINE = [
  {
    num: "01",
    title: "Parser",
    desc: "AST-level analysis of functions, dependencies, and structure.",
  },
  {
    num: "02",
    title: "Profiler",
    desc: "Sandbox execution measuring wall time, CPU, and memory.",
  },
  {
    num: "03",
    title: "Optimizer",
    desc: "LLM generates a candidate rewrite with measurable improvements.",
  },
  {
    num: "04",
    title: "Validator",
    desc: "Both versions run in Docker. Output compared, timing averaged 3x.",
  },
  {
    num: "05",
    title: "Memory",
    desc: "Approved rewrites stored in RAG for future similar code.",
  },
];

const TEAM = [
  {
    initials: "AS",
    name: "Asaad Suliman",
    role: "System Architect & Pipeline Lead",
    files: ["orchestrator.py", "validator.py", "schemas.py"],
    tint: {
      bg: "rgba(0,255,200,0.15)",
      border: "rgba(0,255,200,0.3)",
      color: "rgba(0,255,200,0.9)",
      avatar: "#22d3ee",
    },
  },
  {
    initials: "IB",
    name: "Ibro",
    role: "AI Agent Developer",
    files: ["bug_detector.py", "optimizer.py", "prompts.py"],
    tint: {
      bg: "rgba(255,170,0,0.15)",
      border: "rgba(255,170,0,0.3)",
      color: "rgba(255,170,0,0.9)",
      avatar: "#f59e0b",
    },
  },
  {
    initials: "OM",
    name: "Omer",
    role: "Performance & Sandbox Engineer",
    files: ["performance_analyzer.py", "code_executor.py", "Dockerfile"],
    tint: {
      bg: "rgba(139,92,246,0.15)",
      border: "rgba(139,92,246,0.3)",
      color: "rgba(139,92,246,0.9)",
      avatar: "#a78bfa",
    },
  },
  {
    initials: "AK",
    name: "Abdulkadir",
    role: "Frontend & Integration Engineer",
    files: ["api/app.py", "frontend/"],
    tint: {
      bg: "rgba(52,211,153,0.15)",
      border: "rgba(52,211,153,0.3)",
      color: "rgba(52,211,153,0.9)",
      avatar: "#34d399",
    },
  },
];

const DOCS = [
  "Quickstart",
  "CLI reference",
  "Validator semantics",
  "RAG & memory",
];

function RevealBlock({ children, delay = 0, style }) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className="reveal"
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </div>
  );
}

export default function About() {
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
        .about-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .about-card:hover {
          border-color: var(--border-glow);
          box-shadow: 0 0 30px rgba(0,255,200,0.05);
        }
        .pipeline-card {
          flex: 1 1 160px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.1rem;
          transition: border-color 0.25s ease;
        }
        .pipeline-card:hover { border-color: var(--border-glow); }
        .stack-pill {
          font-size: 0.78rem;
          font-family: var(--font-mono);
          padding: 4px 12px;
          border-radius: 20px;
          background: var(--bg-primary);
          border: 1px solid var(--border);
          color: var(--text-tertiary);
          transition: border-color 0.2s;
        }
        .stack-pill:hover { border-color: var(--border-glow); }
        .doc-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          color: var(--text-secondary);
          transition: border-color 0.2s, color 0.2s;
        }
        .doc-card:hover {
          border-color: var(--border-glow);
          color: var(--text-primary);
        }
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
          style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}
        >
          {/* Header */}
          <RevealBlock delay={0} style={{ marginBottom: "3rem" }}>
            <div className="page-eyebrow">About the project</div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.2,
                maxWidth: 640,
                marginBottom: "1rem",
              }}
            >
              The Validator Agent: making LLM optimizations actually safe to
              ship.
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "var(--text-secondary)",
                maxWidth: 560,
                lineHeight: 1.7,
              }}
            >
              An autonomous pipeline that analyzes, optimizes, and — critically
              — proves each improvement via sandboxed execution before anything
              reaches production.
            </p>
          </RevealBlock>

          {/* Problem / Approach */}
          <RevealBlock delay={100} style={{ marginBottom: "3rem" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="about-card">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--danger)",
                    marginBottom: "1rem",
                    letterSpacing: "0.05em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  THE PROBLEM
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  {[
                    "LLMs suggest rewrites that look correct but aren't measured",
                    "No output validation — silent regressions ship undetected",
                    "Security issues injected by unguarded AI suggestions",
                    "No memory of what worked — every session starts from zero",
                  ].map((t, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        display: "flex",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--danger)", flexShrink: 0 }}>
                        ✕
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="about-card">
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--success)",
                    marginBottom: "1rem",
                    letterSpacing: "0.05em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  OUR APPROACH
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  {[
                    "Every optimization proven via Docker sandbox execution",
                    "Output comparison + timing averaged over 3 runs",
                    "Security scan before any code reaches the optimizer",
                    "ChromaDB RAG remembers past wins for similar code",
                  ].map((t, i) => (
                    <li
                      key={i}
                      style={{
                        fontSize: 13,
                        color: "var(--text-secondary)",
                        display: "flex",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ color: "var(--success)", flexShrink: 0 }}>
                        ✓
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </RevealBlock>

          {/* Pipeline */}
          <RevealBlock delay={200} style={{ marginBottom: "3rem" }}>
            <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
              Five-stage pipeline
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {PIPELINE.map((p) => (
                <div key={p.num} className="pipeline-card">
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--accent-cyan)",
                      marginBottom: "0.4rem",
                    }}
                  >
                    {p.num}
                  </div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      marginBottom: "0.4rem",
                    }}
                  >
                    {p.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {p.desc}
                  </div>
                </div>
              ))}
            </div>
          </RevealBlock>

          {/* Team */}
          <div style={{ marginBottom: "3rem" }}>
            <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
              Team
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
              }}
            >
              {TEAM.map((m, idx) => (
                <RevealBlock key={m.initials} delay={idx * 100}>
                  <div
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "1.25rem",
                      display: "flex",
                      gap: "1rem",
                      alignItems: "flex-start",
                      transition: "border-color 0.25s ease",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: `${m.tint.avatar}22`,
                        border: `2px solid ${m.tint.avatar}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 14,
                        color: m.tint.avatar,
                        flexShrink: 0,
                      }}
                    >
                      {m.initials}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          marginBottom: "0.3rem",
                        }}
                      >
                        {m.name}
                      </div>
                      {/* Role badge */}
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "0.7rem",
                          fontFamily: "var(--font-mono)",
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: m.tint.bg,
                          border: `1px solid ${m.tint.border}`,
                          color: m.tint.color,
                          marginBottom: "0.6rem",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {m.role}
                      </span>
                      {/* File tags */}
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                      >
                        {m.files.map((f) => (
                          <span key={f} className="stack-pill">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </RevealBlock>
              ))}
            </div>
          </div>

          {/* Docs */}
          <RevealBlock delay={0}>
            <div className="page-eyebrow" style={{ marginBottom: "1rem" }}>
              Documentation
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {DOCS.map((d) => (
                <div key={d} className="doc-card">
                  {d}
                  <span style={{ color: "var(--text-tertiary)" }}>→</span>
                </div>
              ))}
            </div>
          </RevealBlock>
        </div>
      </div>
    </>
  );
}
