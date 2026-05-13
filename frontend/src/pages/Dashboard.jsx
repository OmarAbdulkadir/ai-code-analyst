import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { analyzeCode } from "../lib/api";


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
  const [code, setCode] = useState(() => sessionStorage.getItem("last_code") || "");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIdx, setStageIdx] = useState(0);
  const [streamedStages, setStreamedStages] = useState({});
  const [results, setResults] = useState(() => {
    const r = sessionStorage.getItem("last_report");
    return r ? JSON.parse(r) : null;
  });
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState(() => sessionStorage.getItem("last_active_file") || null);
  const [uploadedFiles, setUploadedFiles] = useState(() => {
    const f = sessionStorage.getItem("last_uploaded_files");
    return f ? JSON.parse(f) : [];
  });
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [displayedSpeedup, setDisplayedSpeedup] = useState(0);

  const switchToFile = (file) => {
    setActiveFile(file.name);
    setCode(file.content);
    setResults(null);
    setError("");
  };

  const SKIP_DIRS = [
    "node_modules", "venv", ".venv", "__pycache__", ".git",
    "dist", "build", ".next", "env", "site-packages", ".tox",
    "migrations", ".mypy_cache", ".pytest_cache",
  ];

  // + File: pick individual .py files (fast, no freeze)
  const handleFileUpload = (e) => {
    const fileList = e.target.files;
    e.target.value = "";
    if (!fileList || fileList.length === 0) return;
    setLoadingFiles(true);
    const files = Array.from(fileList).filter((f) => f.name.endsWith(".py")).slice(0, 50);
    if (files.length === 0) {
      setError("No Python files selected.");
      setLoadingFiles(false);
      return;
    }
    Promise.all(
      files.map((f) => new Promise((res) => {
        const r = new FileReader();
        r.onload = (ev) => res({ name: f.name, path: f.name, content: ev.target.result });
        r.readAsText(f);
      }))
    ).then((loaded) => {
      setUploadedFiles(loaded);
      setResults(null);
      setError("");
      setActiveFile(loaded[0].name);
      setCode(loaded[0].content);
      setLoadingFiles(false);
    });
  };

  // + Folder: use async showDirectoryPicker so the browser never freezes
  const handleFolderPick = async () => {
    if (!window.showDirectoryPicker) {
      document.getElementById("folder-upload").click();
      return;
    }
    setSelectingFolder(true);
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker();
    } catch (e) {
      setSelectingFolder(false);
      if (e.name !== "AbortError") {
        // API unavailable or blocked — fall back to classic picker
        document.getElementById("folder-upload").click();
      }
      return;
    }
    setSelectingFolder(false);
    setLoadingFiles(true);
    setLoadingStatus("Scanning...");
    try {

      const collected = [];
      const walk = async (handle, pathPrefix, depth = 0) => {
        if (collected.length >= 50 || depth > 8) return;
        const entries = [];
        for await (const [name, entry] of handle.entries()) {
          entries.push([name, entry]);
        }
        await Promise.all(entries.map(async ([name, entry]) => {
          if (collected.length >= 50) return;
          // Skip hidden dirs and known junk dirs
          if (entry.kind === "directory") {
            if (!name.startsWith(".") && !SKIP_DIRS.includes(name)) {
              await walk(entry, pathPrefix ? `${pathPrefix}/${name}` : name, depth + 1);
            }
          } else if (name.endsWith(".py")) {
            const file = await entry.getFile();
            collected.push({ name, path: pathPrefix ? `${pathPrefix}/${name}` : name, file });
            const count = collected.length;
            flushSync(() => setLoadingStatus(`Found ${count} file${count !== 1 ? "s" : ""}...`));
          }
        }));
      };
      await walk(dirHandle, dirHandle.name);

      if (collected.length === 0) {
        setError("No Python files found (skipped venv/node_modules/__pycache__).");
        setLoadingFiles(false);
        return;
      }

      const loaded = await Promise.all(
        collected.map(({ name, path, file }) =>
          new Promise((res) => {
            const r = new FileReader();
            r.onload = (ev) => res({ name, path, content: ev.target.result });
            r.readAsText(file);
          })
        )
      );

      setUploadedFiles(loaded);
      setResults(null);
      setError("");
      setActiveFile(loaded[0].name);
      setCode(loaded[0].content);
      setLoadingFiles(false);
      setLoadingStatus("");
    } catch (e) {
      setLoadingFiles(false);
      setLoadingStatus("");
      setError(`Failed to read folder: ${e.message}`);
    }
  };

  // Combine all uploaded files for analysis
  const getAnalysisCode = () => {
    if (uploadedFiles.length <= 1) return code;
    return uploadedFiles
      .map((f) => `# ── ${f.path} ──\n${f.content}`)
      .join("\n\n");
  };

  useEffect(() => {
    if (!analyzing) return;
    const id = setInterval(() => setCursorVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, [analyzing]);

  useEffect(() => { sessionStorage.setItem("last_code", code); }, [code]);
  useEffect(() => { sessionStorage.setItem("last_active_file", activeFile || ""); }, [activeFile]);
  useEffect(() => { sessionStorage.setItem("last_uploaded_files", JSON.stringify(uploadedFiles)); }, [uploadedFiles]);

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
    setStreamedStages({});

    const STAGE_ORDER = ["architect", "security", "bugs", "performance", "optimization", "validation"];
    const token = localStorage.getItem("access_token");
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

    try {
      const response = await fetch(`${apiUrl}/analyze/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ source_code: getAnalysisCode(), description: null }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const partialReport = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "stage") {
            const idx = STAGE_ORDER.indexOf(event.stage);
            if (idx !== -1) setStageIdx(idx + 1);
            partialReport[event.stage] = event.data;
            setStreamedStages((prev) => ({ ...prev, [event.stage]: event.data }));
          } else if (event.type === "complete") {
            sessionStorage.setItem("last_report", JSON.stringify(event.data));
            setResults(event.data);
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (e) {
      setError(e.message || "Analysis failed");
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
            {uploadedFiles.length > 1 && (
              <span style={{ color: "var(--text-tertiary)" }}>
                {uploadedFiles[0]?.path.split("/")[0]} /
              </span>
            )}
            <span style={{ color: "var(--text-primary)" }}>
              {activeFile || "untitled.py"}
            </span>
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

            {/* Hidden file inputs */}
            <input
              id="file-upload"
              type="file"
              accept=".py"
              multiple
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <input
              id="folder-upload"
              type="file"
              accept=".py"
              multiple
              webkitdirectory=""
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            <button
              onClick={() => {
                setCode("");
                setResults(null);
                setError("");
                setUploadedFiles([]);
                setActiveFile(null);
                sessionStorage.removeItem("last_code");
                sessionStorage.removeItem("last_report");
                sessionStorage.removeItem("last_active_file");
                sessionStorage.removeItem("last_uploaded_files");
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>EXPLORER</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  title="Select .py files"
                  onClick={() => document.getElementById("file-upload").click()}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--accent-cyan)",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  + File
                </button>
                <button
                  title="Select a project folder"
                  onClick={handleFolderPick}
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: 3,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--accent-cyan)",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  + Folder
                </button>
                {uploadedFiles.length > 0 && (
                  <button
                    title="Clear current project and open a new folder"
                    onClick={() => {
                      setCode("");
                      setResults(null);
                      setError("");
                      setUploadedFiles([]);
                      setActiveFile(null);
                      sessionStorage.removeItem("last_code");
                      sessionStorage.removeItem("last_report");
                      sessionStorage.removeItem("last_active_file");
                      sessionStorage.removeItem("last_uploaded_files");
                      handleFolderPick();
                    }}
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: "transparent",
                      border: "1px solid #e05252",
                      color: "#e05252",
                      cursor: "pointer",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ↺ New
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "0.5rem 0" }}>
              {(selectingFolder || loadingFiles) ? (
                <div
                  style={{
                    padding: "2rem 0.75rem",
                    textAlign: "center",
                    color: "var(--accent-cyan)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.8,
                  }}
                >
                  <span className="spinner" style={{ margin: "0 auto 8px", display: "block", width: 14, height: 14 }} />
                  {selectingFolder ? "Waiting for folder..." : (loadingStatus || "Reading files...")}
                </div>
              ) : uploadedFiles.length === 0 ? (
                <div
                  style={{
                    padding: "2rem 0.75rem",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    lineHeight: 1.8,
                  }}
                >
                  No files open.
                  <br />
                  + File or
                  <br />
                  + Folder above.
                </div>
              ) : (
                (() => {
                  // Group by folder
                  const folders = {};
                  uploadedFiles.forEach((f) => {
                    const parts = f.path.split("/");
                    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "";
                    if (!folders[folder]) folders[folder] = [];
                    folders[folder].push(f);
                  });
                  return Object.entries(folders).map(([folder, files]) => (
                    <div key={folder}>
                      {folder && (
                        <div
                          style={{
                            padding: "0.3rem 0.75rem",
                            fontSize: 11,
                            color: "var(--accent-cyan)",
                            letterSpacing: "0.08em",
                            fontFamily: "var(--font-mono)",
                            opacity: 0.7,
                          }}
                        >
                          📁 {folder}
                        </div>
                      )}
                      {files.map((f) => (
                        <div
                          key={f.path}
                          className="sidebar-file"
                          onClick={() => switchToFile(f)}
                          style={{
                            paddingLeft: folder ? "1.5rem" : "0.75rem",
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
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: activeFile === f.name
                                ? "var(--accent-cyan)"
                                : "var(--text-tertiary)",
                              flexShrink: 0,
                            }}
                          />
                          {f.name}
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
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
                <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {STAGES.map((s, i) => {
                    const done = i < stageIdx;
                    const active = i === stageIdx;
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12,
                          color: done ? "var(--text-secondary)" : active ? "var(--accent-cyan)" : "var(--text-tertiary)" }}>
                        {done && <span style={{ color: "var(--accent-cyan)" }}>✓</span>}
                        {active && <span className="spinner" />}
                        {!done && !active && <span>○</span>}
                        {s}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Live stage results that appear as each agent finishes */}
              {analyzing && Object.keys(streamedStages).length > 0 && (
                <div style={{ padding: "0 1rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {streamedStages.architect && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>ARCHITECTURE</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {streamedStages.architect.total_functions ?? 0} functions · Complexity: {streamedStages.architect.most_complex_function || "—"}
                      </div>
                    </div>
                  )}
                  {streamedStages.security && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>SECURITY</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        Score: <span style={{ color: streamedStages.security.security_score >= 80 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>{streamedStages.security.security_score}/100</span>
                        {" · "}{streamedStages.security.issues?.length ?? 0} issue{streamedStages.security.issues?.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                  {streamedStages.bugs && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>BUGS</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {streamedStages.bugs.bugs?.length ?? 0} bug{streamedStages.bugs.bugs?.length !== 1 ? "s" : ""} found
                        {streamedStages.bugs.has_critical_bugs && <span style={{ color: "var(--danger)", marginLeft: 6 }}>⚠ critical</span>}
                      </div>
                    </div>
                  )}
                  {streamedStages.performance && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>PERFORMANCE</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {streamedStages.performance.execution_time_ms != null ? `${streamedStages.performance.execution_time_ms.toFixed(1)}ms` : "—"}
                        {" · "}{streamedStages.performance.time_complexity || "—"}
                      </div>
                    </div>
                  )}
                  {streamedStages.optimization && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>OPTIMIZER</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {streamedStages.optimization.changes_made?.length ?? 0} changes
                      </div>
                    </div>
                  )}
                  {streamedStages.validation && (
                    <div className="result-card" style={{ animation: "fadeIn 0.3s ease" }}>
                      <div style={{ fontSize: 10, color: "var(--accent-cyan)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>VALIDATION</div>
                      <div style={{ fontSize: 11 }}>
                        <span style={{ color: streamedStages.validation.status === "approved" ? "var(--success)" : "var(--danger)", fontWeight: 600, textTransform: "uppercase" }}>
                          {streamedStages.validation.status}
                        </span>
                        {streamedStages.validation.speedup_percentage != null &&
                          <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>+{streamedStages.validation.speedup_percentage.toFixed(1)}% faster</span>}
                      </div>
                    </div>
                  )}
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
