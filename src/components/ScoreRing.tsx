interface ScoreRingProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  dark?: boolean;
}

export function ScoreRing({
  score,
  size = 112,
  strokeWidth = 9,
  label,
  dark = false,
}: ScoreRingProps) {
  const safeScore = score === null ? 0 : Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;

  let strokeColor = "#2563EB";
  if (score === null) {
    strokeColor = dark ? "#334155" : "#CBD5E1";
  } else if (safeScore >= 80) {
    strokeColor = "#16A34A";
  } else if (safeScore >= 60) {
    strokeColor = "#2563EB";
  } else {
    strokeColor = "#D97706";
  }

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={dark ? "rgba(148, 163, 184, 0.2)" : "#E2E8F0"}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono tabular-nums font-bold ${
              size >= 110 ? "text-2xl" : "text-lg"
            } ${dark ? "text-white" : "text-slate-900"}`}
          >
            {score !== null ? `${safeScore}%` : "—"}
          </span>
          {label && (
            <span className={`text-[11px] font-medium ${dark ? "text-slate-300" : "text-slate-500"}`}>
              {label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
