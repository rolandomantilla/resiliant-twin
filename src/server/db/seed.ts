#!/usr/bin/env bun
// Reloads the bundled demo data (see seed-data/). Clears demo run-time state
// too, so the demo starts fresh. Same logic as the in-app "Reset demo data".
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { seedSnapshot } from "./seedSnapshot";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const counts = await seedSnapshot(drizzle(neon(url), { schema }));
console.log("Seeded demo data:", counts);
process.exit(0);
