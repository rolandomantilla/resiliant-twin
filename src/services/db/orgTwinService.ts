import { createServerFn } from "@tanstack/react-start";
import type { OrgModel } from "@/lib/orgTwin/types";

export const getOrgModel = createServerFn({ method: "GET" }).handler(
  async (): Promise<OrgModel> => {
    const { requireAppAccess } = await import("@/server/protectedServerFn");
    await requireAppAccess("read");
    const { getDb } = await import("@/lib/db");
    const s = await import("@/server/db/schema");
    const { asc } = await import("drizzle-orm");
    const db = await getDb();
    const [
      facilities,
      systems,
      employees,
      workflows,
      skills,
      assignments,
      requirements,
      dependencies,
      experience,
      relationships,
    ] = await Promise.all([
      db
        .select()
        .from(s.orgFacilities)
        .orderBy(asc(s.orgFacilities.facilityId)),
      db.select().from(s.orgSystems).orderBy(asc(s.orgSystems.systemId)),
      db.select().from(s.orgEmployees).orderBy(asc(s.orgEmployees.employeeId)),
      db.select().from(s.orgWorkflows).orderBy(asc(s.orgWorkflows.workflowId)),
      db
        .select()
        .from(s.orgEmployeeSkills)
        .orderBy(asc(s.orgEmployeeSkills.id)),
      db
        .select()
        .from(s.orgWorkflowAssignments)
        .orderBy(asc(s.orgWorkflowAssignments.id)),
      db
        .select()
        .from(s.orgSkillRequirements)
        .orderBy(asc(s.orgSkillRequirements.id)),
      db
        .select()
        .from(s.orgSystemDependencies)
        .orderBy(asc(s.orgSystemDependencies.id)),
      db.select().from(s.orgExperience).orderBy(asc(s.orgExperience.id)),
      db.select().from(s.orgRelationships).orderBy(asc(s.orgRelationships.id)),
    ]);
    const strip = <T extends { id: number }>(rows: T[]) =>
      rows.map(({ id: _id, ...rest }) => rest);
    return {
      facilities,
      systems,
      employees,
      workflows,
      skills: strip(skills),
      assignments: strip(assignments),
      requirements: strip(requirements),
      dependencies: strip(dependencies),
      experience: strip(experience),
      relationships: strip(relationships),
    };
  },
);
