-- Demo seed data (synthetic). Idempotent.
INSERT INTO "facilities" ("id", "name", "kind", "lat", "lon", "daily_capacity")
VALUES
  ('PORT-LA', 'Port of Los Angeles', 'port', 33.732, -118.269, 0),
  ('PORT-LB', 'Port of Long Beach', 'port', 33.754, -118.216, 0),
  ('WH-ONT', 'Ontario Distribution Center', 'warehouse', 34.064, -117.651, 10),
  ('WH-RIV', 'Riverside Distribution Center', 'warehouse', 33.953, -117.396, 8),
  ('WH-CAR', 'Carson Distribution Center', 'warehouse', 33.832, -118.281, 7),
  ('WH-COM', 'Commerce Distribution Center', 'warehouse', 34.002, -118.159, 6),
  ('WH-FON', 'Fontana Distribution Center', 'warehouse', 34.097, -117.435, 9)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "customer_contacts" ("customer_id", "display_name", "phone", "email")
VALUES
  ('CUST-001', 'Harbor Crest Retail Group', '555-0114', 'dispatch@harborcrestretail.example'),
  ('CUST-002', 'Pacific Rim Foods Co-op', '555-0127', 'receiving@pacificrimfoods.example'),
  ('CUST-003', 'Inland Auto Components', '555-0138', 'logistics@inlandautoparts.example'),
  ('CUST-004', 'Meridian Textile Supply', '555-0149', 'orders@meridiantextile.example'),
  ('CUST-005', 'Golden State General Mdse', '555-0162', 'ops@goldenstategm.example'),
  ('CUST-006', 'BrightPoint Electronics', '555-0173', 'warehouse@brightpointelex.example'),
  ('CUST-007', 'Southland Food Distributors', '555-0185', 'inbound@southlandfood.example'),
  ('CUST-008', 'Valley Auto Import Parts', '555-0196', 'shipping@valleyautoimport.example'),
  ('CUST-009', 'Coastline Apparel Trading', '555-0208', 'receiving@coastlineapparel.example')
