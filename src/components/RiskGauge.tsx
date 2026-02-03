export default function RiskGauge({ score }: { score: number }) {
  const percentage = (score / 5) * 100;

  const getStatus = () => {
    if (score < 2.5)
      return { color: "#ef4444", label: "DANGER", animate: "animate-pulse" };
    if (score < 3.8) return { color: "#f59e0b", label: "CAUTION", animate: "" };
    return { color: "#22d3ee", label: "SECURE", animate: "shimmer-flow" };
  };

  const status = getStatus();

  return (
    <div className="py-2">
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .shimmer-flow {
          position: relative;
          overflow: hidden;
        }
        .shimmer-flow::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.2),
            transparent
          );
          animation: shimmer 2s infinite;
        }
      `}</style>

      <div className="flex justify-between w-full mb-1 px-0.5">
        {[0, 1, 2, 3, 4, 5].map((val) => (
          <span key={val} className="text-[7px] font-mono text-slate-600">
            {val}
          </span>
        ))}
      </div>

      <div
        className={`relative h-2 w-full bg-black/40 rounded-full border border-slate-800 shadow-inner ${score < 2.0 ? "ring-1 ring-red-500/30" : ""}`}
      >
        {/* Progress Bar */}
        <div
          className={`h-full transition-all duration-1000 ease-out rounded-full ${status.animate}`}
          style={{
            width: `${percentage}%`,
            backgroundColor: status.color,
            boxShadow: `0 0 12px ${status.color}${score < 2.5 ? "60" : "30"}`,
          }}
        >
          {/* Internal Detail */}
          <div className="absolute inset-0 bg-black/10 flex justify-between px-1">
            {[...Array(Math.floor(percentage / 10))].map((_, i) => (
              <div key={i} className="h-full w-[1px] bg-white/10" />
            ))}
          </div>
        </div>

        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700/50" />
      </div>

      {/* Dynamic Status Text */}
      <div className="mt-2 flex justify-center">
        <span
          className="text-[8px] font-black tracking-[0.2em] px-2 py-0.5 rounded-sm border"
          style={{
            color: status.color,
            borderColor: `${status.color}30`,
            backgroundColor: `${status.color}10`,
          }}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
