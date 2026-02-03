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
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  // 1. Update the tab info whenever the user switches tabs
  // SINGLE SOURCE OF TRUTH FOR TAB CHANGES
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      const handleTabChange = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            // 1. Update the "Target Info" header
            setCurrentTab(tabs[0]);

            // 2. Clear out the previous scan results (Prevent Stale Data)
            setResult(null);
            setAiText("");
            setLoading(false); // Stop any lingering pulse animations

            // 3. Reset the browser icon to the neutral state
            chrome.action.setIcon({ path: "icons/icon-default.png" });
            chrome.action.setBadgeText({ text: "" });
          }
        });
      };

      // Initial fetch when sidepanel opens
      handleTabChange();

      // Event Listeners for user activity
      chrome.tabs.onActivated.addListener(handleTabChange);
      chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
        // Only trigger if the URL actually changed
        if (changeInfo.url) handleTabChange();
      });

      return () => {
        chrome.tabs.onActivated.removeListener(handleTabChange);
        chrome.tabs.onUpdated.removeListener(handleTabChange);
      };
    } else {
      // Local Dev Mock
      setCurrentTab({
        title: "Home | Green Card Organization",
        url: "https://greencardorganization.com",
      });
    }
  }, []);

  const updateExtensionUI = (riskLevel: "High" | "Medium" | "Low") => {
    if (typeof chrome !== "undefined" && chrome.action) {
      let iconPath = "icons/icon-default.png";
      let badgeColor = "#06b6d4"; // Default Cyan
      let badgeText = "";

      if (riskLevel === "High") {
        iconPath = "icons/icon-warning.png";
        badgeColor = "#ef4444"; // Red
        badgeText = "!";
      } else if (riskLevel === "Low") {
        iconPath = "icons/icon-safe.png";
        badgeColor = "#10b981"; // Emerald
        badgeText = "OK";
      }

      // 1. Change the actual Icon
      chrome.action.setIcon({
        path: {
          "16": iconPath,
          "48": iconPath,
          "128": iconPath,
        },
      });

      // 2. Add a Badge for extra visibility
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    }
  };

  const handleScan = async () => {
    if (!currentTab?.url || !currentTab?.id) return;

    const originTabId = currentTab.id;
    setLoading(true);
    setAiText("");
    setResult(null);

    const APP_SECRET = import.meta.env.VITE_APP_SECRET;
    const NODE_SERVER = import.meta.env.VITE_NODE_SERVER_URL;
    const PYTHON_SERVER = import.meta.env.VITE_PYTHON_SERVER_URL;

    try {
      let pageContent = "No content found.";
      const isExtension = typeof chrome !== "undefined" && chrome.tabs;

      if (isExtension) {
        if (
          currentTab.url.startsWith("chrome://") ||
          currentTab.url.startsWith("edge://")
        ) {
          pageContent = "System page - no content available.";
        } else {
          try {
            const textResponse = await chrome.tabs.sendMessage(originTabId, {
              action: "getPageText",
            });
            pageContent = textResponse?.text || "No content found.";
          } catch (msgErr) {
            console.warn("Content script not ready", msgErr);
          }
        }
      }

      // 1. NODE SCAN
      const nodeRes = await axios.post(
        `${NODE_SERVER}/api/scan`,
        { url: currentTab.url },
        { headers: { "X-ScamGuard-Secret": APP_SECRET } },
      );

      // TAB GUARD: Stop if user switched away during Node scan
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab?.id !== originTabId) {
        console.log("Discarding results: User switched tabs.");
        setLoading(false);
        return;
      }

      // TIMESTAMP & UI UPDATE
      const timestamp = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setLastScanned(timestamp);
      setResult({ ...nodeRes.data });
      updateExtensionUI(nodeRes.data.overallRisk);

      // 2. AI ANALYZE WITH DATA DOSSIER
      // FIX: Secure hotlinkData extraction to prevent TypeErrors
      const hotlinkInfo = nodeRes.data.hotlinkData || {};

      const pythonStreamResponse = await fetch(
        `${PYTHON_SERVER}/api/ai-analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ScamGuard-Secret": APP_SECRET,
          },
          body: JSON.stringify({
            url: currentTab.url,
            page_content: pageContent,
            dossier: {
              domain_age: nodeRes.data.age || "Unknown",
              trustpilot_score: nodeRes.data.trustScore || 0,
              provider: nodeRes.data.provider || "Unknown",
              hotlink_alert: !!hotlinkInfo.isHotlinking, // Force boolean
              stolen_from: hotlinkInfo.details?.[0]?.domain || "None", // Safe array access
            },
          }),
        },
      );

      const reader = pythonStreamResponse.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        // CONTINUOUS STREAM GUARD
        const [currentCheck] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
        if (currentCheck?.id !== originTabId) break;

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
          {/* Timestamp Metadata Bar */}
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              <span className="text-[9px] font-black text-cyan-500/70 uppercase tracking-widest">
                Live Data Feed
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-500 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800">
              LAST_SCAN: <span className="text-slate-300">{lastScanned}</span>
            </div>
          </div>

          <Accordion title="Technical & Community Dossier" icon="📊">
            {/* 1. Spacing added below the Integrity Meter (mb-6) */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl mb-6">
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

          <Accordion
            title="Live Behavioral Analysis"
            icon="🧠"
            defaultOpen={true}
          >
            {/* 3. Styled scrollbar classes added here */}
            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent hover:scrollbar-thumb-cyan-500/40">
              {/* 2. Behavioural Analysis Grid Style for Verdict/Score */}
              {aiText.includes("Verdict:") && (
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-center gap-1 ${aiText.toLowerCase().includes("safe") ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}
                  >
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
                      Verdict
                    </p>
                    <p
                      className={`text-[11px] font-bold uppercase ${aiText.toLowerCase().includes("safe") ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {aiText.toLowerCase().includes("safe")
                        ? "🛡️ Verified Secure"
                        : "⚠️ High Risk"}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-800 bg-black/40 flex flex-col justify-center gap-1">
                    <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">
                      AI Trust Score
                    </p>
                    <p className="text-[14px] font-black text-white leading-none">
                      {aiText.match(/Score:\s*(\d+)/)?.[1] || "--"}
                      <span className="text-[9px] text-slate-600 ml-1">
                        /100
                      </span>
                    </p>
                  </div>
                </div>
              )}

              <div className="relative bg-black/40 rounded-xl border border-slate-800/60 p-5 shadow-inner min-h-[120px]">
                <div className="prose prose-invert max-w-none prose-p:text-[12px] prose-p:leading-relaxed prose-p:text-slate-300 prose-p:mb-4 prose-headings:text-cyan-400 prose-headings:font-black prose-headings:tracking-tight prose-headings:mt-6 prose-headings:mb-2 prose-h3:text-[13px] prose-h3:uppercase prose-h3:tracking-widest prose-ul:my-3 prose-ul:list-disc prose-ul:pl-5 prose-li:text-[11px] prose-li:mb-1.5 prose-li:text-slate-300 prose-code:text-cyan-300 prose-code:bg-cyan-500/10 prose-code:px-1 prose-code:rounded prose-strong:text-white">
                  <ReactMarkdown
                    remarkPlugins={[_remarkGfm]}
                    rehypePlugins={[_rehypeRaw]}
                    components={{
                      strong: ({ node, ...props }) => {
                        const content = props.children?.toString() || "";
                        // Verdict and Score are now handled by the grid above, so we can hide them or style them normally if they appear in text
                        const isLabel = /Summary|Evidence|Logic|Analysis/i.test(
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

                {loading && (
                  <div className="flex items-center gap-2 mt-4 px-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500/30 rounded-full animate-bounce"></span>
                    <span className="text-[9px] font-bold text-cyan-500/50 uppercase tracking-widest ml-1">
                      Analyzing...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Accordion>

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
        className={`transition-all duration-500 overflow-hidden ${isOpen ? "max-h-[800px] opacity-100 p-4 pt-0" : "max-h-0 opacity-0"}`}
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
