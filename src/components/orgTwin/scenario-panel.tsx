import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { EXAMPLE_SCENARIOS, MODEL_VARIANT_LABELS } from "@/lib/orgTwin/engine";
import type {
  ModelVariant,
  OrgModel,
  Scenario,
  ScenarioType,
} from "@/lib/orgTwin/types";

const TYPE_LABELS: Record<ScenarioType, string> = {
  PersonnelUnavailable: "Personnel reduction",
  FacilityOffline: "Facility outage",
  RoleUnavailable: "Role unavailable",
  EmployeeUnavailable: "Individual employee unavailable",
  SystemOffline: "System outage",
};

interface Props {
  model: OrgModel;
  scenario: Scenario;
  preset: number;
  onChange: (patch: Partial<Scenario>, preset?: number) => void;
  onPreset: (index: number) => void;
  onRun: () => void;
  onBaseline: () => void;
}

export function ScenarioPanel({
  model,
  scenario,
  preset,
  onChange,
  onPreset,
  onRun,
  onBaseline,
}: Props) {
  const roles = [...new Set(model.employees.map((e) => e.role))].sort();
  const t = scenario.type;
  const needsFacility = [
    "PersonnelUnavailable",
    "FacilityOffline",
    "RoleUnavailable",
  ].includes(t);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">
          Disruption controls
        </CardTitle>
        <CardDescription>
          {model.employees.length} fictional employees,{" "}
          {model.facilities.length} facilities, {model.workflows.length}{" "}
          workflows.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="variant">Model representation</FieldLabel>
            <NativeSelect
              id="variant"
              value={scenario.modelVariant}
              onChange={(e) =>
                onChange({ modelVariant: e.target.value as ModelVariant })
              }
            >
              {Object.entries(MODEL_VARIANT_LABELS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Comparisons keep the disruption, staffing, workflows and systems
              fixed.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="preset">Example scenario</FieldLabel>
            <NativeSelect
              id="preset"
              value={preset}
              onChange={(e) => onPreset(Number(e.target.value))}
            >
              <NativeSelectOption value={-1}>
                Custom scenario
              </NativeSelectOption>
              {EXAMPLE_SCENARIOS.map((s, i) => (
                <NativeSelectOption key={s.name} value={i}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="type">Disruption type</FieldLabel>
            <NativeSelect
              id="type"
              value={t}
              onChange={(e) =>
                onChange({ type: e.target.value as ScenarioType }, -1)
              }
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <NativeSelectOption key={k} value={k}>
                  {v}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          {needsFacility && (
            <Field>
              <FieldLabel htmlFor="facility">Affected facility</FieldLabel>
              <NativeSelect
                id="facility"
                value={scenario.facilityId}
                onChange={(e) => onChange({ facilityId: e.target.value }, -1)}
              >
                {model.facilities.map((f) => (
                  <NativeSelectOption key={f.facilityId} value={f.facilityId}>
                    {f.facilityName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {t === "PersonnelUnavailable" && (
            <Field>
              <FieldLabel htmlFor="pct">Personnel removed (%)</FieldLabel>
              <Input
                id="pct"
                type="number"
                min={0}
                max={100}
                value={scenario.personnelUnavailablePct ?? 0}
                onChange={(e) =>
                  onChange(
                    { personnelUnavailablePct: Number(e.target.value) },
                    -1,
                  )
                }
              />
            </Field>
          )}
          {t === "RoleUnavailable" && (
            <Field>
              <FieldLabel htmlFor="role">Affected role</FieldLabel>
              <NativeSelect
                id="role"
                value={scenario.role}
                onChange={(e) => onChange({ role: e.target.value }, -1)}
              >
                {roles.map((r) => (
                  <NativeSelectOption key={r} value={r}>
                    {r}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {t === "EmployeeUnavailable" && (
            <Field>
              <FieldLabel htmlFor="employee">Employee</FieldLabel>
              <NativeSelect
                id="employee"
                value={scenario.employeeId}
                onChange={(e) => onChange({ employeeId: e.target.value }, -1)}
              >
                {model.employees.map((e) => (
                  <NativeSelectOption key={e.employeeId} value={e.employeeId}>
                    {e.displayName} · {e.role} ({e.facilityId})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          {t === "SystemOffline" && (
            <Field>
              <FieldLabel htmlFor="system">Affected system</FieldLabel>
              <NativeSelect
                id="system"
                value={scenario.systemId}
                onChange={(e) => onChange({ systemId: e.target.value }, -1)}
              >
                {model.systems.map((x) => (
                  <NativeSelectOption key={x.systemId} value={x.systemId}>
                    {x.systemName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="hours">Disruption duration (hours)</FieldLabel>
            <Input
              id="hours"
              type="number"
              min={1}
              max={2160}
              value={scenario.durationHours}
              onChange={(e) =>
                onChange({ durationHours: Number(e.target.value) }, -1)
              }
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={onRun} className="flex-1">
              <Play className="h-4 w-4" />
              Run simulation
            </Button>
            <Button variant="secondary" onClick={onBaseline}>
              <RotateCcw className="h-4 w-4" />
              No disruption
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Personnel reductions remove the most critical employees first, as a
            worst-case stress test, not a probability prediction.
          </p>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
