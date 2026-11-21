CREATE TABLE "org_employee_skills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_employee_skills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_employees" (
	"employee_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"facility_id" text NOT NULL,
	"role" text NOT NULL,
	"work_arrangement" text NOT NULL,
	"remote_eligible" boolean NOT NULL,
	"cross_site_deployable" boolean NOT NULL,
	"fte" double precision NOT NULL,
	"operational_criticality" integer NOT NULL,
	"knowledge_concentration" integer NOT NULL,
	"manager_id" text,
	"backup_employee_id" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_experience" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_experience_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"years_in_role" double precision,
	"similar_tasks_completed" integer
);
--> statement-breakpoint
CREATE TABLE "org_facilities" (
	"facility_id" text PRIMARY KEY NOT NULL,
	"facility_name" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"primary_function" text NOT NULL,
	"headcount_target" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_relationships" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_relationships_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_id" text NOT NULL,
	"source_employee_id" text NOT NULL,
	"target_employee_id" text NOT NULL,
	"collaboration_events" integer NOT NULL,
	"handoff_events" integer NOT NULL,
	"mean_handoff_hours" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_skill_requirements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_skill_requirements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"minimum_proficiency" integer NOT NULL,
	"minimum_qualified_people" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_system_dependencies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_system_dependencies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workflow_id" text NOT NULL,
	"system_id" text NOT NULL,
	"dependency_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_systems" (
	"system_id" text PRIMARY KEY NOT NULL,
	"system_name" text NOT NULL,
	"hosting_facility_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_workflow_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_workflow_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"employee_id" text NOT NULL,
	"workflow_id" text NOT NULL,
	"allocation_pct" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_workflows" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"workflow_name" text NOT NULL,
	"criticality" integer NOT NULL,
	"owner_facility_id" text NOT NULL,
	"minimum_active_personnel" integer NOT NULL,
	"task_work_hours" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_employee_skills" ADD CONSTRAINT "org_employee_skills_employee_id_org_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."org_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_employees" ADD CONSTRAINT "org_employees_facility_id_org_facilities_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."org_facilities"("facility_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_experience" ADD CONSTRAINT "org_experience_employee_id_org_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."org_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_experience" ADD CONSTRAINT "org_experience_workflow_id_org_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."org_workflows"("workflow_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_relationships" ADD CONSTRAINT "org_relationships_workflow_id_org_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."org_workflows"("workflow_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_relationships" ADD CONSTRAINT "org_relationships_source_employee_id_org_employees_employee_id_fk" FOREIGN KEY ("source_employee_id") REFERENCES "public"."org_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_relationships" ADD CONSTRAINT "org_relationships_target_employee_id_org_employees_employee_id_fk" FOREIGN KEY ("target_employee_id") REFERENCES "public"."org_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_skill_requirements" ADD CONSTRAINT "org_skill_requirements_workflow_id_org_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."org_workflows"("workflow_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_system_dependencies" ADD CONSTRAINT "org_system_dependencies_workflow_id_org_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."org_workflows"("workflow_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_system_dependencies" ADD CONSTRAINT "org_system_dependencies_system_id_org_systems_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."org_systems"("system_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_systems" ADD CONSTRAINT "org_systems_hosting_facility_id_org_facilities_facility_id_fk" FOREIGN KEY ("hosting_facility_id") REFERENCES "public"."org_facilities"("facility_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_workflow_assignments" ADD CONSTRAINT "org_workflow_assignments_employee_id_org_employees_employee_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."org_employees"("employee_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_workflow_assignments" ADD CONSTRAINT "org_workflow_assignments_workflow_id_org_workflows_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."org_workflows"("workflow_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_workflows" ADD CONSTRAINT "org_workflows_owner_facility_id_org_facilities_facility_id_fk" FOREIGN KEY ("owner_facility_id") REFERENCES "public"."org_facilities"("facility_id") ON DELETE no action ON UPDATE no action;