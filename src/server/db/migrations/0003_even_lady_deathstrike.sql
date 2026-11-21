CREATE TABLE "route_approval_log" (
	"id" text PRIMARY KEY NOT NULL,
	"shipment_id" text NOT NULL,
	"decision" text NOT NULL,
	"decided_by" text NOT NULL,
	"scenario_label" text NOT NULL,
	"summary" text NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "route_approvals" (
	"shipment_id" text PRIMARY KEY NOT NULL,
	"route_key" text NOT NULL,
	"decision" text NOT NULL,
	"decided_by" text NOT NULL,
	"scenario_label" text NOT NULL,
	"summary" text NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "route_approval_log" ADD CONSTRAINT "route_approval_log_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_approvals" ADD CONSTRAINT "route_approvals_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;