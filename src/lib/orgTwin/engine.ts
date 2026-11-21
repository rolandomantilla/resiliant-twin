// Port of the ResilienceTwin v0.2 deterministic disruption engine
// (engine.py + human_factors.py). Synthetic demonstration model only.
import type {
  EmployeeUpdate,
  ModelVariant,
  OrgAssignment,
  OrgEmployee,
  OrgExperience,
  OrgModel,
  OrgSkillRequirement,
  RecoveryCandidate,
  Scenario,
  SimulationResult,
  SkillGap,
  WorkflowResult,
} from "./types";

export const HUMAN_PARAMETERS = {
  skillEfficiencyFloor: 0.5,
  experienceEfficiencyFloor: 0.6,
  referenceYearsInRole: 10,
  referenceSimilarTasks: 500,
  collaborationReferenceEvents: 20,
  disconnectedHandoffHours: 2,
  observationWindowDays: 30,
} as const;

type HumanVariable = "skills" | "experience" | "relationships";

export const MODEL_VARIANTS: Record<
  ModelVariant,
  ReadonlySet<HumanVariable>
> = {
  process_only: new Set(),
  skills_only: new Set(["skills"]),
  experience_only: new Set(["experience"]),
  relationships_only: new Set(["relationships"]),
  human_centered: new Set(["skills", "experience", "relationships"]),
};

export const MODEL_VARIANT_LABELS: Record<ModelVariant, string> = {
  human_centered: "All three human variables",
  process_only: "Process only",
  skills_only: "Skills only",
  experience_only: "Experience only",
  relationships_only: "Relationships only",
};

const round = (x: number, digits: number) => Number(x.toFixed(digits));

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

function validate(s: Scenario, data: OrgModel) {
  if (!(s.modelVariant in MODEL_VARIANTS))
    throw new Error("Unsupported model variant");
  const facilities = new Set(data.facilities.map((f) => f.facilityId));
  if (
    ["PersonnelUnavailable", "FacilityOffline", "RoleUnavailable"].includes(
      s.type,
    ) &&
    !facilities.has(s.facilityId ?? "")
  )
    throw new Error("Choose a facility");
  if (
    s.type === "EmployeeUnavailable" &&
    !data.employees.some((e) => e.employeeId === s.employeeId)
  )
    throw new Error("Choose an employee");
  if (
    s.type === "SystemOffline" &&
    !data.systems.some((x) => x.systemId === s.systemId)
  )
    throw new Error("Choose a system");
  if (s.type === "PersonnelUnavailable") {
    const pct = s.personnelUnavailablePct;
    if (pct === undefined || !Number.isFinite(pct) || pct < 0 || pct > 100)
      throw new Error("Personnel removed must be between 0 and 100%");
  }
  if (s.type === "RoleUnavailable" && !s.role) throw new Error("Choose a role");
  if (
    !Number.isFinite(s.durationHours) ||
    s.durationHours <= 0 ||
    s.durationHours > 2160
  )
    throw new Error("Duration must be between 1 and 2160 hours");
}

function checkNumber(
  value: number,
  label: string,
  min = 0,
  max?: number,
  whole = false,
) {
  if (
    !Number.isFinite(value) ||
    value < min ||
    (max !== undefined && value > max)
  )
    throw new Error(`Invalid ${label}`);
  if (whole && !Number.isInteger(value))
    throw new Error(`${label} must be a whole number`);
}