ON CONFLICT ("customer_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "trucks" ("id", "capacity_teu", "status", "base_port_id", "vehicle_type", "fuel_type", "model_year", "mpg_assumed", "maintenance_state", "available_from_min", "home_warehouse_id")
VALUES
  ('TRUCK-01', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2020, 5.75, 'serviceable', 0, 'WH-CAR'),
  ('TRUCK-02', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2021, 6, 'serviceable', 0, 'WH-COM'),
  ('TRUCK-03', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2022, 6.25, 'serviceable', 0, 'WH-FON'),
  ('TRUCK-04', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2023, 6.5, 'serviceable', 0, 'WH-ONT'),
  ('TRUCK-05', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2024, 5.5, 'serviceable', 0, 'WH-RIV'),
  ('TRUCK-06', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2025, 5.75, 'inspection_due', 0, 'WH-CAR'),
  ('TRUCK-07', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2019, 6, 'serviceable', 0, 'WH-COM'),
  ('TRUCK-08', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2020, 6.25, 'serviceable', 0, 'WH-FON'),
  ('TRUCK-09', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2021, 6.5, 'serviceable', 0, 'WH-ONT'),
  ('TRUCK-10', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2022, 5.5, 'serviceable', 0, 'WH-RIV'),
  ('TRUCK-11', 2, 'available', 'PORT-LA', 'Class 8 tractor', 'diesel', 2023, 5.75, 'serviceable', 0, 'WH-CAR'),
  ('TRUCK-12', 2, 'available', 'PORT-LB', 'Class 8 tractor', 'diesel', 2024, 6, 'inspection_due', 0, 'WH-COM')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "drivers" ("id", "truck_id", "endorsement", "shift_start_min", "shift_end_min", "hours_remaining", "rest_required_min")
VALUES
  ('DRIVER-01', 'TRUCK-01', 'CDL-A', 0, 600, 3.8, 30),
  ('DRIVER-02', 'TRUCK-02', 'CDL-A', 0, 600, 4.6, 30),
  ('DRIVER-03', 'TRUCK-03', 'CDL-A', 0, 600, 5.4, 30),
  ('DRIVER-04', 'TRUCK-04', 'CDL-A', 0, 600, 6.2, 30),
  ('DRIVER-05', 'TRUCK-05', 'CDL-A', 0, 600, 3, 30),
  ('DRIVER-06', 'TRUCK-06', 'CDL-A', 0, 600, 3.8, 30),
  ('DRIVER-07', 'TRUCK-07', 'CDL-A', 0, 600, 4.6, 30),
  ('DRIVER-08', 'TRUCK-08', 'CDL-A', 0, 600, 5.4, 30),
  ('DRIVER-09', 'TRUCK-09', 'CDL-A', 0, 600, 6.2, 30),
  ('DRIVER-10', 'TRUCK-10', 'CDL-A', 0, 600, 3, 30),
  ('DRIVER-11', 'TRUCK-11', 'CDL-A', 0, 600, 3.8, 30),
  ('DRIVER-12', 'TRUCK-12', 'CDL-A', 0, 600, 4.6, 30)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "warehouse_slots" ("slot_id", "warehouse_id", "window_start_min", "window_end_min", "capacity", "booked")
VALUES
  ('SLOT-WH-CAR-00', 'WH-CAR', 0, 120, 8, 5),
  ('SLOT-WH-CAR-02', 'WH-CAR', 120, 240, 8, 3),
  ('SLOT-WH-CAR-04', 'WH-CAR', 240, 360, 8, 0),
  ('SLOT-WH-CAR-06', 'WH-CAR', 360, 480, 8, 0),
  ('SLOT-WH-CAR-08', 'WH-CAR', 480, 600, 8, 0),
  ('SLOT-WH-CAR-10', 'WH-CAR', 600, 720, 8, 0),
  ('SLOT-WH-COM-00', 'WH-COM', 0, 120, 8, 3),
  ('SLOT-WH-COM-02', 'WH-COM', 120, 240, 8, 5),
  ('SLOT-WH-COM-04', 'WH-COM', 240, 360, 8, 0),
  ('SLOT-WH-COM-06', 'WH-COM', 360, 480, 8, 0),
  ('SLOT-WH-COM-08', 'WH-COM', 480, 600, 8, 0),
  ('SLOT-WH-COM-10', 'WH-COM', 600, 720, 8, 0),
  ('SLOT-WH-FON-00', 'WH-FON', 0, 120, 8, 6),
  ('SLOT-WH-FON-02', 'WH-FON', 120, 240, 8, 2),
  ('SLOT-WH-FON-04', 'WH-FON', 240, 360, 8, 0),
  ('SLOT-WH-FON-06', 'WH-FON', 360, 480, 8, 0),
  ('SLOT-WH-FON-08', 'WH-FON', 480, 600, 8, 0),
  ('SLOT-WH-FON-10', 'WH-FON', 600, 720, 8, 0),
  ('SLOT-WH-ONT-00', 'WH-ONT', 0, 120, 8, 4),
  ('SLOT-WH-ONT-02', 'WH-ONT', 120, 240, 8, 4),
  ('SLOT-WH-ONT-04', 'WH-ONT', 240, 360, 8, 0),
  ('SLOT-WH-ONT-06', 'WH-ONT', 360, 480, 8, 0),
  ('SLOT-WH-ONT-08', 'WH-ONT', 480, 600, 8, 0),
  ('SLOT-WH-ONT-10', 'WH-ONT', 600, 720, 8, 0),
  ('SLOT-WH-RIV-00', 'WH-RIV', 0, 120, 8, 2),
  ('SLOT-WH-RIV-02', 'WH-RIV', 120, 240, 8, 6),
  ('SLOT-WH-RIV-04', 'WH-RIV', 240, 360, 8, 0),
  ('SLOT-WH-RIV-06', 'WH-RIV', 360, 480, 8, 0),
  ('SLOT-WH-RIV-08', 'WH-RIV', 480, 600, 8, 0),
  ('SLOT-WH-RIV-10', 'WH-RIV', 600, 720, 8, 0)
ON CONFLICT ("slot_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "shipments" ("id", "origin_id", "destination_id", "container_id", "customer_id", "cargo_type", "container_teu", "priority", "pickup_status", "pickup_ready_min", "appointment_start_min", "appointment_end_min", "appointment_slot_id", "estimated_value_usd", "weight_tons", "handling_requirements")
VALUES
  ('SHP-001', 'PORT-LA', 'WH-ONT', 'CONT-00001', 'CUST-001', 'electronics', 1, 'high', 'ready', 0, 72, 132, 'SLOT-WH-ONT-00', 8217.35, 18, 'standard'),
  ('SHP-002', 'PORT-LB', 'WH-RIV', 'CONT-00002', 'CUST-002', 'food_nonperishable', 1, 'critical', 'pending', 90, 156, 216, 'SLOT-WH-RIV-02', 8434.7, 14.3, 'standard'),
  ('SHP-003', 'PORT-LA', 'WH-CAR', 'CONT-00003', 'CUST-003', 'automotive', 1, 'routine', 'pending', 45, 108, 168, 'SLOT-WH-CAR-00', 8652.05, 18.6, 'standard'),
  ('SHP-004', 'PORT-LB', 'WH-COM', 'CONT-00004', 'CUST-004', 'textiles', 2, 'high', 'pending', 25, 135, 195, 'SLOT-WH-COM-02', 8869.4, 12.8, 'standard'),
  ('SHP-005', 'PORT-LA', 'WH-FON', 'CONT-00005', 'CUST-005', 'general', 1, 'critical', 'pending', 25, 93, 153, 'SLOT-WH-FON-00', 9086.75, 9.4, 'standard'),
  ('SHP-006', 'PORT-LB', 'WH-ONT', 'CONT-00006', 'CUST-006', 'electronics', 1, 'routine', 'pending', 60, 123, 183, 'SLOT-WH-ONT-02', 9304.1, 19.9, 'standard'),
  ('SHP-007', 'PORT-LA', 'WH-RIV', 'CONT-00007', 'CUST-007', 'food_nonperishable', 1, 'high', 'pending', 90, 123, 183, 'SLOT-WH-RIV-02', 9521.45, 18.2, 'fragile'),
  ('SHP-008', 'PORT-LB', 'WH-CAR', 'CONT-00008', 'CUST-008', 'automotive', 2, 'critical', 'pending', 90, 157, 217, 'SLOT-WH-CAR-02', 9738.8, 9.1, 'standard'),
  ('SHP-009', 'PORT-LA', 'WH-COM', 'CONT-00009', 'CUST-009', 'textiles', 1, 'routine', 'pending', 45, 156, 216, 'SLOT-WH-COM-02', 9956.15, 16.1, 'standard'),
  ('SHP-010', 'PORT-LB', 'WH-FON', 'CONT-00010', 'CUST-001', 'general', 1, 'high', 'ready', 0, 43, 103, 'SLOT-WH-FON-00', 10173.5, 18.8, 'standard'),
  ('SHP-011', 'PORT-LA', 'WH-ONT', 'CONT-00011', 'CUST-002', 'electronics', 1, 'critical', 'ready', 0, 38, 98, 'SLOT-WH-ONT-00', 10390.85, 13.3, 'standard'),
  ('SHP-012', 'PORT-LB', 'WH-RIV', 'CONT-00012', 'CUST-003', 'food_nonperishable', 2, 'routine', 'pending', 60, 158, 218, 'SLOT-WH-RIV-02', 10608.2, 10.3, 'standard'),
  ('SHP-013', 'PORT-LA', 'WH-CAR', 'CONT-00013', 'CUST-004', 'automotive', 1, 'high', 'pending', 45, 104, 164, 'SLOT-WH-CAR-00', 10825.55, 17.8, 'standard'),
  ('SHP-014', 'PORT-LB', 'WH-COM', 'CONT-00014', 'CUST-005', 'textiles', 1, 'critical', 'ready', 0, 71, 131, 'SLOT-WH-COM-00', 11042.9, 15.5, 'fragile'),
  ('SHP-015', 'PORT-LA', 'WH-FON', 'CONT-00015', 'CUST-006', 'general', 1, 'routine', 'pending', 25, 106, 166, 'SLOT-WH-FON-00', 11260.25, 13.3, 'standard'),
  ('SHP-016', 'PORT-LB', 'WH-ONT', 'CONT-00016', 'CUST-007', 'electronics', 2, 'high', 'pending', 90, 157, 217, 'SLOT-WH-ONT-02', 11477.6, 19.8, 'standard'),
  ('SHP-017', 'PORT-LA', 'WH-RIV', 'CONT-00017', 'CUST-008', 'food_nonperishable', 1, 'critical', 'ready', 0, 30, 90, 'SLOT-WH-RIV-00', 11694.95, 19.3, 'standard'),
  ('SHP-018', 'PORT-LB', 'WH-CAR', 'CONT-00018', 'CUST-009', 'automotive', 1, 'routine', 'pending', 60, 97, 157, 'SLOT-WH-CAR-00', 11912.3, 11, 'standard'),
  ('SHP-019', 'PORT-LA', 'WH-COM', 'CONT-00019', 'CUST-001', 'textiles', 1, 'high', 'pending', 90, 187, 247, 'SLOT-WH-COM-02', 12129.65, 11, 'standard'),
  ('SHP-020', 'PORT-LB', 'WH-FON', 'CONT-00020', 'CUST-002', 'general', 2, 'critical', 'pending', 60, 155, 215, 'SLOT-WH-FON-02', 12347, 10, 'standard'),
  ('SHP-021', 'PORT-LA', 'WH-ONT', 'CONT-00021', 'CUST-003', 'electronics', 1, 'routine', 'pending', 25, 123, 183, 'SLOT-WH-ONT-02', 12564.35, 15.5, 'fragile'),
  ('SHP-022', 'PORT-LB', 'WH-RIV', 'CONT-00022', 'CUST-004', 'food_nonperishable', 1, 'high', 'pending', 90, 203, 263, 'SLOT-WH-RIV-02', 12781.7, 13.6, 'standard'),
  ('SHP-023', 'PORT-LA', 'WH-CAR', 'CONT-00023', 'CUST-005', 'automotive', 1, 'critical', 'pending', 25, 110, 170, 'SLOT-WH-CAR-00', 12999.05, 14.9, 'standard'),
  ('SHP-024', 'PORT-LB', 'WH-COM', 'CONT-00024', 'CUST-006', 'textiles', 2, 'routine', 'ready', 0, 38, 98, 'SLOT-WH-COM-00', 13216.4, 16.8, 'standard'),
  ('SHP-025', 'PORT-LA', 'WH-FON', 'CONT-00025', 'CUST-007', 'general', 1, 'high', 'pending', 60, 118, 178, 'SLOT-WH-FON-00', 13433.75, 13.4, 'standard'),
  ('SHP-026', 'PORT-LB', 'WH-ONT', 'CONT-00026', 'CUST-008', 'electronics', 1, 'critical', 'pending', 90, 198, 258, 'SLOT-WH-ONT-02', 13651.1, 11.5, 'standard'),
  ('SHP-027', 'PORT-LA', 'WH-RIV', 'CONT-00027', 'CUST-009', 'food_nonperishable', 1, 'routine', 'pending', 90, 116, 176, 'SLOT-WH-RIV-00', 13868.45, 17.5, 'standard'),
  ('SHP-028', 'PORT-LB', 'WH-CAR', 'CONT-00028', 'CUST-001', 'automotive', 2, 'high', 'pending', 90, 184, 244, 'SLOT-WH-CAR-02', 14085.8, 18.8, 'fragile'),
  ('SHP-029', 'PORT-LA', 'WH-COM', 'CONT-00029', 'CUST-002', 'textiles', 1, 'critical', 'pending', 45, 101, 161, 'SLOT-WH-COM-00', 14303.15, 14.1, 'standard'),
  ('SHP-030', 'PORT-LB', 'WH-FON', 'CONT-00030', 'CUST-003', 'general', 1, 'routine', 'pending', 60, 105, 165, 'SLOT-WH-FON-00', 14520.5, 21.6, 'standard'),
  ('SHP-031', 'PORT-LA', 'WH-ONT', 'CONT-00031', 'CUST-004', 'electronics', 1, 'high', 'pending', 25, 82, 142, 'SLOT-WH-ONT-00', 14737.85, 20.2, 'standard'),
  ('SHP-032', 'PORT-LB', 'WH-RIV', 'CONT-00032', 'CUST-005', 'food_nonperishable', 2, 'critical', 'pending', 45, 174, 234, 'SLOT-WH-RIV-02', 14955.2, 16.5, 'standard'),
  ('SHP-033', 'PORT-LA', 'WH-CAR', 'CONT-00033', 'CUST-006', 'automotive', 1, 'routine', 'pending', 25, 80, 140, 'SLOT-WH-CAR-00', 15172.55, 15.6, 'standard'),
  ('SHP-034', 'PORT-LB', 'WH-COM', 'CONT-00034', 'CUST-007', 'textiles', 1, 'high', 'pending', 90, 143, 203, 'SLOT-WH-COM-02', 15389.9, 14.8, 'standard'),
  ('SHP-035', 'PORT-LA', 'WH-FON', 'CONT-00035', 'CUST-008', 'general', 1, 'critical', 'ready', 0, 74, 134, 'SLOT-WH-FON-00', 15607.25, 11.4, 'fragile'),
  ('SHP-036', 'PORT-LB', 'WH-ONT', 'CONT-00036', 'CUST-009', 'electronics', 2, 'routine', 'pending', 25, 83, 143, 'SLOT-WH-ONT-00', 15824.6, 9.2, 'standard'),
  ('SHP-037', 'PORT-LA', 'WH-RIV', 'CONT-00037', 'CUST-001', 'food_nonperishable', 1, 'high', 'pending', 60, 132, 192, 'SLOT-WH-RIV-02', 16041.95, 21.7, 'standard'),
  ('SHP-038', 'PORT-LB', 'WH-CAR', 'CONT-00038', 'CUST-002', 'automotive', 1, 'critical', 'pending', 90, 167, 227, 'SLOT-WH-CAR-02', 16259.3, 9.8, 'standard'),
  ('SHP-039', 'PORT-LA', 'WH-COM', 'CONT-00039', 'CUST-003', 'textiles', 1, 'routine', 'pending', 60, 128, 188, 'SLOT-WH-COM-02', 16476.65, 11.7, 'standard'),
  ('SHP-040', 'PORT-LB', 'WH-FON', 'CONT-00040', 'CUST-004', 'general', 2, 'high', 'pending', 90, 156, 216, 'SLOT-WH-FON-02', 16694, 21, 'standard')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "road_nodes" ("node_id", "name", "lat", "lon", "node_type")
VALUES
  ('N-LA', 'Port of Los Angeles', 33.732, -118.269, 'port'),
  ('N-LB', 'Port of Long Beach', 33.754, -118.216, 'port'),
  ('N-CAR', 'Carson', 33.832, -118.281, 'hub'),
  ('N-COM', 'Commerce', 34.002, -118.159, 'hub'),
  ('N-ONT', 'Ontario', 34.064, -117.651, 'hub'),
  ('N-RIV', 'Riverside', 33.953, -117.396, 'hub'),
  ('N-FON', 'Fontana', 34.097, -117.435, 'hub'),
  ('N-ALT1', 'Alternate Junction A', 33.875, -117.935, 'schematic'),
  ('N-ALT2', 'Alternate Junction B', 34.045, -117.795, 'schematic')
ON CONFLICT ("node_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "road_segments" ("segment_id", "from_node_id", "to_node_id", "road_name", "nominal_miles", "nominal_min", "sensitivity", "freight_allowed", "geometry_json")
VALUES
  ('S-001', 'N-LA', 'N-CAR', 'Port access connector', 9, 18, 'high', true, '[[-118.269,33.732],[-118.281,33.832]]'),
  ('S-002', 'N-LB', 'N-CAR', 'Port access connector', 10, 20, 'high', true, '[[-118.216,33.754],[-118.281,33.832]]'),
  ('S-003', 'N-CAR', 'N-COM', 'I-710 corridor (illustrative)', 17, 29, 'high', true, '[[-118.281,33.832],[-118.159,34.002]]'),
  ('S-004', 'N-COM', 'N-ONT', 'I-10 corridor (illustrative)', 37, 45, 'high', true, '[[-118.159,34.002],[-117.651,34.064]]'),
  ('S-005', 'N-ONT', 'N-RIV', 'I-15 / SR-60 corridor (illustrative)', 17, 26, 'medium', true, '[[-117.651,34.064],[-117.396,33.953]]'),
  ('S-006', 'N-ONT', 'N-FON', 'I-10 east corridor (illustrative)', 14, 22, 'high', true, '[[-117.651,34.064],[-117.435,34.097]]'),
  ('S-007', 'N-CAR', 'N-ALT1', 'Southern alternate connector', 24, 39, 'medium', true, '[[-118.281,33.832],[-117.935,33.875]]'),
  ('S-008', 'N-ALT1', 'N-ALT2', 'Alternative inland route', 34, 45, 'medium', true, '[[-117.935,33.875],[-117.795,34.045]]'),
  ('S-009', 'N-ALT2', 'N-ONT', 'Alternate Ontario connector', 17, 25, 'medium', true, '[[-117.795,34.045],[-117.651,34.064]]'),
  ('S-010', 'N-ALT2', 'N-RIV', 'Alternate Riverside connector', 27, 37, 'medium', true, '[[-117.795,34.045],[-117.396,33.953]]'),
  ('S-011', 'N-ALT2', 'N-FON', 'Alternate Fontana connector', 26, 35, 'medium', true, '[[-117.795,34.045],[-117.435,34.097]]'),
  ('S-012', 'N-CAR', 'N-COM', 'Local freight road (illustrative)', 20, 43, 'high', true, '[[-118.281,33.832],[-118.159,34.002]]'),
  ('S-013', 'N-COM', 'N-ALT2', 'I-605 corridor (illustrative)', 35, 48, 'medium', true, '[[-118.159,34.002],[-117.795,34.045]]')
ON CONFLICT ("segment_id") DO NOTHING;
