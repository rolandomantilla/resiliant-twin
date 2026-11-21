import { Package, ShieldAlert, Truck, DollarSign, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScenarioComparison } from "@/hooks/useResilienceTwin";

interface KpiCardsProps {
  comparison: ScenarioComparison | null;
}

function delta(
  revised: number,
  baseline: number,
  unit: "count" | "usd" | "co2",
) {
  const d = Math.round((revised - baseline) * 100) / 100;
  if (d === 0)
    return { text: "no change vs. baseline", tone: "neutral" as const };
  const sign = d > 0 ? "+" : "\u2212";
  const abs = Math.abs(d);
  const tone =
    unit === "usd" || unit === "co2"
      ? d > 0
        ? "bad"
        : "good"
      : d > 0
        ? "good"
        : "bad";
  if (unit === "usd")
    return { text: `${sign}$${abs.toLocaleString()} vs. baseline`, tone };
  if (unit === "co2")
    return {
      text: `${sign}${abs.toLocaleString()} kg CO\u2082 vs. baseline`,
      tone,
    };
  return {
    text: `${sign}${abs.toLocaleString()} shipments vs. baseline`,
    tone,
  };
}

export function KpiCards({ comparison }: KpiCardsProps) {
  const metrics = comparison?.revised.metrics;
  const baseline = comparison?.baseline.metrics;

  const cards = [
    {
      label: "Scheduled shipments",
      icon: Package,
      value: metrics ? `${metrics.scheduled}/${metrics.shipments}` : "—",
      delta:
        metrics && baseline
          ? delta(metrics.scheduled, baseline.scheduled, "count")
          : null,
    },
    {
      label: "Critical shipments served",
      icon: ShieldAlert,
      value: metrics ? String(metrics.criticalScheduled) : "—",
      delta:
        metrics && baseline
          ? delta(
              metrics.criticalScheduled,
              baseline.criticalScheduled,
              "count",
            )
          : null,
    },
    {
      label: "Multi-trip trucks",
      icon: Truck,
      value: metrics ? String(metrics.trucksWithMultipleTrips) : "—",
      delta:
        metrics && baseline
          ? delta(
              metrics.trucksWithMultipleTrips,
              baseline.trucksWithMultipleTrips,
              "count",
            )
          : null,
    },
    {
      label: "Modeled trip cost",
      icon: DollarSign,
      value: metrics ? `$${metrics.scheduledCostUsd.toLocaleString()}` : "—",
      delta:
        metrics && baseline
          ? delta(metrics.scheduledCostUsd, baseline.scheduledCostUsd, "usd")
          : null,
    },
    {
      label: "Estimated CO\u2082",
      icon: Leaf,
      value: metrics ? `${metrics.scheduledCo2Kg.toLocaleString()} kg` : "—",
      delta:
        metrics && baseline
          ? delta(metrics.scheduledCo2Kg, baseline.scheduledCo2Kg, "co2")
          : null,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <card.icon className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              {card.label}
            </span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {card.value}
          </div>
          {card.delta && (
            <p
              className={cn(
                "mt-1 text-xs",
                card.delta.tone === "good" &&
                  "text-emerald-600 dark:text-emerald-400",
                card.delta.tone === "bad" &&
                  "text-amber-600 dark:text-amber-400",
                card.delta.tone === "neutral" && "text-muted-foreground",
              )}
            >
              {card.delta.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