/** Apply scenario-local edits; saved records are never changed. */
export function applyEmployeeUpdates(
  data: OrgModel,
  updates: EmployeeUpdate[],
): OrgModel {
  if (updates.length === 0) return data;
  const skills = data.skills.map((x) => ({ ...x }));
  const experience = data.experience.map((x) => ({ ...x }));
  let relationships = data.relationships.map((x) => ({ ...x }));
  const assigned = new Set(
    data.assignments.map((a) => `${a.employeeId}|${a.workflowId}`),
  );
  const employeeIds = new Set(data.employees.map((e) => e.employeeId));
  const seen = new Set<string>();
  for (const update of updates) {
    const eid = update.employeeId;
    if (!employeeIds.has(eid) || seen.has(eid))
      throw new Error("Unknown or duplicate employee in edits");
    seen.add(eid);
    for (const [sid, value] of Object.entries(update.skills ?? {})) {
      checkNumber(value, `${sid} proficiency`, 1, 5);
      const existing = skills.find(
        (x) => x.employeeId === eid && x.skillId === sid,
      );
      if (existing) existing.proficiency = value;
      else skills.push({ employeeId: eid, skillId: sid, proficiency: value });
    }
    for (const rec of update.experience ?? []) {
      const target = experience.find(
        (x) => x.employeeId === eid && x.workflowId === rec.workflowId,
      );
      if (!target) throw new Error("Unknown workflow assignment in experience");
      const hasYears = rec.yearsInRole !== undefined;
      if (hasYears === (rec.similarTasksCompleted !== undefined))
        throw new Error(
          "Choose years in role or similar tasks completed, not both",
        );
      if (hasYears) checkNumber(rec.yearsInRole ?? 0, "years in role");
      else
        checkNumber(
          rec.similarTasksCompleted ?? 0,
          "similar tasks completed",
          0,
          undefined,
          true,
        );
      target.yearsInRole = hasYears ? (rec.yearsInRole ?? null) : null;
      target.similarTasksCompleted = hasYears
        ? null
        : (rec.similarTasksCompleted ?? null);
    }
    if (update.relationships) {
      const outgoing = update.relationships.map((r) => {
        checkNumber(
          r.collaborationEvents,
          "collaboration events",
          0,
          undefined,
          true,
        );
        checkNumber(r.handoffEvents, "handoff events", 1, undefined, true);
        checkNumber(
          r.meanHandoffHours,
          "mean handoff hours",
          0,
          HUMAN_PARAMETERS.disconnectedHandoffHours,
        );
        return { ...r, sourceEmployeeId: eid };
      });
      relationships = relationships
        .filter((r) => r.sourceEmployeeId !== eid)
        .concat(outgoing);
    }
  }
  // Consistency checks mirror validate_human_data.
  const roleYears = new Map<string, number>();
  for (const rec of experience) {
    if (rec.yearsInRole === null) continue;
    const prior = roleYears.get(rec.employeeId);
    if (prior !== undefined && prior !== rec.yearsInRole)
      throw new Error(
        `Years in role must agree across workflows for ${rec.employeeId}`,
      );
    roleYears.set(rec.employeeId, rec.yearsInRole);
  }
  const edges = new Set<string>();
  for (const r of relationships) {
    const key = `${r.workflowId}|${r.sourceEmployeeId}|${r.targetEmployeeId}`;
    if (
      r.sourceEmployeeId === r.targetEmployeeId ||
      !assigned.has(`${r.sourceEmployeeId}|${r.workflowId}`) ||
      !assigned.has(`${r.targetEmployeeId}|${r.workflowId}`) ||
      edges.has(key)
    )
      throw new Error(
        `Invalid or duplicate relationship ${r.sourceEmployeeId} → ${r.targetEmployeeId} (${r.workflowId})`,
      );
    edges.add(key);
  }
  return { ...data, skills, experience, relationships };
}

function experienceMeasure(rec: OrgExperience) {
  return rec.yearsInRole !== null
    ? {
        value: rec.yearsInRole,
        reference: HUMAN_PARAMETERS.referenceYearsInRole,
      }
    : {
        value: rec.similarTasksCompleted ?? 0,
        reference: HUMAN_PARAMETERS.referenceSimilarTasks,
      };
}

