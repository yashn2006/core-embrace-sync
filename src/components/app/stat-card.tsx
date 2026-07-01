import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  accent,
  icon,
  delta,
  spark,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
  icon?: ReactNode;
  delta?: number;
  spark?: number[];
  delay?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-hairline bg-card p-5 hover-lift animate-reveal"
      style={{ animationDelay: `${delay}ms`, boxShadow: "var(--shadow-soft)" }}
    >
      {accent && (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "var(--gradient-magenta)" }}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
          {label}
        </div>
        {icon && (
          <div
            className={
              "h-7 w-7 rounded-lg flex items-center justify-center transition-colors " +
              (accent ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted")
            }
          >
            {icon}
          </div>
        )}
      </div>
      <div
        className={
          "mt-3 text-[28px] leading-none font-semibold tabular tracking-tight " +
          (accent ? "text-gradient" : "text-foreground")
        }
      >
        {value}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {typeof delta === "number" && (
            <span
              className={
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium " +
                (positive ? "text-success bg-success/10" : "text-destructive bg-destructive/10")
              }
            >
              {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {positive ? "+" : ""}
              {delta}%
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} accent={accent} />}
      </div>
    </div>
  );
}

function Sparkline({ data, accent }: { data: number[]; accent?: boolean }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const stroke = accent ? "url(#sparkGrad)" : "var(--color-muted-foreground)";
  const id = `sg-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.22 340)" />
          <stop offset="100%" stopColor="oklch(0.58 0.24 305)" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={accent ? `url(#${id})` : stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-draw"
      />
    </svg>
  );
}