import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useScrollReveal } from "../hooks/useScrollReveal";

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

function RevealCard({ children, className }) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`reveal feature-card${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .hero-line {
          opacity: 0;
          animation: slideUp 0.7s ease forwards;
        }
        .feature-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100;
          background: rgba(10,10,10,0.95);
          border-top: 1px solid var(--border-glow);
          padding: 12px 24px;
          display: flex;
          justify-content: center;
          gap: 32px;
          transform: translateY(100%);
          transition: transform 0.4s ease;
        }
        .feature-bar.visible { transform: translateY(0); }
        .feature-pill {
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent-cyan);
          animation: dotPulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        .feature-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .feature-card:hover {
          border-color: var(--border-glow);
          box-shadow: 0 0 30px rgba(0,255,200,0.05);
        }
        .cta-primary {
          padding: 0.7rem 1.6rem;
          border-radius: 6px;
          background: var(--accent-cyan);
          color: #0a0a0a;
          font-weight: 600;
          font-size: 15px;
          font-family: var(--font-mono);
          text-decoration: none;
          display: inline-block;
          transition: all 0.2s ease;
        }
        .cta-primary:hover {
          box-shadow: 0 0 20px rgba(0,255,200,0.4);
          transform: scale(1.03);
        }
        .cta-secondary {
          padding: 0.7rem 1.6rem;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 15px;
          text-decoration: none;
          display: inline-block;
          transition: color 0.2s, border-color 0.2s;
        }
        .cta-secondary:hover {
          color: var(--text-primary);
          border-color: rgba(255,255,255,0.2);
        }
        @media (max-width: 600px) {
          .feature-bar {
            overflow-x: auto;
            flex-wrap: nowrap;
            justify-content: flex-start;
            padding: 12px 20px;
          }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
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
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,255,200,0.07) 0%, transparent 70%)",
          }}
        >
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
            <h1
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                fontWeight: 800,
                lineHeight: 0.95,
                marginBottom: "1.5rem",
                letterSpacing: "-0.03em",
              }}
            >
              <span
                className="hero-line"
                style={{
                  display: "block",
                  color: "#ffffff",
                  animationDelay: "0ms",
                }}
              >
                Beyond the chatbot.
              </span>
              <span
                className="hero-line"
                style={{
                  display: "block",
                  color: "var(--text-secondary)",
                  animationDelay: "200ms",
                }}
              >
                Engineering-grade
              </span>
              <span
                className="hero-line"
                style={{
                  display: "block",
                  color: "var(--accent-cyan)",
                  animationDelay: "400ms",
                  textShadow: "0 0 40px rgba(0,255,200,0.4)",
                }}
              >
                code optimization.
              </span>
            </h1>

            <p
              className="hero-line"
              style={{
                animationDelay: "600ms",
                fontSize: 16,
                color: "var(--text-secondary)",
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
              className="hero-line"
              style={{
                animationDelay: "800ms",
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link to="/dashboard" className="cta-primary">
                Open the Workspace →
              </Link>
              <Link to="/about" className="cta-secondary">
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
                    color: "var(--accent-cyan)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    marginTop: 4,
                  }}
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
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                marginBottom: "0.75rem",
                fontFamily: "var(--font-mono)",
              }}
            >
              01 · LIVE DIFF
            </div>
            <h2
              style={{ fontSize: 28, fontWeight: 700, marginBottom: "0.5rem" }}
            >
              The Validator doesn&apos;t suggest. It proves.
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
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
                  borderRadius: 12,
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
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
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
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    O(n²) · BEFORE
                  </span>
                </div>
                <pre
                  style={{
                    padding: "1rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
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
                  borderRadius: 12,
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
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
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
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ✓ AFTER
                  </span>
                </div>
                <pre
                  style={{
                    padding: "1rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text-primary)",
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
                borderRadius: 6,
                fontSize: 12,
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span>
                Before: <strong style={{ color: "var(--danger)" }}>29ms</strong>
              </span>
              <span>
                After:{" "}
                <strong style={{ color: "var(--success)" }}>0.04ms</strong>
              </span>
              <span>
                Speedup:{" "}
                <strong style={{ color: "var(--accent-cyan)" }}>725×</strong>
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
          style={{
            padding: "3rem 1.5rem 5rem",
            background: "var(--bg-secondary)",
          }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                marginBottom: "1rem",
                fontFamily: "var(--font-mono)",
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
                <RevealCard key={f.title}>
                  <div
                    style={{
                      fontSize: 22,
                      color: "var(--accent-cyan)",
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
                      color: "var(--text-secondary)",
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
                          fontFamily: "var(--font-mono)",
                          padding: "2px 7px",
                          borderRadius: 3,
                          background: "var(--bg-primary)",
                          border: "1px solid var(--border)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </RevealCard>
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
                color: "var(--text-secondary)",
                marginBottom: "2rem",
                lineHeight: 1.7,
              }}
            >
              Every commit backed by sandbox proof. Every speedup a number you
              can put in a PR description.
            </p>
            <Link to="/dashboard" className="cta-primary">
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
                background: "var(--accent-cyan)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12,
                color: "#0a0a0a",
              }}
            >
              V
            </div>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Validator
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            © 2025 OSTIM Tech Research · All rights reserved
          </div>
        </footer>
      </div>

      {/* Scroll-triggered feature bar */}
      <div className={`feature-bar${scrolled ? " visible" : ""}`}>
        <span className="feature-pill">
          <span className="dot" />
          Bug Detection
        </span>
        <span className="feature-pill">
          <span className="dot" />
          Performance Proof
        </span>
        <span className="feature-pill">
          <span className="dot" />
          Before / After
        </span>
      </div>
    </>
  );
}