function workflowEffects(
  wid: string,
  taskWorkHours: number,
  assignments: OrgAssignment[],
  unavailable: Set<string>,
  requirements: OrgSkillRequirement[],
  emp: Map<string, OrgEmployee>,
  skills: Map<string, Map<string, number>>,
  data: OrgModel,
  experienceIndex: Map<string, OrgExperience>,
  baselineFte: number,
  capacityFactor: number,
  systemFactor: number,
  enabled: ReadonlySet<HumanVariable>,
) {
  const p = HUMAN_PARAMETERS;
  const diagnostics = assignments.map((a) => {
    const e = emp.get(a.employeeId) as OrgEmployee;
    const weight = (e.fte * a.allocationPct) / 100;
    const available = e.status === "Active" && !unavailable.has(a.employeeId);
    const own = skills.get(a.employeeId);
    const proficiency = requirements.length
      ? Math.min(...requirements.map((r) => (own?.get(r.skillId) ?? 0) / 5))
      : 1;
    const skillEff = enabled.has("skills")
      ? p.skillEfficiencyFloor + (1 - p.skillEfficiencyFloor) * proficiency
      : 1;
    const rec = experienceIndex.get(`${a.employeeId}|${wid}`);
    let expEff = 1;
    if (enabled.has("experience") && rec) {
      const m = experienceMeasure(rec);
      expEff =
        p.experienceEfficiencyFloor +
        (1 - p.experienceEfficiencyFloor) * Math.min(1, m.value / m.reference);
    }
    return {
      employeeId: a.employeeId,
      weight,
      available,
      skillEff,
      expEff,
      effective: available ? weight * skillEff * expEff : 0,
    };
  });
  const active = diagnostics.filter((d) => d.available);
  const totalFte = active.reduce((s, d) => s + d.weight, 0);
  const average = (f: (d: (typeof active)[number]) => number) =>
    totalFte ? active.reduce((s, d) => s + d.weight * f(d), 0) / totalFte : 0;
  const effectiveFte = diagnostics.reduce((s, d) => s + d.effective, 0);
  const activeIds = new Set(active.map((d) => d.employeeId));
  const edges = data.relationships.filter((r) => r.workflowId === wid);
  let handoffs = 0;
  let lostHandoffs = 0;
  let delaySum = 0;
  for (const edge of edges) {
    handoffs += edge.handoffEvents;
    const connected =
      activeIds.has(edge.sourceEmployeeId) &&
      activeIds.has(edge.targetEmployeeId);
    let delay: number;
    if (connected) {
      delay =
        edge.meanHandoffHours /
        (1 + edge.collaborationEvents / p.collaborationReferenceEvents);
    } else {
      delay = p.disconnectedHandoffHours;
      lostHandoffs += edge.handoffEvents;
    }
    delaySum += edge.handoffEvents * delay;
  }
  let coordination = handoffs ? delaySum / handoffs : 0;
  if (!enabled.has("relationships")) coordination = 0;
  const referenceTime = baselineFte ? taskWorkHours / baselineFte : null;
  const productiveFte =
    Math.min(effectiveFte, baselineFte * capacityFactor) * systemFactor;
  const processing = productiveFte ? taskWorkHours / productiveFte : null;
  const taskHours = processing !== null ? processing + coordination : null;
  const throughput = taskHours ? 1 / taskHours : 0;
  return {
    skillEfficiencyFactor: round(
      average((d) => d.skillEff),
      4,
    ),
    experienceEfficiencyFactor: round(
      average((d) => d.expEff),
      4,
    ),
    productiveFte: round(productiveFte, 4),
    coordinationDelayHours: round(coordination, 4),
    handoffEvents: handoffs,
    disruptedHandoffEvents: lostHandoffs,
    taskCompletionHours: taskHours !== null ? round(taskHours, 4) : null,
    throughputTasksPerHour: round(throughput, 6),
    coveragePct: referenceTime
      ? round(Math.min(100, referenceTime * throughput * 100), 1)
      : 0,
  };
}

