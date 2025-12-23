import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { getDBURLPrimary } from "./helpers/getDBURL.mjs";
import { env } from "../src/server/env";

const db = drizzle(neon(getDBURLPrimary(env)));

const main = async () => {
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Migration completed");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
};

main();
