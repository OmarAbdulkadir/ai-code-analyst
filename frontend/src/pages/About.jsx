import Navbar from "../components/Navbar";

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
    color: "#22d3ee",
  },
  {
    initials: "IB",
    name: "Ibro",
    role: "AI Agent Developer",
    files: ["bug_detector.py", "optimizer.py", "prompts.py"],
    color: "#f59e0b",
  },
  {
    initials: "OM",
    name: "Omer",
    role: "Performance & Sandbox Engineer",
    files: ["performance_analyzer.py", "code_executor.py", "Dockerfile"],
    color: "#60a5fa",
  },
  {
    initials: "AK",
    name: "Abdulkadir",
    role: "Frontend & Integration Engineer",
    files: ["api/app.py", "frontend/"],
    color: "#a78bfa",
  },
];

const DOCS = [
  "Quickstart",
  "CLI reference",
  "Validator semantics",
  "RAG & memory",
];

export default function About() {
  return (
    <div
      style={{ minHeight: "100vh", background: "var(--bg)", paddingTop: 52 }}
    >
      <Navbar />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "3rem" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            About the project
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.2,
              maxWidth: 640,
              marginBottom: "1rem",
            }}
          >
            The Validator Agent: making LLM optimizations actually safe to ship.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-2)",
              maxWidth: 560,
              lineHeight: 1.7,
            }}
          >
            An autonomous pipeline that analyzes, optimizes, and — critically —
            proves each improvement via sandboxed execution before anything
            reaches production.
          </p>
        </div>

        {/* Problem / Approach */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "3rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--danger)",
                marginBottom: "1rem",
                letterSpacing: "0.05em",
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
                    color: "var(--text-2)",
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
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--success)",
                marginBottom: "1rem",
                letterSpacing: "0.05em",
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
                    color: "var(--text-2)",
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

        {/* Pipeline */}
        <div style={{ marginBottom: "3rem" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Five-stage pipeline
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {PIPELINE.map((p) => (
              <div
                key={p.num}
                style={{
                  flex: "1 1 160px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.1rem",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--accent)",
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
                    color: "var(--text-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div style={{ marginBottom: "3rem" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Team
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            {TEAM.map((m) => (
              <div
                key={m.initials}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `${m.color}22`,
                    border: `2px solid ${m.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: m.color,
                    marginBottom: "0.75rem",
                  }}
                >
                  {m.initials}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    marginBottom: "0.6rem",
                    lineHeight: 1.4,
                  }}
                >
                  {m.role}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {m.files.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--mono)",
                        padding: "2px 6px",
                        borderRadius: 3,
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        color: "var(--text-3)",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Docs grid */}
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
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
              <div
                key={d}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "var(--text-2)",
                }}
              >
                {d}
                <span style={{ color: "var(--text-3)" }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
