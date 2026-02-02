import { useState, useEffect } from "react";
import axios from "axios";
import RiskGauge from "./components/RiskGauge";
import ReactMarkdown from "react-markdown";
import _remarkGfm from "remark-gfm";
import _rehypeRaw from "rehype-raw";

export default function App() {
  const [currentTab, setCurrentTab] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    const fetchTab = () => {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) setCurrentTab(tabs[0]);
        });
      } else {
        setCurrentTab({
          title: "Home | Green Card Organization",
          url: "https://greencardorganization.com",
        });
      }
    };
    fetchTab();
  }, []);

  const handleScan = async () => {
    if (!currentTab?.url) return;
    setLoading(true);
    setAiText("");
    setResult(null);

    // 1. Get the URLs from the environment configuration
    const NODE_SERVER = import.meta.env.VITE_NODE_SERVER_URL;
    const PYTHON_SERVER = import.meta.env.VITE_PYTHON_SERVER_URL;

    try {
      let pageContent = "Mock content for local testing.";
      const isExtension = typeof chrome !== "undefined" && chrome.tabs;

      if (isExtension) {
        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tab?.id) {
            const textResponse = await chrome.tabs.sendMessage(tab.id, {
              action: "getPageText",
            });
            pageContent = textResponse?.text || "No content found.";
          }
        } catch (msgErr) {
          console.warn("Content script error", msgErr);
        }
      }

      // 2. Use the Node Server environment variable
      const nodeRes = await axios.post(`${NODE_SERVER}/api/scan`, {
        url: currentTab.url,
      });
      setResult({ ...nodeRes.data });

      // 3. Use the Python Server environment variable
      const pythonStreamResponse = await fetch(
        `${PYTHON_SERVER}/api/ai-analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: currentTab.url,
            page_content: pageContent,
          }),
        },
      );

      const reader = pythonStreamResponse.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        setAiText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      console.error("Scan Error:", err);
      setAiText("⚠️ Analysis connection interrupted.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080b14] text-slate-200 font-sans p-4 selection:bg-cyan-500/30 w-full mx-auto max-w-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-black italic tracking-tighter uppercase">
          Scam<span className="text-cyan-400">Guard</span>
        </h1>
        <div className="text-[9px] bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20 text-cyan-400 font-mono">
          V1.2 PRO // 2026
        </div>
      </header>

      {/* Target Info Section */}
      <section className="bg-slate-900/40 border border-slate-800/40 rounded-2xl p-4 mb-4 backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/40 border border-slate-700 flex items-center justify-center text-xl shadow-inner">
              🌐
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {currentTab?.title || "Waiting..."}
              </p>
              <p className="text-[10px] font-mono text-cyan-400/60 truncate uppercase tracking-tighter">
                {currentTab?.url}
              </p>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={loading}
            className={`w-full font-black py-4 rounded-xl transition-all uppercase tracking-[0.2em] text-[11px] shadow-lg active:scale-95 ${
              loading
                ? "bg-slate-800 text-slate-500 animate-pulse"
                : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-cyan-500/10"
            }`}
          >
            {loading ? "Decrypting Node..." : "Initiate Full Scan"}
          </button>
        </div>
      </section>

      {/* Results Section */}
      {result ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Grouped Data: Infrastructure & Reputation */}
          <Accordion title="Technical & Community Dossier" icon="📊">
            {/* Integrity Meter (Sticky Top) */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex justify-between items-end mb-4">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Global Integrity Index
                </label>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${result.overallRisk === "High" ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}
                >
                  {result.overallRisk} RISK
                </span>
              </div>
              <RiskGauge score={result.trustScore} />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <MiniStat
                label="Trust Score"
                value={`${result.trustScore}/5.0`}
                color="text-white"
              />
              <MiniStat
                label="Domain Age"
                value={result.age}
                color="text-white"
              />
              <MiniStat label="Provider" value={result.provider} />
              <MiniStat label="Location" value={result.country} />
            </div>
            <div className="space-y-2">
              <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50 flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase">
                  SSL Integrity
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {result.security}
                </span>
              </div>
              <div className="bg-black/40 rounded-lg p-2 border border-slate-800/50 flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase">
                  Community Reviews
                </span>
                <span className="text-[10px] text-white font-mono">
                  {result.reviews} Verified
                </span>
              </div>
            </div>
          </Accordion>

          {/* AI Intelligence Section (Scrollable) */}
          <Accordion
            title="Live Behavioral Analysis"
            icon="🧠"
            defaultOpen={true}
          >
            <div className="max-h-[350px] overflow-y-auto scrollbar-hide pr-1 space-y-4">
              {/* 1. Dynamic Status Banner */}
              {aiText.includes("Verdict:") && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-colors duration-500 ${
                    aiText.toLowerCase().includes("safe")
                      ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                      : "bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                  }`}
                >
                  <span className="text-xl">
                    {aiText.toLowerCase().includes("safe") ? "🛡️" : "⚠️"}
                  </span>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                      AI Threat Assessment
                    </p>
                    <p
                      className={`text-[11px] font-bold uppercase tracking-tight ${
                        aiText.toLowerCase().includes("safe")
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {aiText.toLowerCase().includes("safe")
                        ? "Verified Secure"
                        : "Potential Risk Detected"}
                    </p>
                  </div>
                  <div className="text-right border-l border-white/10 pl-3">
                    <p className="text-[16px] font-black text-white leading-none">
                      {aiText.match(/Score:\s*(\d+)/)?.[1] || "--"}
                    </p>
                    <p className="text-[7px] text-slate-500 uppercase font-bold tracking-tighter">
                      Trust Score
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Structured Markdown Report */}
              <div className="relative bg-black/40 rounded-xl border border-slate-800/60 p-5 shadow-inner min-h-[120px]">
                <div
                  className="prose prose-invert max-w-none 
        {/* Gemini-style spacing & font sizing */}
        prose-p:text-[12px] prose-p:leading-relaxed prose-p:text-slate-300 prose-p:mb-4
        prose-headings:text-cyan-400 prose-headings:font-black prose-headings:tracking-tight prose-headings:mt-6 prose-headings:mb-2
        prose-h3:text-[13px] prose-h3:uppercase prose-h3:tracking-widest
        {/* List styling */}
        prose-ul:my-3 prose-ul:list-disc prose-ul:pl-5
        prose-li:text-[11px] prose-li:mb-1.5 prose-li:text-slate-300
        {/* Inline code/logic */}
        prose-code:text-cyan-300 prose-code:bg-cyan-500/10 prose-code:px-1 prose-code:rounded
        prose-strong:text-white"
                >
                  <ReactMarkdown
                    remarkPlugins={[_remarkGfm]}
                    rehypePlugins={[_rehypeRaw]}
                    components={{
                      // Transform bold text into stylized section labels
                      strong: ({ node, ...props }) => {
                        const content = props.children?.toString() || "";
                        const isLabel =
                          /Verdict|Score|Summary|Evidence|Logic|Analysis/i.test(
                            content,
                          );
                        return (
                          <span
                            className={
                              isLabel
                                ? "text-cyan-400 font-black uppercase tracking-wider text-[10px] block mb-1 mt-2"
                                : "font-bold text-white"
                            }
                          >
                            {props.children}
                          </span>
                        );
                      },
                    }}
                  >
                    {aiText ||
                      "### 📡 Establishing Neural Link...\nScanning DOM structure and behavioral patterns..."}
                  </ReactMarkdown>
                </div>

                {/* 3. Typing / Pulse Indicator */}
                {loading && (
                  <div className="flex items-center gap-2 mt-4 px-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full animate-bounce"></span>
                    <span className="text-[9px] font-bold text-cyan-500/50 uppercase tracking-widest ml-1">
                      Analyzing Stream...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Accordion>

          {/* Critical Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 shadow-lg shadow-red-500/5">
              <p className="text-[8px] font-black text-red-500 uppercase mb-2 tracking-widest flex items-center gap-2">
                <span className="animate-pulse text-xs">⚠️</span> Critical
                Alerts Detected
              </p>
              {result.warnings.map((w: string, i: number) => (
                <div
                  key={i}
                  className="text-[10px] text-red-400/80 font-medium mb-1 pl-4 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-[1px] before:bg-red-500"
                >
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-16 opacity-30">
            <div className="text-4xl mb-2">🔭</div>
            <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-cyan-400">
              System Ready for Deployment
            </p>
          </div>
        )
      )}
    </div>
  );
}

/* REFINED SUB-COMPONENTS */

const Accordion = ({ title, icon, children, defaultOpen = false }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl transition-all duration-300 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm">{icon}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-300">
            {title}
          </span>
        </div>
        <div
          className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          ▼
        </div>
      </button>
      <div
        className={`transition-all duration-500 overflow-hidden ${isOpen ? "max-h-[600px] opacity-100 p-4 pt-0" : "max-h-0 opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
};

const MiniStat = ({ label, value, color = "text-cyan-400" }: any) => (
  <div className="bg-black/30 border border-slate-800/40 p-2 rounded-xl">
    <p className="text-[7px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">
      {label}
    </p>
    <p className={`text-[10px] font-mono font-bold truncate ${color}`}>
      {value || "N/A"}
    </p>
  </div>
);
