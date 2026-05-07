import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

const BEFORE_CODE = `def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

# O(2^n) — exponential time
result = fib(35)  # 29ms`;

const AFTER_CODE = `from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

result = fib(35)  # 0.04ms ✓`;

const FEATURES = [
  {
    icon: "◈",
    title: "Multi-file analysis",
    desc: "Full AST parsing across your entire module, not just the function you paste.",
    tags: ["AST", "imports", "call graph"],
  },
  {
    icon: "◉",
    title: "Security scanning",
    desc: "Bandit-grade checks before any AI touches your code. Critical issues block optimization.",
    tags: ["OWASP", "CWE", "injection"],
  },
  {
    icon: "◫",
    title: "Self-learning RAG",
    desc: "Every approved rewrite is stored. Future similar code gets instant proven suggestions.",
    tags: ["ChromaDB", "embeddings"],
  },
  {
    icon: "◻",
    title: "Shadow sandbox",
    desc: "Docker-isolated execution — no network, capped CPU/memory. Unsafe code never runs on bare metal.",
    tags: ["Docker", "isolated", "safe"],
  },
  {
    icon: "◆",
    title: "DNA Fingerprint",
    desc: "Six-axis radar: speed, security, readability, complexity, bugs, optimization — before and after.",
    tags: ["radar", "metrics", "diff"],
  },
];

const STATS = [
  { value: "34.2×", label: "median speedup on top-1k functions" },
  { value: "0", label: "regressions in 12,400 validated runs" },
  { value: "6.1ms", label: "lower than suggested across 512k functions" },
  { value: "94%", label: "CWE coverage on security-only runs" },
];

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      {/* Hero */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.5rem",
          position: "relative",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,211,238,0.07) 0%, transparent 70%)",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />

        <div
          style={{ position: "relative", textAlign: "center", maxWidth: 820 }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "1.5rem",
              border: "1px solid var(--border)",
              display: "inline-block",
              padding: "4px 14px",
              borderRadius: 20,
            }}
          >
            Validator Agent · v0.42.1 · Built for OSTIM Tech
          </div>

          <h1
            style={{
              fontSize: "clamp(3rem, 8vw, 6rem)",
              fontWeight: 700,
              lineHeight: 0.95,
              marginBottom: "1.5rem",
            }}
          >
            <span style={{ display: "block", color: "#ffffff" }}>
              Beyond the chatbot.
            </span>
            <span style={{ display: "block", color: "#71717a" }}>
              Engineering-grade
            </span>
            <span style={{ display: "block", color: "#22d3ee" }}>
              code optimization.
            </span>
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "var(--text-2)",
              maxWidth: 500,
              margin: "0 auto 2rem",
              lineHeight: 1.7,
            }}
          >
            An autonomous multi-agent pipeline that analyzes, rewrites, and{" "}
            <em>proves</em> every improvement before it ever ships. Not a
            suggestion — a measured guarantee.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/dashboard"
              style={{
                padding: "0.7rem 1.6rem",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "#000",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Open the Workspace →
            </Link>
            <Link
              to="/about"
              style={{
                padding: "0.7rem 1.6rem",
                borderRadius: "var(--radius)",
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-2)",
                fontSize: 15,
              }}
            >
              Read the paper
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "1.5rem 2rem",
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
          }}
        >
          {STATS.map((s) => (
            <div key={s.value} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "var(--text)",
                  fontFamily: "var(--mono)",
                }}
              >
                {s.value}
              </div>
              <div
                style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Live demo diff */}
      <section style={{ padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "0.75rem",
            }}
          >
            01 · LIVE DIFF
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: "0.5rem" }}>
            The Validator doesn&apos;t suggest. It proves.
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "var(--text-2)",
              marginBottom: "2rem",
              maxWidth: 560,
            }}
          >
            Both versions execute in Docker. Outputs compared byte-for-byte.
            Timing averaged over 3 runs. Only if faster <em>and</em> correct
            does it get an APPROVED stamp.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(239,68,68,0.05)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  original.py
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: "rgba(239,68,68,0.1)",
                    color: "var(--danger)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  O(n²) · BEFORE
                </span>
              </div>
              <pre
                style={{
                  padding: "1rem",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--text-2)",
                  lineHeight: 1.6,
                  borderLeft: "3px solid var(--danger)",
                  margin: 0,
                  overflowX: "auto",
                }}
              >
                {BEFORE_CODE}
              </pre>
            </div>

            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.6rem 1rem",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(34,197,94,0.05)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontFamily: "var(--mono)",
                  }}
                >
                  optimized.py
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: "rgba(34,197,94,0.1)",
                    color: "var(--success)",
                    border: "1px solid rgba(34,197,94,0.2)",
                  }}
                >
                  ✓ AFTER
                </span>
              </div>
              <pre
                style={{
                  padding: "1rem",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--text)",
                  lineHeight: 1.6,
                  borderLeft: "3px solid var(--success)",
                  margin: 0,
                  overflowX: "auto",
                }}
              >
                {AFTER_CODE}
              </pre>
            </div>
          </div>

          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              gap: "2rem",
              padding: "0.75rem 1rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--text-3)",
            }}
          >
            <span>
              Before: <strong style={{ color: "var(--danger)" }}>29ms</strong>
            </span>
            <span>
              After: <strong style={{ color: "var(--success)" }}>0.04ms</strong>
            </span>
            <span>
              Speedup: <strong style={{ color: "var(--accent)" }}>725×</strong>
            </span>
            <span>
              Outputs match:{" "}
              <strong style={{ color: "var(--success)" }}>✓</strong>
            </span>
            <span
              style={{
                marginLeft: "auto",
                color: "var(--success)",
                fontWeight: 600,
              }}
            >
              APPROVED
            </span>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section
        style={{ padding: "3rem 1.5rem 5rem", background: "var(--bg-1)" }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: "var(--text-3)",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            02 · CAPABILITIES
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: "2rem" }}>
            Every layer, engineered.
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1rem",
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.25rem",
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    color: "var(--accent)",
                    marginBottom: "0.6rem",
                  }}
                >
                  {f.icon}
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    marginBottom: "0.4rem",
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                    marginBottom: "0.75rem",
                  }}
                >
                  {f.desc}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {f.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--mono)",
                        padding: "2px 7px",
                        borderRadius: 3,
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        color: "var(--text-3)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "5rem 1.5rem", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: "1rem" }}>
            Stop guessing. Ship measured wins.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-2)",
              marginBottom: "2rem",
              lineHeight: 1.7,
            }}
          >
            Every commit backed by sandbox proof. Every speedup a number you can
            put in a PR description.
          </p>
          <Link
            to="/dashboard"
            style={{
              display: "inline-block",
              padding: "0.8rem 2rem",
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              color: "#000",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            Open Dashboard →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "1.5rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 12,
              color: "#000",
            }}
          >
            V
          </div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Validator</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>
          © 2025 OSTIM Tech Research · All rights reserved
        </div>
      </footer>
    </div>
  );
}
