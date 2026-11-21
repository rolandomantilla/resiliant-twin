import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EmployeeUpdate,
  ExperienceUpdate,
  OrgModel,
  RelationshipUpdate,
} from "@/lib/orgTwin/types";

type Draft = Required<EmployeeUpdate>;

function baseDraft(model: OrgModel, eid: string): Draft {
  return {
    employeeId: eid,
    skills: Object.fromEntries(
      model.skills
        .filter((s) => s.employeeId === eid)
        .map((s) => [s.skillId, s.proficiency]),
    ),
    experience: model.experience
      .filter((x) => x.employeeId === eid)
      .map((x) =>
        x.yearsInRole !== null
          ? { workflowId: x.workflowId, yearsInRole: x.yearsInRole }
          : {
              workflowId: x.workflowId,
              similarTasksCompleted: x.similarTasksCompleted ?? 0,
            },
      ),
    relationships: model.relationships
      .filter((r) => r.sourceEmployeeId === eid)
      .map(({ sourceEmployeeId: _s, ...r }) => r),
  };
}

interface Props {
  model: OrgModel;
  edits: Record<string, EmployeeUpdate>;
  onEditsChange: (edits: Record<string, EmployeeUpdate>) => void;
  onApply: () => void;
}

export function EmployeeEditor({
  model,
  edits,
  onEditsChange,
  onApply,
}: Props) {
  const [eid, setEid] = useState(model.employees[0]?.employeeId ?? "");
  const [newSkill, setNewSkill] = useState("");
  const employee = model.employees.find((e) => e.employeeId === eid);
  const names = useMemo(
    () => new Map(model.employees.map((e) => [e.employeeId, e.displayName])),
    [model],
  );
  const workflowNames = useMemo(
    () => new Map(model.workflows.map((w) => [w.workflowId, w.workflowName])),
    [model],
  );
  const skillCatalog = useMemo(
    () =>
      [
        ...new Set([
          ...model.skills.map((s) => s.skillId),
          ...model.requirements.map((r) => r.skillId),
        ]),
      ].sort(),
    [model],
  );
  const draft = (edits[eid] as Draft | undefined) ?? baseDraft(model, eid);
  const myWorkflows = model.assignments
    .filter((a) => a.employeeId === eid)
    .map((a) => a.workflowId);
  const colleagues = (wid: string) =>
    model.assignments
      .filter((a) => a.workflowId === wid && a.employeeId !== eid)
      .map((a) => a.employeeId);

  function update(patch: Partial<Draft>) {
    onEditsChange({ ...edits, [eid]: { ...draft, ...patch } });
  }

  function setExperience(index: number, rec: ExperienceUpdate) {
    let next = draft.experience.map((x, i) => (i === index ? rec : x));
    if (rec.yearsInRole !== undefined) {
      // Years in role is one attribute of the person; keep rows in agreement.
      next = next.map((x) =>
        x.yearsInRole !== undefined
          ? { ...x, yearsInRole: rec.yearsInRole }
          : x,
      );
    }
    update({ experience: next });
  }

  function setRelationship(index: number, patch: Partial<RelationshipUpdate>) {
    update({
      relationships: draft.relationships.map((r, i) =>
        i === index ? { ...r, ...patch } : r,
      ),
    });
  }

  function addRelationship() {
    for (const wid of myWorkflows) {
      const taken = new Set(
        draft.relationships
          .filter((r) => r.workflowId === wid)
          .map((r) => r.targetEmployeeId),
      );
      const target = colleagues(wid).find((c) => !taken.has(c));
      if (target) {
        update({
          relationships: [
            ...draft.relationships,
            {
              workflowId: wid,
              targetEmployeeId: target,
              collaborationEvents: 10,
              handoffEvents: 3,
              meanHandoffHours: 0.5,
            },
          ],
        });
        return;
      }
    }
  }

  const incoming = model.employees.flatMap((src) => {
    if (src.employeeId === eid) return [];
    const outgoing =
      edits[src.employeeId]?.relationships ??
      model.relationships.filter((r) => r.sourceEmployeeId === src.employeeId);
    return outgoing
      .filter((r) => r.targetEmployeeId === eid)
      .map((r) => ({ ...r, source: src.employeeId }));
  });
  const peers = new Set([
    ...draft.relationships.map((r) => r.targetEmployeeId),
    ...incoming.map((r) => r.source),
  ]);
  const editedCount = Object.keys(edits).length;

  function reset(all: boolean) {
    if (all) onEditsChange({});
    else {
      const { [eid]: _removed, ...rest } = edits;
      onEditsChange(rest);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base font-medium">
            Employee human variables
          </CardTitle>
          <CardDescription>
            Adjust skills, experience or work relationships. Changes apply to
            this scenario only; the saved data stays unchanged.
          </CardDescription>
        </div>
        {editedCount > 0 && (
          <Badge variant="secondary">
            {editedCount} employee{editedCount === 1 ? "" : "s"} edited
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Field className="max-w-md">
          <FieldLabel htmlFor="edit-employee">Employee to edit</FieldLabel>
          <NativeSelect
            id="edit-employee"
            value={eid}
            onChange={(e) => setEid(e.target.value)}
          >
            {model.employees.map((e) => (
              <NativeSelectOption key={e.employeeId} value={e.employeeId}>
                {edits[e.employeeId] ? "● " : ""}
                {e.displayName} · {e.role} ({e.facilityId})
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {employee && (
            <p className="text-xs text-muted-foreground">
              {employee.employeeId} · {employee.workArrangement} ·{" "}
              {employee.fte} FTE · criticality {employee.operationalCriticality}{" "}
              · {peers.size} collaborators (
              {(peers.size / Math.max(1, model.employees.length - 1)).toFixed(
                3,
              )}{" "}
              degree centrality)
            </p>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">1. Skills</p>
            <p className="text-xs text-muted-foreground">
              Task-relevant proficiency, 1 (basic) to 5 (expert).
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competency</TableHead>
                  <TableHead className="w-28">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(draft.skills).map(([sid, value]) => (
                  <TableRow key={sid}>
                    <TableCell>{sid}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        step={1}
                        value={value}
                        aria-label={`${sid} proficiency`}
                        onChange={(e) =>
                          update({
                            skills: {
                              ...draft.skills,
                              [sid]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2">
              <NativeSelect
                aria-label="Add competency"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
              >
                <NativeSelectOption value="">
                  Add a competency…
                </NativeSelectOption>
                {skillCatalog
                  .filter((s) => !(s in draft.skills))
                  .map((s) => (
                    <NativeSelectOption key={s} value={s}>
                      {s}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <Button
                variant="outline"
                disabled={!newSkill}
                onClick={() => {
                  update({ skills: { ...draft.skills, [newSkill]: 3 } });
                  setNewSkill("");
                }}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">2. Experience</p>
            <p className="text-xs text-muted-foreground">
              Years in current role or similar tasks completed, per assigned
              workflow. Years in role stay in agreement across workflows.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Measure</TableHead>
                  <TableHead className="w-28">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.experience.map((x, i) => {
                  const years = x.yearsInRole !== undefined;
                  return (
                    <TableRow key={x.workflowId}>
                      <TableCell className="text-xs">
                        {workflowNames.get(x.workflowId)}
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          aria-label="Experience measure"
                          value={years ? "years" : "tasks"}
                          onChange={(e) => {
                            const otherYears = draft.experience.find(
                              (o) => o.yearsInRole !== undefined,
                            )?.yearsInRole;
                            setExperience(
                              i,
                              e.target.value === "years"
                                ? {
                                    workflowId: x.workflowId,
                                    yearsInRole: otherYears ?? 1,
                                  }
                                : {
                                    workflowId: x.workflowId,
                                    similarTasksCompleted: 100,
                                  },
                            );
                          }}
                        >
                          <NativeSelectOption value="years">
                            Years in role
                          </NativeSelectOption>
                          <NativeSelectOption value="tasks">
                            Similar tasks
                          </NativeSelectOption>
                        </NativeSelect>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step={years ? 0.1 : 1}
                          aria-label="Experience value"
                          value={
                            years ? x.yearsInRole : x.similarTasksCompleted
                          }
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setExperience(
                              i,
                              years
                                ? { workflowId: x.workflowId, yearsInRole: v }
                                : {
                                    workflowId: x.workflowId,
                                    similarTasksCompleted: v,
                                  },
                            );
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">3. Organizational relationships</p>
          <p className="text-xs text-muted-foreground">
            Outgoing handoffs to colleagues on the same workflow over a 30-day
            window. Mean handoff delay is capped at 2 hours.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Hands off to</TableHead>
                <TableHead className="w-28">Collaborations</TableHead>
                <TableHead className="w-28">Handoffs</TableHead>
                <TableHead className="w-28">Delay (h)</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.relationships.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-xs text-muted-foreground"
                  >
                    No outgoing relationships recorded.
                  </TableCell>
                </TableRow>
              )}
              {draft.relationships.map((r, i) => (
                <TableRow key={`${r.workflowId}-${r.targetEmployeeId}-${i}`}>
                  <TableCell>
                    <NativeSelect
                      aria-label="Workflow"
                      value={r.workflowId}
                      onChange={(e) =>
                        setRelationship(i, {
                          workflowId: e.target.value,
                          targetEmployeeId:
                            colleagues(e.target.value)[0] ?? r.targetEmployeeId,
                        })
                      }
                    >
                      {myWorkflows.map((w) => (
                        <NativeSelectOption key={w} value={w}>
                          {workflowNames.get(w)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label="Colleague"
                      value={r.targetEmployeeId}
                      onChange={(e) =>
                        setRelationship(i, { targetEmployeeId: e.target.value })
                      }
                    >
                      {colleagues(r.workflowId).map((c) => (
                        <NativeSelectOption key={c} value={c}>
                          {names.get(c)}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </TableCell>
                  {(
                    [
                      ["collaborationEvents", 0, 1],
                      ["handoffEvents", 1, 1],
                      ["meanHandoffHours", 0, 0.1],
                    ] as const
                  ).map(([key, min, step]) => (
                    <TableCell key={key}>
                      <Input
                        type="number"
                        min={min}
                        step={step}
                        aria-label={key}
                        value={r[key]}
                        onChange={(e) =>
                          setRelationship(i, { [key]: Number(e.target.value) })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove relationship"
                      onClick={() =>
                        update({
                          relationships: draft.relationships.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div>
            <Button variant="outline" size="sm" onClick={addRelationship}>
              <Plus className="h-4 w-4" />
              Add outgoing relationship
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Incoming:{" "}
            {incoming.length
              ? incoming
                  .map(
                    (r) =>
                      `${names.get(r.source)} (${r.workflowId}, ${r.handoffEvents} handoffs)`,
                  )
                  .join(" · ")
              : "none"}
            . Edit an incoming handoff by selecting its sender.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onApply}>Apply changes &amp; run simulation</Button>
          <Button
            variant="secondary"
            disabled={!edits[eid]}
            onClick={() => reset(false)}
          >
            Reset this employee
          </Button>
          <Button
            variant="secondary"
            disabled={editedCount === 0}
            onClick={() => reset(true)}
          >
            Reset all edits
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
