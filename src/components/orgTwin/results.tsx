import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODEL_VARIANT_LABELS } from "@/lib/orgTwin/engine";
import type {
  OrgModel,
  SimulationResult,
  WorkflowResult,
} from "@/lib/orgTwin/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<
  WorkflowResult["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  Operational: "secondary",
  Degraded: "outline",
  "At Risk": "destructive",
  Blocked: "destructive",
};

export function MetricCards({ result }: { result: SimulationResult }) {
  const m = result.summary;
  const items = [
    {
      label: "Weighted readiness",
      value: `${m.weightedReadinessPct.toFixed(1)}%`,
      note: `${m.readinessChangePoints > 0 ? "+" : ""}${m.readinessChangePoints} points vs baseline (${m.baselineReadinessPct}%)`,
    },
    {
      label: "Workflows impacted",
      value: `${m.workflowsAtRisk} / ${m.workflowCount}`,
      note: `${m.workflowsBlocked} fully blocked`,
    },
    {
      label: "Staff unavailable",
      value: String(m.staffUnavailable),
      note: `Of ${m.headcountTotal} employees`,
    },
    {
      label: "Recovery candidates",
      value: String(m.candidateTransfers),
      note: "Unverified alternatives",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardHeader className="pb-2">
            <CardDescription>{i.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{i.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{i.note}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FacilityCards({
  model,
  result,
  selected,
  onSelect,
}: {
  model: OrgModel;
  result: SimulationResult;
  selected?: string;
  onSelect: (facilityId: string) => void;
}) {
  const affected = new Set(result.summary.affectedFacilityIds);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">Facilities</CardTitle>
        <CardDescription>Choose a location to target it.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {model.facilities.map((f) => (
          <button
            type="button"
            key={f.facilityId}
            onClick={() => onSelect(f.facilityId)}
            className={cn(
              "rounded-md border border-border p-3 text-left transition-colors hover:bg-muted",
              selected === f.facilityId && "border-primary bg-accent",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {f.city}, {f.state}
              </span>
              {affected.has(f.facilityId) && (
                <Badge variant="outline">Affected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {f.primaryFunction} · {f.headcountTarget} employees
            </p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

export function WorkflowList({ result }: { result: SimulationResult }) {
  const rows = [...result.workflows].sort(
    (a, b) => b.criticality - a.criticality || a.coveragePct - b.coveragePct,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Workflow resilience
        </CardTitle>
        <CardDescription>Sorted by criticality, then coverage.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 pr-3">
          <div className="flex flex-col divide-y divide-border">
            {rows.map((w) => (
              <div key={w.workflowId} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{w.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">
                      {w.coveragePct}%
                    </span>
                    <Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge>
                  </div>
                </div>
                <Progress value={w.coveragePct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  Criticality {w.criticality} · Task time{" "}
                  {w.taskCompletionHours === null
                    ? "blocked"
                    : `${w.taskCompletionHours.toFixed(2)} h`}{" "}
                  · {w.throughputTasksPerHour.toFixed(3)} tasks/hour ·{" "}
                  {w.assignedPeopleActive}/{w.assignedPeopleBaseline} people
                  active
                </p>
                <p className="text-xs text-muted-foreground">
                  {w.skillGaps.length
                    ? w.skillGaps
                        .map((g) => `${g.skill} gap: ${g.shortfall}`)
                        .join(", ")
                    : "No required-skill gap"}
                  {w.blockedSystems.length > 0 &&
                    ` · Required system offline: ${w.blockedSystems.join(", ")}`}
                  {w.degradedSystems.length > 0 &&
                    ` · Supporting system offline: ${w.degradedSystems.join(", ")}`}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function SummaryCard({ result }: { result: SimulationResult }) {
  const m = result.summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Simulation summary
        </CardTitle>
        <CardDescription>
          {MODEL_VARIANT_LABELS[result.scenario.modelVariant]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">
        <p>
          Estimated readiness is <strong>{m.weightedReadinessPct}%</strong>, a
          change of {m.readinessChangePoints} points from the undisrupted
          baseline. {m.staffUnavailable} staff unavailable, {m.systemsOffline}{" "}
          systems offline. {m.workflowsAtRisk} workflows impacted,{" "}
          {m.workflowsBlocked} fully blocked.
        </p>
        <p className="text-muted-foreground">
          {m.candidateTransfers} potential transfer candidates identified.
          Candidates don't change modeled impact until a reassignment is
          validated. These are deterministic what-if estimates, not forecasts.
        </p>
        <div>
          <p className="text-xs font-medium">Systems disrupted</p>
          <p className="text-xs text-muted-foreground">
            {result.offlineSystems.length
              ? result.offlineSystems
                  .map((s) => `${s.systemId}: ${s.name}`)
                  .join(" · ")
              : "No modeled system outages"}
          </p>
        </div>
        {result.unavailableEmployees.length > 0 && (
          <div>
            <p className="text-xs font-medium">Unavailable employees</p>
            <p className="text-xs text-muted-foreground">
              {result.unavailableEmployees
                .slice(0, 12)
                .map((e) => `${e.name} (${e.role})`)
                .join(" · ")}
              {result.unavailableEmployees.length > 12 &&
                ` · +${result.unavailableEmployees.length - 12} more`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecoveryCard({ result }: { result: SimulationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Potential recovery candidates
        </CardTitle>
        <CardDescription>
          Qualified people with spare allocation. Confirm shift, approvals,
          access and training before using them.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {result.recoveryCandidates.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            No suitable candidate under current constraints, or no qualifying
            skill gaps.
          </p>
        ) : (
          <ScrollArea className="h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Move</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Spare FTE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.recoveryCandidates.map((c) => (
                  <TableRow key={`${c.workflowId}-${c.employeeId}-${c.skill}`}>
                    <TableCell className="font-medium">
                      {c.employeeName}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.fromFacilityId} → {c.toFacilityId}
                    </TableCell>
                    <TableCell>{c.workflowId}</TableCell>
                    <TableCell className="text-xs">
                      {c.skill} (level {c.proficiency})
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.spareFteAllocated}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export function HumanVariablesCard({ result }: { result: SimulationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Human variables in this simulation
        </CardTitle>
        <CardDescription>
          Efficiency is weighted by assigned FTE. Disabled variables use 100%
          efficiency or zero delay.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead className="text-right">Skill eff.</TableHead>
                <TableHead className="text-right">Experience eff.</TableHead>
                <TableHead className="text-right">Handoff delay</TableHead>
                <TableHead className="text-right">Disrupted handoffs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.workflows.map((w) => (
                <TableRow key={w.workflowId}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(100 * w.skillEfficiencyFactor).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(100 * w.experienceEfficiencyFactor).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {w.coordinationDelayHours.toFixed(2)} h
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {w.disruptedHandoffEvents} / {w.handoffEvents}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">
              Same scenario across model representations
            </p>
            <p className="text-xs text-muted-foreground">
              Differences show the effect of assumptions, not predictive
              accuracy.
            </p>
          </div>
          {result.modelComparison.map((c) => (
            <div key={c.modelVariant} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span
                  className={cn(
                    c.modelVariant === result.scenario.modelVariant &&
                      "font-medium",
                  )}
                >
                  {MODEL_VARIANT_LABELS[c.modelVariant]}
                </span>
                <span className="tabular-nums">
                  {c.weightedReadinessPct.toFixed(1)}%
                </span>
              </div>
              <Progress value={c.weightedReadinessPct} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AssumptionsCard({ result }: { result: SimulationResult }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ResilienceTwin_Simulation.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base font-medium">
            Assumptions and auditability
          </CardTitle>
          <CardDescription>
            Synthetic assumptions; validate before any operational use.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={exportJson}>
          <Download className="h-4 w-4" />
          Export JSON
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs md:grid-cols-2">
          {Object.entries(result.methodology).map(([k, v]) => (
            <div key={k}>
              <dt className="font-medium">{k}</dt>
              <dd className="text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