function compute(s: Scenario, data: OrgModel) {
  const enabled = MODEL_VARIANTS[s.modelVariant];
  const emp = new Map(data.employees.map((e) => [e.employeeId, e]));
  const assignments = groupBy(data.assignments, (a) => a.workflowId);
  const skills = new Map<string, Map<string, number>>();
  for (const x of data.skills) {
    if (!skills.has(x.employeeId)) skills.set(x.employeeId, new Map());
    skills.get(x.employeeId)?.set(x.skillId, x.proficiency);
  }
  const reqs = groupBy(data.requirements, (r) => r.workflowId);
  const deps = groupBy(data.dependencies, (d) => d.workflowId);
  const experienceIndex = new Map(
    data.experience.map((r) => [`${r.employeeId}|${r.workflowId}`, r]),
  );

  const unavailable = new Set<string>();
  if (s.type === "EmployeeUnavailable" && s.employeeId)
    unavailable.add(s.employeeId);
  if (s.type === "PersonnelUnavailable") {
    // Worst-case stress test: most operationally critical removed first.
    const pool = data.employees
      .filter((e) => e.facilityId === s.facilityId && e.status === "Active")
      .sort(
        (a, b) =>
          b.operationalCriticality - a.operationalCriticality ||
          b.knowledgeConcentration - a.knowledgeConcentration ||
          a.employeeId.localeCompare(b.employeeId),
      );
    const n = Math.ceil((pool.length * (s.personnelUnavailablePct ?? 0)) / 100);
    for (const e of pool.slice(0, n)) unavailable.add(e.employeeId);
  }
  if (s.type === "RoleUnavailable") {
    const role = (s.role ?? "").toLowerCase();
    for (const e of data.employees)
      if (e.facilityId === s.facilityId && e.role.toLowerCase() === role)
        unavailable.add(e.employeeId);
  }
  if (s.type === "FacilityOffline") {
    for (const e of data.employees)
      if (
        e.facilityId === s.facilityId &&
        (!e.remoteEligible || e.workArrangement === "Onsite")
      )
        unavailable.add(e.employeeId);
  }
  const systemOffline = new Set<string>();
  if (s.type === "SystemOffline" && s.systemId) systemOffline.add(s.systemId);
  if (s.type === "FacilityOffline")
    for (const x of data.systems)
      if (x.hostingFacilityId === s.facilityId) systemOffline.add(x.systemId);

  const totalAllocation = new Map<string, number>();
  for (const a of data.assignments)
    totalAllocation.set(
      a.employeeId,
      (totalAllocation.get(a.employeeId) ?? 0) + a.allocationPct,
    );

  const isActive = (eid: string) => emp.get(eid)?.status === "Active";
  const fteOf = (a: OrgAssignment) =>
    ((emp.get(a.employeeId)?.fte ?? 0) * a.allocationPct) / 100;

  const output: WorkflowResult[] = data.workflows.map((w) => {
    const wid = w.workflowId;
    const aa = assignments.get(wid) ?? [];
    const baselineFte = aa
      .filter((a) => isActive(a.employeeId))
      .reduce((sum, a) => sum + fteOf(a), 0);
    const active = aa.filter(
      (a) => !unavailable.has(a.employeeId) && isActive(a.employeeId),
    );
    const remainingFte = active.reduce((sum, a) => sum + fteOf(a), 0);
    const baselineCount = new Set(
      aa.filter((a) => isActive(a.employeeId)).map((a) => a.employeeId),
    ).size;
    const activeCount = new Set(active.map((a) => a.employeeId)).size;
    const staffing = baselineFte ? remainingFte / baselineFte : 0;
    const minimum = w.minimumActivePersonnel;
    const headcount = minimum ? Math.min(1, activeCount / minimum) : 1;
    const skillRatios: number[] = [];
    const skillGaps: SkillGap[] = [];
    for (const req of reqs.get(wid) ?? []) {
      const qualified = active.filter(
        (a) =>
          (skills.get(a.employeeId)?.get(req.skillId) ?? 0) >=
          req.minimumProficiency,
      ).length;
      const needed = req.minimumQualifiedPeople;
      skillRatios.push(needed ? Math.min(1, qualified / needed) : 1);
      if (qualified < needed)
        skillGaps.push({
          skill: req.skillId,
          qualified,
          required: needed,
          shortfall: needed - qualified,
          proficiency: req.minimumProficiency,
        });
    }
    const skillFactor =
      enabled.has("skills") && skillRatios.length
        ? Math.min(...skillRatios)
        : 1;
    const wDeps = deps.get(wid) ?? [];
    const blocked = wDeps
      .filter(
        (d) => systemOffline.has(d.systemId) && d.dependencyType === "Required",
      )
      .map((d) => d.systemId);
    const degraded = wDeps
      .filter(
        (d) => systemOffline.has(d.systemId) && d.dependencyType !== "Required",
      )
      .map((d) => d.systemId);
    const systemFactor = blocked.length ? 0 : degraded.length ? 0.75 : 1;
    // Bottleneck model: limiting factor, not multiplied losses.
    const human = Math.min(1, staffing, headcount, skillFactor);
    const effects = workflowEffects(
      wid,
      w.taskWorkHours,
      aa,
      unavailable,
      reqs.get(wid) ?? [],
      emp,
      skills,
      data,
      experienceIndex,
      baselineFte,
      human,
      systemFactor,
      enabled,
    );
    const coverage = effects.coveragePct;
    const status: WorkflowResult["status"] =
      coverage === 0
        ? "Blocked"
        : coverage < 80
          ? "At Risk"
          : coverage < 99.95
            ? "Degraded"
            : "Operational";
    return {
      workflowId: wid,
      name: w.workflowName,
      criticality: w.criticality,
      ownerFacilityId: w.ownerFacilityId,
      status,
      assignedPeopleBaseline: baselineCount,
      assignedPeopleActive: activeCount,
      baselineAssignedFte: round(baselineFte, 2),
      remainingAssignedFte: round(remainingFte, 2),
      staffingFactor: round(staffing, 3),
      headcountFactor: round(headcount, 3),
      skillFactor: round(skillFactor, 3),
      systemFactor,
      skillGaps,
      blockedSystems: blocked,
      degradedSystems: degraded,
      lostAssignedPersonnel: aa
        .filter((a) => unavailable.has(a.employeeId))
        .map((a) => a.employeeId),
      ...effects,
      expectedTasksDuringScenario: round(
        effects.throughputTasksPerHour * s.durationHours,
        4,
      ),
    };
  });

  // Conservative recovery suggestions; never applied automatically.
  const candidates: RecoveryCandidate[] = [];
  const existing = new Map(
    data.workflows.map((w) => [
      w.workflowId,
      new Set((assignments.get(w.workflowId) ?? []).map((a) => a.employeeId)),
    ]),
  );
  const remainingSpare = new Map<string, number>();
  for (const e of data.employees)
    if (!unavailable.has(e.employeeId) && e.status === "Active")
      remainingSpare.set(
        e.employeeId,
        (Math.max(0, 100 - (totalAllocation.get(e.employeeId) ?? 0)) / 100) *
          e.fte,
      );
  const ordered = [...output].sort(
    (a, b) => b.criticality - a.criticality || a.coveragePct - b.coveragePct,
  );
  for (const w of ordered) {
    if (w.coveragePct >= 100 || w.blockedSystems.length) continue;
    for (const gap of w.skillGaps) {
      const qualified: [number, number, string][] = [];
      for (const e of data.employees) {
        const eid = e.employeeId;
        const spare = remainingSpare.get(eid);
        if (existing.get(w.workflowId)?.has(eid) || spare === undefined)
          continue;
        if (
          (skills.get(eid)?.get(gap.skill) ?? 0) < gap.proficiency ||
          spare < 0.1
        )
          continue;
        const crossSite = e.facilityId !== w.ownerFacilityId;
        if (crossSite && !(e.remoteEligible || e.crossSiteDeployable)) continue;
        qualified.push([crossSite ? 0 : 1, -spare, eid]);
      }
      qualified.sort(
        (a, b) => a[0] - b[0] || a[1] - b[1] || a[2].localeCompare(b[2]),
      );
      for (const [, , eid] of qualified.slice(0, Math.min(gap.shortfall, 3))) {
        const e = emp.get(eid) as OrgEmployee;
        const spare = remainingSpare.get(eid) ?? 0;
        const amt = round(Math.min(spare, 0.25), 2);
        remainingSpare.set(eid, spare - amt);
        candidates.push({
          workflowId: w.workflowId,
          employeeId: eid,
          employeeName: e.displayName,
          fromFacilityId: e.facilityId,
          toFacilityId: w.ownerFacilityId,
          skill: gap.skill,
          proficiency: skills.get(eid)?.get(gap.skill) ?? 0,
          spareFteAllocated: amt,
        });
      }
    }
  }

  const totalCriticality = output.reduce((s2, w) => s2 + w.criticality, 0);
  const weighted =
    output.reduce((s2, w) => s2 + w.coveragePct * w.criticality, 0) /
    totalCriticality;
  const affected = new Set<string>();
  for (const eid of unavailable) affected.add(emp.get(eid)?.facilityId ?? "");
  for (const w of output)
    if (w.coveragePct < 100) affected.add(w.ownerFacilityId);

  return {
    summary: {
      headcountTotal: data.employees.length,
      staffUnavailable: unavailable.size,
      systemsOffline: systemOffline.size,
      workflowCount: output.length,
      workflowsAtRisk: output.filter((w) => w.coveragePct < 100).length,
      workflowsBlocked: output.filter((w) => w.coveragePct === 0).length,
      weightedReadinessPct: round(weighted, 1),
      candidateTransfers: candidates.length,
      affectedFacilityIds: [...affected].sort(),
    },
    workflows: output,
    unavailableEmployees: [...unavailable].sort().map((eid) => {
      const e = emp.get(eid) as OrgEmployee;
      return {
        employeeId: eid,
        name: e.displayName,
        facilityId: e.facilityId,
        role: e.role,
        criticality: e.operationalCriticality,
      };
    }),
    offlineSystems: [...systemOffline].sort().map((sid) => ({
      systemId: sid,
      name: data.systems.find((x) => x.systemId === sid)?.systemName ?? sid,
    })),
    recoveryCandidates: candidates,
  };
}

