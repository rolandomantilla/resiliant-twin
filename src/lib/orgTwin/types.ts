export type ScenarioType =
  | "PersonnelUnavailable"
  | "FacilityOffline"
  | "RoleUnavailable"
  | "EmployeeUnavailable"
  | "SystemOffline";

export type ModelVariant =
  | "process_only"
  | "skills_only"
  | "experience_only"
  | "relationships_only"
  | "human_centered";

export interface OrgFacility {
  facilityId: string;
  facilityName: string;
  city: string;
  state: string;
  primaryFunction: string;
  headcountTarget: number;
}

export interface OrgSystem {
  systemId: string;
  systemName: string;
  hostingFacilityId: string;
}

export interface OrgEmployee {
  employeeId: string;
  displayName: string;
  facilityId: string;
  role: string;
  workArrangement: string;
  remoteEligible: boolean;
  crossSiteDeployable: boolean;
  fte: number;
  operationalCriticality: number;
  knowledgeConcentration: number;
  managerId: string | null;
  backupEmployeeId: string | null;
  status: string;
}

export interface OrgWorkflow {
  workflowId: string;
  workflowName: string;
  criticality: number;
  ownerFacilityId: string;
  minimumActivePersonnel: number;
  taskWorkHours: number;
}

export interface OrgSkill {
  employeeId: string;
  skillId: string;
  proficiency: number;
}

export interface OrgAssignment {
  employeeId: string;
  workflowId: string;
  allocationPct: number;
}

export interface OrgSkillRequirement {
  workflowId: string;
  skillId: string;
  minimumProficiency: number;
  minimumQualifiedPeople: number;
}

export interface OrgSystemDependency {
  workflowId: string;
  systemId: string;
  dependencyType: string;
}

export interface OrgExperience {
  employeeId: string;
  workflowId: string;
  yearsInRole: number | null;
  similarTasksCompleted: number | null;
}

export interface OrgRelationship {
  workflowId: string;
  sourceEmployeeId: string;
  targetEmployeeId: string;
  collaborationEvents: number;
  handoffEvents: number;
  meanHandoffHours: number;
}

export interface OrgModel {
  facilities: OrgFacility[];
  systems: OrgSystem[];
  employees: OrgEmployee[];
  workflows: OrgWorkflow[];
  skills: OrgSkill[];
  assignments: OrgAssignment[];
  requirements: OrgSkillRequirement[];
  dependencies: OrgSystemDependency[];
  experience: OrgExperience[];
  relationships: OrgRelationship[];
}

export interface ExperienceUpdate {
  workflowId: string;
  yearsInRole?: number;
  similarTasksCompleted?: number;
}

export interface RelationshipUpdate {
  workflowId: string;
  targetEmployeeId: string;
  collaborationEvents: number;
  handoffEvents: number;
  meanHandoffHours: number;
}

export interface EmployeeUpdate {
  employeeId: string;
  skills?: Record<string, number>;
  experience?: ExperienceUpdate[];
  relationships?: RelationshipUpdate[];
}

export interface Scenario {
  type: ScenarioType;
  modelVariant: ModelVariant;
  facilityId?: string;
  personnelUnavailablePct?: number;
  role?: string;
  employeeId?: string;
  systemId?: string;
  durationHours: number;
  employeeUpdates?: EmployeeUpdate[];
}

export interface SkillGap {
  skill: string;
  qualified: number;
  required: number;
  shortfall: number;
  proficiency: number;
}

export interface WorkflowResult {
  workflowId: string;
  name: string;
  criticality: number;
  ownerFacilityId: string;
  coveragePct: number;
  status: "Operational" | "Degraded" | "At Risk" | "Blocked";
  assignedPeopleBaseline: number;
  assignedPeopleActive: number;
  baselineAssignedFte: number;
  remainingAssignedFte: number;
  staffingFactor: number;
  headcountFactor: number;
  skillFactor: number;
  systemFactor: number;
  skillGaps: SkillGap[];
  blockedSystems: string[];
  degradedSystems: string[];
  lostAssignedPersonnel: string[];
  skillEfficiencyFactor: number;
  experienceEfficiencyFactor: number;
  productiveFte: number;
  coordinationDelayHours: number;
  handoffEvents: number;
  disruptedHandoffEvents: number;
  taskCompletionHours: number | null;
  throughputTasksPerHour: number;
  expectedTasksDuringScenario: number;
}

export interface RecoveryCandidate {
  workflowId: string;
  employeeId: string;
  employeeName: string;
  fromFacilityId: string;
  toFacilityId: string;
  skill: string;
  proficiency: number;
  spareFteAllocated: number;
}

export interface SimulationResult {
  scenario: Scenario;
  summary: {
    headcountTotal: number;
    staffUnavailable: number;
    systemsOffline: number;
    workflowCount: number;
    workflowsAtRisk: number;
    workflowsBlocked: number;
    weightedReadinessPct: number;
    candidateTransfers: number;
    affectedFacilityIds: string[];
    baselineReadinessPct: number;
    readinessChangePoints: number;
  };
  workflows: WorkflowResult[];
  unavailableEmployees: {
    employeeId: string;
    name: string;
    facilityId: string;
    role: string;
    criticality: number;
  }[];
  offlineSystems: { systemId: string; name: string }[];
  recoveryCandidates: RecoveryCandidate[];
  modelComparison: {
    modelVariant: ModelVariant;
    weightedReadinessPct: number;
  }[];
  methodology: Record<string, string>;
}
