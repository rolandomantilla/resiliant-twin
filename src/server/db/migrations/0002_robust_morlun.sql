CREATE TABLE "truck_swaps" (
	"shipment_id" text PRIMARY KEY NOT NULL,
	"from_truck_id" text,
	"truck_id" text NOT NULL,
	"pickup_id" text,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "truck_swaps" ADD CONSTRAINT "truck_swaps_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_swaps" ADD CONSTRAINT "truck_swaps_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_swaps" ADD CONSTRAINT "truck_swaps_pickup_id_facilities_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;