function methodology(variant: ModelVariant): Record<string, string> {
  const enabled = MODEL_VARIANTS[variant];
  return {
    Model:
      "Deterministic bottleneck capacity stress test; not a calibrated forecast",
    "Staff reduction":
      "Highest-criticality personnel removed first (worst-case ordering)",
    "Facility outage":
      "Onsite-only employees unavailable; hybrid/remote eligible staff assumed offsite-capable; locally hosted systems offline",
    Readiness:
      "Criticality-weighted task-rate coverage relative to fully efficient baseline assigned FTE; limited by staffing, headcount, enabled human variables and systems",
    Skills: enabled.has("skills")
      ? "Enabled: task-relevant proficiency affects employee efficiency and minimum-qualified-person coverage"
      : "Disabled in predictions; qualification diagnostics and recovery suggestions remain available",
    Experience: enabled.has("experience")
      ? "Enabled: explicit years in role OR similar-task counts affect efficiency; organizational tenure is not treated as measured role experience"
      : "Disabled in predictions",
    Relationships: enabled.has("relationships")
      ? "Enabled: directed workflow handoffs, collaboration frequency and unavailable endpoints affect coordination delay"
      : "Disabled in predictions",
    Timing:
      "Illustrative aggregate task completion time and fluid throughput, not an event/queue simulation. Duration is modeled working hours; no shifts or restoration",
    Calibration:
      "Synthetic demonstration inputs and assumed coefficients; no observed outcomes or validated prediction improvement",
    "Employee edits":
      "Scenario-local overrides; saved employee records are unchanged. Baseline uses original inputs without disruption",
    Recovery:
      "Candidates do not alter modeled coverage; validation and approval required",
    Data: "Fully synthetic demo data",
  };
}

