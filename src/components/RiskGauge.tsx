export default function RiskGauge({ score }: { score: number }) {
  // Map 0.0 - 5.0 to 0% - 100%
  const percentage = (score / 5) * 100;
  // Determine color based on trust score
  const getColor = () => {
    if (score < 2.5) return "#ef4444"; // Red
    if (score < 3.5) return "#f59e0b"; // Orange
    return "#10b981"; // Green
  };

  return (
    <div className="relative h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
      <div
        className="h-full transition-all duration-1000 ease-out"
        style={{
          width: `${percentage}%`,
          backgroundColor: getColor(),
          boxShadow: `0 0 10px ${getColor()}50`,
        }}
      />
      {/* 50% Marker */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
    </div>
  );
}
