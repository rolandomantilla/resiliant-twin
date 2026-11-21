CREATE TABLE "corridor_live_state" (
	"corridor_id" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"delay_min" integer DEFAULT 0 NOT NULL,
	"last_event_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disruption_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"corridor_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"truck_id" text NOT NULL,
	"endorsement" text NOT NULL,
	"shift_start_min" integer NOT NULL,
	"shift_end_min" integer NOT NULL,
	"hours_remaining" double precision NOT NULL,
	"rest_required_min" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"daily_capacity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iot_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "outreach_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"stop_id" text NOT NULL,
	"shipment_ids" text NOT NULL,
	"impact_key" text NOT NULL,
	"eta_summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_nodes" (
	"node_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lon" double precision NOT NULL,
	"node_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_segments" (
	"segment_id" text PRIMARY KEY NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"road_name" text NOT NULL,
	"nominal_miles" double precision NOT NULL,
	"nominal_min" integer NOT NULL,
	"sensitivity" text NOT NULL,
	"freight_allowed" boolean DEFAULT true NOT NULL,
	"geometry_json" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"settings_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"origin_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"container_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"cargo_type" text NOT NULL,
	"container_teu" integer NOT NULL,
	"priority" text NOT NULL,
	"pickup_status" text NOT NULL,
	"pickup_ready_min" integer NOT NULL,
	"appointment_start_min" integer NOT NULL,
	"appointment_end_min" integer NOT NULL,
	"appointment_slot_id" text NOT NULL,
	"estimated_value_usd" double precision NOT NULL,
	"weight_tons" double precision NOT NULL,
	"handling_requirements" text NOT NULL,
	"contacted" boolean DEFAULT false NOT NULL,
	"contacted_at" timestamp,
	"last_notice_id" text
);
--> statement-breakpoint
CREATE TABLE "truck_live_state" (
	"truck_id" text PRIMARY KEY NOT NULL,
	"lat" double precision,
	"lon" double precision,
	"pickup_status" text,
	"queue_min" integer,
	"last_event_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" text PRIMARY KEY NOT NULL,
	"capacity_teu" integer NOT NULL,
	"status" text NOT NULL,
	"base_port_id" text,
	"vehicle_type" text NOT NULL,
	"fuel_type" text NOT NULL,
	"model_year" integer NOT NULL,
	"mpg_assumed" double precision NOT NULL,
	"maintenance_state" text NOT NULL,
	"available_from_min" integer DEFAULT 0 NOT NULL,
	"home_warehouse_id" text
);
--> statement-breakpoint
CREATE TABLE "warehouse_slots" (
	"slot_id" text PRIMARY KEY NOT NULL,
	"warehouse_id" text NOT NULL,
	"window_start_min" integer NOT NULL,
	"window_end_min" integer NOT NULL,
	"capacity" integer NOT NULL,
	"booked" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_notices" ADD CONSTRAINT "outreach_notices_stop_id_facilities_id_fk" FOREIGN KEY ("stop_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_segments" ADD CONSTRAINT "road_segments_from_node_id_road_nodes_node_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."road_nodes"("node_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_segments" ADD CONSTRAINT "road_segments_to_node_id_road_nodes_node_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."road_nodes"("node_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_origin_id_facilities_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_id_facilities_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_id_customer_contacts_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_contacts"("customer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_appointment_slot_id_warehouse_slots_slot_id_fk" FOREIGN KEY ("appointment_slot_id") REFERENCES "public"."warehouse_slots"("slot_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_base_port_id_facilities_id_fk" FOREIGN KEY ("base_port_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_home_warehouse_id_facilities_id_fk" FOREIGN KEY ("home_warehouse_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_slots" ADD CONSTRAINT "warehouse_slots_warehouse_id_facilities_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;