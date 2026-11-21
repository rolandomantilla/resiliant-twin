import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmployeeEditor } from "@/components/orgTwin/employee-editor";
import {
  AssumptionsCard,
  FacilityCards,
  HumanVariablesCard,
  MetricCards,
  RecoveryCard,
  SummaryCard,
  WorkflowList,
} from "@/components/orgTwin/results";
import { ScenarioPanel } from "@/components/orgTwin/scenario-panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useCapabilities } from "@/hooks/useCapabilities";
import { EXAMPLE_SCENARIOS, simulate } from "@/lib/orgTwin/engine";
import type {
  EmployeeUpdate,
  OrgModel,
  Scenario,
  SimulationResult,
} from "@/lib/orgTwin/types";
import { getOrgModel } from "@/services/db/orgTwinService";

export const Route = createFileRoute("/_protected/org-readiness")({
  component: OrgReadinessPage,
});

const DEFAULT_PRESET = 1;

function fromPreset(index: number, current: Scenario): Scenario {
  const { name: _name, ...preset } = EXAMPLE_SCENARIOS[index];
  return { ...current, ...preset };
}

function OrgReadinessPage() {
  const { data: caps, isLoading: capsLoading } = useCapabilities();
  const dbEnabled = caps?.databaseEnabled === true;
  const {
    data: model,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["org-model"],
    queryFn: () => getOrgModel(),
    enabled: dbEnabled,
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (capsLoading || (dbEnabled && isLoading)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!dbEnabled) {
    return (
      <Empty className="py-16">
        <EmptyTitle>Database not configured</EmptyTitle>
        <EmptyDescription>
          The organizational model is stored in the app database.
        </EmptyDescription>
      </Empty>
    );
  }
  if (error || !model || model.employees.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error instanceof Error
            ? error.message
            : "The organizational model has no data."}
        </AlertDescription>
      </Alert>
    );
  }
  return <Console model={model} />;
}

function Console({ model }: { model: OrgModel }) {
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [scenario, setScenario] = useState<Scenario>(() =>
    fromPreset(DEFAULT_PRESET, {
      type: "PersonnelUnavailable",
      modelVariant: "human_centered",
      facilityId: model.facilities[0]?.facilityId,
      personnelUnavailablePct: 30,
      role: model.employees[0]?.role,
      employeeId: model.employees[0]?.employeeId,
      systemId: model.systems[0]?.systemId,
      durationHours: 24,
    }),
  );
  const [edits, setEdits] = useState<Record<string, EmployeeUpdate>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);

  const run = useCallback(
    (s: Scenario, e: Record<string, EmployeeUpdate>) => {
      try {
        setResult(simulate({ ...s, employeeUpdates: Object.values(e) }, model));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Simulation failed");
      }
    },
    [model],
  );

  // Run the default example once so the console never opens empty.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initial run only
  useEffect(() => run(scenario, edits), []);

  function change(patch: Partial<Scenario>, nextPreset?: number) {
    setScenario((s) => ({ ...s, ...patch }));
    if (nextPreset !== undefined) setPreset(nextPreset);
  }

  function choosePreset(index: number) {
    setPreset(index);
    if (index >= 0) setScenario((s) => fromPreset(index, s));
  }

  function runBaseline() {
    const next: Scenario = {
      ...scenario,
      type: "PersonnelUnavailable",
      personnelUnavailablePct: 0,
    };
    setScenario(next);
    setPreset(-1);
    run(next, edits);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Organizational Readiness Simulator
          </h1>
          <p className="text-sm text-muted-foreground">
            ResilienceTwin v0.2: what-if disruptions across people, skills,
            workflows and systems.
          </p>
        </div>
        <Badge variant="outline">Synthetic data</Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-4 xl:self-start">
          <ScenarioPanel
            model={model}
            scenario={scenario}
            preset={preset}
            onChange={change}
            onPreset={choosePreset}
            onRun={() => run(scenario, edits)}
            onBaseline={runBaseline}
          />
        </div>
        {result ? (
          <div className="flex min-w-0 flex-col gap-4">
            <MetricCards result={result} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FacilityCards
                model={model}
                result={result}
                selected={scenario.facilityId}
                onSelect={(facilityId) => change({ facilityId }, -1)}
              />
              <SummaryCard result={result} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <WorkflowList result={result} />
              <RecoveryCard result={result} />
            </div>
          </div>
        ) : (
          <Empty className="py-16">
            <Users className="h-8 w-8 text-muted-foreground" />
            <EmptyTitle>No simulation yet</EmptyTitle>
            <EmptyDescription>
              Choose a disruption and run the simulation.
            </EmptyDescription>
          </Empty>
        )}
      </div>

      <EmployeeEditor
        model={model}
        edits={edits}
        onEditsChange={setEdits}
        onApply={() => run(scenario, edits)}
      />
      {result && (
        <>
          <HumanVariablesCard result={result} />
          <AssumptionsCard result={result} />
        </>
      )}
    </div>
  );
}