export function simulate(scenario: Scenario, data: OrgModel): SimulationResult {
  validate(scenario, data);
  const baseline = compute(
    {
      type: "PersonnelUnavailable",
      facilityId: data.facilities[0]?.facilityId,
      personnelUnavailablePct: 0,
      durationHours: 24,
      modelVariant: scenario.modelVariant,
    },
    data,
  );
  const updated = applyEmployeeUpdates(data, scenario.employeeUpdates ?? []);
  const result = compute(scenario, updated);
  const modelComparison = (Object.keys(MODEL_VARIANTS) as ModelVariant[]).map(
    (variant) => ({
      modelVariant: variant,
      weightedReadinessPct: compute(
        { ...scenario, modelVariant: variant },
        updated,
      ).summary.weightedReadinessPct,
    }),
  );
  return {
    scenario,
    ...result,
    summary: {
      ...result.summary,
      baselineReadinessPct: baseline.summary.weightedReadinessPct,
      readinessChangePoints: round(
        result.summary.weightedReadinessPct -
          baseline.summary.weightedReadinessPct,
        1,
      ),
    },
    modelComparison,
    methodology: methodology(scenario.modelVariant),
  };
}

export const EXAMPLE_SCENARIOS: (Omit<Scenario, "modelVariant"> & {
  name: string;
})[] = [
  {
    name: "Atlanta staffing reduction",
    type: "PersonnelUnavailable",
    facilityId: "FAC-ATL",
    personnelUnavailablePct: 30,
    durationHours: 72,
  },
  {
    name: "Denver technology hub outage",
    type: "FacilityOffline",
    facilityId: "FAC-DEN",
    durationHours: 24,
  },
  {
    name: "Washington access outage",
    type: "FacilityOffline",
    facilityId: "FAC-DC",
    durationHours: 48,
  },
  {
    name: "Chicago cybersecurity team shortage",
    type: "RoleUnavailable",
    facilityId: "FAC-CHI",
    role: "Cybersecurity Analyst",
    durationHours: 48,
  },
  {
    name: "San Diego service disruption",
    type: "FacilityOffline",
    facilityId: "FAC-SAN",
    durationHours: 36,
  },
];
